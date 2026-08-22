// ============================================================
// Repository contract — the ONLY way the pipeline touches data.
//
// GAP 5 ("permission before retrieval") is enforced HERE: the pipeline
// never fetches raw rows and filters in JS. It hands the repo a NodeFilter
// describing every check as a predicate, and the repo compiles that into a
// single indexed SQL WHERE clause. Restricted rows never leave the database.
// ============================================================

import type { User, HierarchyLevel, KnowledgeNode } from '@/lib/types';

// A declarative description of the 5 checks as data. Enabling flags
// cumulatively reproduces the sequential funnel (check N input = check N-1 output).
export interface NodeFilter {
  orgId: string;

  // Structural reach (BFS output) + Zone 2 injection.
  reachableLevelIds: string[];
  includeZone2: boolean;

  // Check 1 — ISOLATION (org_id). Always org-scoped; flag documents the stage.
  applyIsolation: boolean;

  // Check 2 — COMPLIANCE. Exclude nodes whose tags overlap the user's blocked tags.
  applyCompliance: boolean;
  blockedTags: string[];

  // Check 3 — PERMISSION. Node's level must be readable; Zone 2 is exempt (global safety).
  applyPermission: boolean;
  readableLevelIds: string[];

  // Check 4 — TEMPORAL. Drop SUPERSEDED / EXPIRED / past valid_until.
  applyTemporal: boolean;

  // Check 5 — DERIVABILITY. Drop nodes the AI already knows (score >= threshold).
  applyDerivability: boolean;
  derivabilityThreshold: number;
}

export interface Repo {
  backend: 'pglite' | 'supabase';
  init(): Promise<void>;
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  getHierarchyLevels(orgId: string): Promise<HierarchyLevel[]>;
  getOrgConfig(orgId: string): Promise<Record<string, unknown>>;
  totalNodeCount(orgId: string): Promise<number>;
  countNodes(filter: NodeFilter): Promise<number>;
  fetchNodes(filter: NodeFilter): Promise<KnowledgeNode[]>;
}
