// ============================================================
// Pipeline Orchestrator
//
// DAG -> BFS -> Zone 2 -> 5-Check -> Candidate Set. ZERO LLM. Deterministic.
// The pipeline code is identical for every user; only the user PROFILE (role,
// ceiling, department, clearance) changes what comes out — which is the whole
// point of the assessment and how it resists hardcoding.
// ============================================================

import type { NodeFilter, Repo } from '@/lib/repo/types';
import type { PipelineOptions, PipelineResult } from '@/lib/types';
import { compilePermissions, readableLevelIds } from './permissionCompiler';
import { resolveEntryPoint } from './entryPointResolver';
import { bfsTraversal } from './bfsTraversal';
import { shouldInjectZone2 } from './zone2Injector';
import { runFiveChecks } from './fiveCheckFilter';
import { assembleCandidateSet } from './candidateAssembler';

export async function runPipeline(
  repo: Repo,
  userId: string,
  options: PipelineOptions = { injectZone2: true },
): Promise<PipelineResult> {
  const wall0 = performance.now();

  const user = await repo.getUser(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const orgId = user.org_id;

  const [levels, config, totalNodes] = await Promise.all([
    repo.getHierarchyLevels(orgId),
    repo.getOrgConfig(orgId),
    repo.totalNodeCount(orgId),
  ]);

  const derivabilityThreshold =
    typeof config.derivability_threshold === 'number' ? config.derivability_threshold : 0.7;

  // 1 — Permission Compiler (once per session, O(1) lookups thereafter)
  const tPerm = performance.now();
  const perms = compilePermissions(user, levels);
  const readable = readableLevelIds(perms, levels);
  const permission_compile_ms = performance.now() - tPerm;

  // 2 — Entry Point Resolver
  const tEntry = performance.now();
  const entry = resolveEntryPoint(user, levels);
  const entry_resolve_ms = performance.now() - tEntry;

  // 3 — BFS Traversal (cross-department roles reach every branch)
  const crossDepartment = ['ADMIN', 'QUALITY', 'AUDITOR'].includes(user.role);
  const tBfs = performance.now();
  const bfs = bfsTraversal(entry, levels, user.department, crossDepartment);
  const bfs_ms = performance.now() - tBfs;
  const reachableLevelIds = [...bfs.reachableLevels.keys()];

  // Funnel needs the BFS-only count (reachable nodes WITHOUT Zone 2).
  const bfsOnlyFilter: NodeFilter = {
    orgId,
    reachableLevelIds,
    includeZone2: false,
    applyIsolation: false,
    applyCompliance: false,
    blockedTags: perms.blockedTags,
    applyPermission: false,
    readableLevelIds: readable,
    applyTemporal: false,
    applyDerivability: false,
    derivabilityThreshold,
  };
  const afterBfsOnlyCount = await repo.countNodes(bfsOnlyFilter);

  // 4 + 5 — Zone 2 injection then the five sequential checks
  const includeZone2 = shouldInjectZone2(options);
  const five = await runFiveChecks({
    repo,
    orgId,
    reachableLevelIds,
    readableLevelIds: readable,
    blockedTags: perms.blockedTags,
    derivabilityThreshold,
    includeZone2,
    totalNodes,
    afterBfsOnlyCount,
  });

  // 6 — Candidate Set Assembler
  const candidate_set = assembleCandidateSet(five.finalNodes, bfs, levels);

  const total_ms = performance.now() - wall0;

  return {
    user: user.id,
    user_name: user.name,
    role: user.role,
    department: user.department,
    ceiling_level: user.ceiling_level,
    entry_point: entry.id,
    entry_point_name: entry.level_name,
    backend: repo.backend,
    total_nodes: totalNodes,
    funnel: five.funnel,
    pipeline_timing: {
      permission_compile_ms: round(permission_compile_ms),
      entry_resolve_ms: round(entry_resolve_ms),
      bfs_ms: round(bfs_ms),
      zone2_inject_ms: round(five.timings.zone2_inject_ms),
      check1_isolation_ms: round(five.timings.check1_isolation_ms),
      check2_compliance_ms: round(five.timings.check2_compliance_ms),
      check3_permission_ms: round(five.timings.check3_permission_ms),
      check4_temporal_ms: round(five.timings.check4_temporal_ms),
      check5_derivability_ms: round(five.timings.check5_derivability_ms),
      total_ms: round(total_ms),
    },
    candidate_set,
    reachable_level_ids: reachableLevelIds,
    options: { injectZone2: includeZone2 },
  };
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}
