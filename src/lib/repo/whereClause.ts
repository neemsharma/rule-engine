// ============================================================
// Compiles a NodeFilter into a single SQL WHERE clause.
//
// All values (ids, tags, org) are system-controlled and validated against a
// strict token pattern, so they are safely inlined as SQL literals. No
// user-provided free text ever reaches this function.
// ============================================================

import type { NodeFilter } from './types';

const TOKEN = /^[A-Za-z0-9_:.-]+$/;

function lit(token: string): string {
  if (!TOKEN.test(token)) {
    throw new Error(`Refusing to inline unsafe token: ${JSON.stringify(token)}`);
  }
  return `'${token}'`;
}

function list(tokens: string[]): string {
  return tokens.map(lit).join(', ');
}

/** Build the cumulative WHERE clause for the checks currently enabled on `f`. */
export function buildWhereClause(f: NodeFilter): string {
  const conds: string[] = [];

  // Structural reach (BFS) OR Zone 2 injection.
  const struct: string[] = [];
  struct.push(
    f.reachableLevelIds.length
      ? `hierarchy_level_id IN (${list(f.reachableLevelIds)})`
      : 'FALSE',
  );
  if (f.includeZone2) struct.push('zone = 2');
  conds.push(`(${struct.join(' OR ')})`);

  // Check 1 — ISOLATION (multi-tenant).
  if (f.applyIsolation) conds.push(`org_id = ${lit(f.orgId)}`);

  // Check 2 — COMPLIANCE (array overlap with blocked tags).
  if (f.applyCompliance && f.blockedTags.length) {
    conds.push(`NOT (compliance_tags && ARRAY[${list(f.blockedTags)}]::text[])`);
  }

  // Check 3 — PERMISSION (level readable). Zone 2 is exempt (global safety).
  if (f.applyPermission) {
    const perm: string[] = [];
    perm.push(
      f.readableLevelIds.length
        ? `hierarchy_level_id IN (${list(f.readableLevelIds)})`
        : 'FALSE',
    );
    perm.push('zone = 2');
    conds.push(`(${perm.join(' OR ')})`);
  }

  // Check 4 — TEMPORAL.
  if (f.applyTemporal) {
    conds.push(`status NOT IN ('SUPERSEDED', 'EXPIRED')`);
    conds.push(`(valid_until IS NULL OR valid_until > NOW())`);
  }

  // Check 5 — DERIVABILITY.
  if (f.applyDerivability) {
    conds.push(`derivability_score < ${Number(f.derivabilityThreshold)}`);
  }

  return conds.length ? conds.join(' AND ') : 'TRUE';
}
