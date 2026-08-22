// ============================================================
// Module 3 — BFS Traversal (upward through the DAG)
//
// Walks the hierarchy-level DAG from the user's entry level using a FIFO queue
// and a visited set. Edges:
//   UP   (parent_ids)            — always traversed (reach ancestors/root)
//   DOWN (children of a level)   — traversed ONLY into the user's own department
//
// Why department-gated descent: pure "walk up" would miss sibling units the
// user genuinely owns (Ortho Ward user must still reach the Ortho TKR unit and
// the multi-parent Post-TKR area), while ungated descent from a shared ancestor
// (Clinical Division) would leak every other department. Gating descent to the
// user's department gives correct department isolation in one BFS.
//
// The visited set makes multi-parent nodes (Post-TKR = Ortho AND Surgery)
// process exactly once and makes any accidental cycle terminate (Problem 2 & 4).
// Traversal touches only the reachable subgraph, not the whole graph — this is
// why the pipeline stays sub-500ms as the total node count grows (scalability).
//
// Cross-department roles (ADMIN / QUALITY / AUDITOR) descend into EVERY child,
// not just their own department, because their remit spans the whole org. Their
// ceiling + compliance clearance (Checks 3 & 2) then narrow what they actually
// see — structure opens the door, the checks decide what passes.
// ============================================================

import type { BfsResult, HierarchyLevel } from '@/lib/types';

export function bfsTraversal(
  entry: HierarchyLevel,
  levels: HierarchyLevel[],
  department: string,
  reachAllDepartments = false,
): BfsResult {
  const byId = new Map(levels.map((l) => [l.id, l]));

  // Precompute children adjacency: parentId -> child levels.
  const childrenOf = new Map<string, HierarchyLevel[]>();
  for (const l of levels) {
    for (const p of l.parent_ids ?? []) {
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(l);
    }
  }

  const reachableLevels = new Map<string, number>();
  const visitedOrder: string[] = [];
  const queue: Array<{ id: string; dist: number }> = [{ id: entry.id, dist: 0 }];
  reachableLevels.set(entry.id, 0);

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    visitedOrder.push(id);
    const level = byId.get(id);
    if (!level) continue;

    const neighbors: string[] = [];

    // UP — every parent, unconditionally.
    for (const p of level.parent_ids ?? []) {
      if (byId.has(p)) neighbors.push(p);
    }

    // DOWN — children in the user's department (isolation boundary), or every
    // child for cross-department roles.
    for (const child of childrenOf.get(id) ?? []) {
      if (reachAllDepartments || child.department === department) neighbors.push(child.id);
    }

    for (const nId of neighbors) {
      if (!reachableLevels.has(nId)) {
        reachableLevels.set(nId, dist + 1); // shortest-path distance (BFS layer)
        queue.push({ id: nId, dist: dist + 1 });
      }
      // else: already visited — visited set prevents re-processing (multi-parent / cycles)
    }
  }

  return { reachableLevels, entryLevelId: entry.id, visitedOrder };
}
