// ============================================================
// Module 5 — Five-Check Sequential Filter
//
// The 5 checks are SEQUENTIAL: the output of check N is the input to check N+1.
// We reproduce that by enabling one predicate at a time on a shared NodeFilter
// and asking the database to COUNT after each — the cumulative counts ARE the
// funnel. The final SELECT returns only the surviving rows' full content, so
// restricted rows never leave Postgres (GAP 5). This runs as indexed SQL WHERE
// clauses, NOT fetch-all-then-filter.
//
//   Check 1 ISOLATION    org_id = user.org_id
//   Check 2 COMPLIANCE   NOT (compliance_tags && blocked_tags)
//   Check 3 PERMISSION   hierarchy_level readable  (Zone 2 exempt)
//   Check 4 TEMPORAL     status not SUPERSEDED/EXPIRED AND not past valid_until
//   Check 5 DERIVABILITY derivability_score < threshold
// ============================================================

import type { FunnelStage, KnowledgeNode } from '@/lib/types';
import type { NodeFilter, Repo } from '@/lib/repo/types';

export interface FiveCheckInput {
  repo: Repo;
  orgId: string;
  reachableLevelIds: string[];
  readableLevelIds: string[];
  blockedTags: string[];
  derivabilityThreshold: number;
  includeZone2: boolean;
  totalNodes: number;
  afterBfsOnlyCount: number; // reachable nodes WITHOUT zone 2 (for the funnel)
}

export interface FiveCheckOutput {
  funnel: FunnelStage[];
  finalNodes: KnowledgeNode[];
  timings: {
    zone2_inject_ms: number;
    check1_isolation_ms: number;
    check2_compliance_ms: number;
    check3_permission_ms: number;
    check4_temporal_ms: number;
    check5_derivability_ms: number;
  };
}

// Base filter: BFS reach (+ optional Zone 2), all 5 checks OFF.
function baseFilter(i: FiveCheckInput): NodeFilter {
  return {
    orgId: i.orgId,
    reachableLevelIds: i.reachableLevelIds,
    includeZone2: i.includeZone2,
    applyIsolation: false,
    applyCompliance: false,
    blockedTags: i.blockedTags,
    applyPermission: false,
    readableLevelIds: i.readableLevelIds,
    applyTemporal: false,
    applyDerivability: false,
    derivabilityThreshold: i.derivabilityThreshold,
  };
}

async function timedCount(repo: Repo, f: NodeFilter): Promise<[number, number]> {
  const t0 = performance.now();
  const n = await repo.countNodes(f);
  return [n, performance.now() - t0];
}

export async function runFiveChecks(i: FiveCheckInput): Promise<FiveCheckOutput> {
  const f = baseFilter(i);

  // Stage: after Zone 2 injection (still no checks).
  const tZone0 = performance.now();
  const afterZone2 = await i.repo.countNodes(f);
  const zone2_inject_ms = performance.now() - tZone0;

  // Check 1 — ISOLATION
  f.applyIsolation = true;
  const [afterCheck1, check1_isolation_ms] = await timedCount(i.repo, f);

  // Check 2 — COMPLIANCE
  f.applyCompliance = true;
  const [afterCheck2, check2_compliance_ms] = await timedCount(i.repo, f);

  // Check 3 — PERMISSION
  f.applyPermission = true;
  const [afterCheck3, check3_permission_ms] = await timedCount(i.repo, f);

  // Check 4 — TEMPORAL
  f.applyTemporal = true;
  const [afterCheck4, check4_temporal_ms] = await timedCount(i.repo, f);

  // Check 5 — DERIVABILITY  (final predicate)
  f.applyDerivability = true;
  const t5 = performance.now();
  const finalNodes = await i.repo.fetchNodes(f);
  const check5_derivability_ms = performance.now() - t5;
  const afterCheck5 = finalNodes.length;

  const stage = (key: string, label: string, count: number, prev: number): FunnelStage => ({
    key,
    label,
    count,
    removed: Math.max(0, prev - count),
  });

  const funnel: FunnelStage[] = [
    stage('total', 'Total graph', i.totalNodes, i.totalNodes),
    stage('after_bfs', 'After BFS reach', i.afterBfsOnlyCount, i.totalNodes),
    stage('after_zone2', '+ Zone 2 injected', afterZone2, i.afterBfsOnlyCount),
    stage('after_check1', 'Check 1 · Isolation', afterCheck1, afterZone2),
    stage('after_check2', 'Check 2 · Compliance', afterCheck2, afterCheck1),
    stage('after_check3', 'Check 3 · Permission', afterCheck3, afterCheck2),
    stage('after_check4', 'Check 4 · Temporal', afterCheck4, afterCheck3),
    stage('after_check5', 'Check 5 · Derivability', afterCheck5, afterCheck4),
  ];

  return {
    funnel,
    finalNodes,
    timings: {
      zone2_inject_ms,
      check1_isolation_ms,
      check2_compliance_ms,
      check3_permission_ms,
      check4_temporal_ms,
      check5_derivability_ms,
    },
  };
}
