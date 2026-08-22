// ============================================================
// Module 2 — Entry Point Resolver
//
// Maps a user to the DAG level where their BFS starts. Data-driven (reads the
// hierarchy), never hardcoded per user, so a brand-new profile resolves too.
//
// Rule: among levels in the user's department, pick the one whose level_number
// is closest to the user's ceiling_level (ties -> deeper level, then stable id).
// This puts a ward VIEWER at their ward and a HOD at their department, without
// per-role branching. If the department has no level (pharmacy/quality/admin,
// or any surprise department), fall back to the org root.
// ============================================================

import type { HierarchyLevel, User } from '@/lib/types';

export function resolveEntryPoint(user: User, levels: HierarchyLevel[]): HierarchyLevel {
  const inDept = levels.filter((l) => l.department === user.department);

  const pool = inDept.length > 0 ? inDept : rootPool(levels);

  const sorted = [...pool].sort((a, b) => {
    const da = Math.abs(a.level_number - user.ceiling_level);
    const db = Math.abs(b.level_number - user.ceiling_level);
    if (da !== db) return da - db; // closest to ceiling
    if (a.level_number !== b.level_number) return b.level_number - a.level_number; // deeper wins ties
    return a.id.localeCompare(b.id); // stable
  });

  return sorted[0];
}

function rootPool(levels: HierarchyLevel[]): HierarchyLevel[] {
  const minLevel = Math.min(...levels.map((l) => l.level_number));
  return levels.filter((l) => l.level_number === minLevel && l.zone !== 2);
}
