// ============================================================
// Module 6 — Candidate Set Assembler
//
// Annotates each surviving node with the metadata the downstream Composition
// Agent consumes: type, importance, zone, hierarchy level, distance_from_entry
// (from BFS), and a compression_hint derived from distance:
//   distance 0-1 -> FULL, distance 2 -> COMPRESSED, distance 3+ -> CONSTRAINT_ONLY
// Zone-2 globals bypass BFS, so they are treated as "far" (constraint-only).
// ============================================================

import type {
  BfsResult,
  CandidateNode,
  CompressionHint,
  HierarchyLevel,
  KnowledgeNode,
} from '@/lib/types';

function compressionHint(distance: number): CompressionHint {
  if (distance <= 1) return 'FULL';
  if (distance === 2) return 'COMPRESSED';
  return 'CONSTRAINT_ONLY';
}

export function assembleCandidateSet(
  nodes: KnowledgeNode[],
  bfs: BfsResult,
  levels: HierarchyLevel[],
): CandidateNode[] {
  const levelNumberById = new Map(levels.map((l) => [l.id, l.level_number]));
  const maxReachable = Math.max(0, ...bfs.reachableLevels.values());

  return nodes.map((n) => {
    const fromZone2 = n.zone === 2;
    const reachDist = bfs.reachableLevels.get(n.hierarchy_level_id);
    // Zone-2 (or otherwise-unreached) nodes are treated as far from entry.
    const distance = reachDist ?? Math.max(maxReachable, 3);

    return {
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      importance: n.importance,
      zone: n.zone,
      hierarchy_level: levelNumberById.get(n.hierarchy_level_id) ?? 0,
      department: n.department,
      distance_from_entry: distance,
      compression_hint: compressionHint(distance),
      from_zone2: fromZone2,
    };
  });
}
