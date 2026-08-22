// ============================================================
// Module 1 — Permission Compiler
//
// Compiled ONCE per session into an O(1) lookup {level_number -> {can_read,
// can_write}}, so each of the 500+ per-node permission checks is a dictionary
// hit, never a DB round-trip (avoids the N+1 problem, Thinking-Guide Problem 5).
//
// Role read/write rules (from the Setup Guide, extended for QUALITY/AUDITOR so
// the surprise-test passes with zero code changes):
//   VIEWER   read: level >= ceiling            write: none
//   EDITOR   read: level >= ceiling            write: level >= write_ceiling
//   HOD      read: all levels                  write: level >= ceiling
//   ADMIN    read: all                         write: all
//   QUALITY  read: level >= ceiling            write: level >= write_ceiling
//   AUDITOR  read: level >= ceiling            write: none
// Compliance clearance is orthogonal (handled by blockedTags, Check 2).
// ============================================================

import type { CompiledPermissions, HierarchyLevel, PermissionEntry, User } from '@/lib/types';

const SENSITIVE_TAGS = ['MNPI', 'PHI', 'CONFIDENTIAL'];

export function compilePermissions(
  user: User,
  levels: HierarchyLevel[],
): CompiledPermissions {
  const ceiling = user.ceiling_level;
  const writeCeiling = user.write_ceiling;

  const readAll = user.role === 'ADMIN' || user.role === 'HOD';
  const writeAll = user.role === 'ADMIN';

  const canReadLevel = (n: number): boolean => (readAll ? true : n >= ceiling);
  const canWriteLevel = (n: number): boolean => {
    if (writeAll) return true;
    switch (user.role) {
      case 'HOD':
        return n >= ceiling;
      case 'EDITOR':
      case 'QUALITY':
        return writeCeiling != null && n >= writeCeiling;
      case 'VIEWER':
      case 'AUDITOR':
      default:
        return false;
    }
  };

  const byLevel: Record<number, PermissionEntry> = {};
  const distinctLevels = [...new Set(levels.map((l) => l.level_number))];
  for (const n of distinctLevels) {
    byLevel[n] = { can_read: canReadLevel(n), can_write: canWriteLevel(n) };
  }

  const clearance = new Set(user.compliance_clearance ?? []);
  const blockedTags = SENSITIVE_TAGS.filter((t) => !clearance.has(t));

  return { role: user.role, ceiling_level: ceiling, write_ceiling: writeCeiling, byLevel, blockedTags };
}

/** Level ids whose level_number is readable for this user — the Check-3 whitelist. */
export function readableLevelIds(
  perms: CompiledPermissions,
  levels: HierarchyLevel[],
): string[] {
  return levels.filter((l) => perms.byLevel[l.level_number]?.can_read).map((l) => l.id);
}
