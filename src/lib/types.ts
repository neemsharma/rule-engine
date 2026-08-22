// ============================================================
// BRAHMO Rules Engine — Shared domain types
// ============================================================

export type Role = 'ADMIN' | 'HOD' | 'EDITOR' | 'VIEWER' | 'QUALITY' | 'AUDITOR';
export type NodeType = 'CONSTRAINT' | 'DECISION' | 'ANTI_PATTERN' | 'FACT';
export type NodeStatus =
  | 'ACTIVE'
  | 'REVIEW_REQUIRED'
  | 'SUPERSEDED'
  | 'EXPIRED'
  | 'LEGAL_HOLD';
export type ComplianceTag = 'MNPI' | 'PHI' | 'CONFIDENTIAL';
export type CompressionHint = 'FULL' | 'COMPRESSED' | 'CONSTRAINT_ONLY';

export interface User {
  id: string;
  org_id: string;
  name: string;
  role: Role;
  department: string;
  ceiling_level: number;
  write_ceiling: number | null;
  compliance_clearance: string[];
  status: string;
}

export interface HierarchyLevel {
  id: string;
  org_id: string;
  level_number: number;
  level_name: string;
  department: string | null;
  parent_ids: string[];
  zone: number;
}

export interface KnowledgeNode {
  id: string;
  org_id: string;
  hierarchy_level_id: string;
  type: NodeType;
  title: string;
  content: string;
  importance: number;
  zone: number;
  status: NodeStatus;
  derivability_score: number;
  compliance_tags: string[];
  valid_until: string | null;
  department: string | null;
}

// Compiled permission table — O(1) lookup per hierarchy level.
export interface PermissionEntry {
  can_read: boolean;
  can_write: boolean;
}
export interface CompiledPermissions {
  role: Role;
  ceiling_level: number;
  write_ceiling: number | null;
  // level_number -> {can_read, can_write}
  byLevel: Record<number, PermissionEntry>;
  // convenience: the set of tags this user is NOT cleared for
  blockedTags: string[];
}

// BFS output
export interface BfsResult {
  // reachable level id -> distance from entry level (0 = entry)
  reachableLevels: Map<string, number>;
  entryLevelId: string;
  visitedOrder: string[]; // for demo / debugging
}

// A node annotated for the candidate set
export interface CandidateNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  importance: number;
  zone: number;
  hierarchy_level: number;
  department: string | null;
  distance_from_entry: number;
  compression_hint: CompressionHint;
  from_zone2: boolean;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  removed: number;
}

export interface PipelineTiming {
  permission_compile_ms: number;
  entry_resolve_ms: number;
  bfs_ms: number;
  zone2_inject_ms: number;
  check1_isolation_ms: number;
  check2_compliance_ms: number;
  check3_permission_ms: number;
  check4_temporal_ms: number;
  check5_derivability_ms: number;
  total_ms: number;
}

export interface PipelineResult {
  user: string;
  user_name: string;
  role: Role;
  department: string;
  ceiling_level: number;
  entry_point: string;
  entry_point_name: string;
  backend: 'pglite' | 'supabase';
  total_nodes: number;
  funnel: FunnelStage[];
  pipeline_timing: PipelineTiming;
  candidate_set: CandidateNode[];
  // DAG overlay: which levels were reachable, for the tree visualization
  reachable_level_ids: string[];
  // options echoed back
  options: PipelineOptions;
}

export interface PipelineOptions {
  injectZone2: boolean; // toggle for Scenario 4 demo
}
