// ============================================================
// PGlite backend — embedded Postgres (WASM) running in the Node server.
//
// Loads the SAME supabase/schema.sql + seed.sql the production Supabase path
// uses, and executes the SAME SQL WHERE clauses. This means the local demo is
// GAP-5 faithful: the 5 checks run as indexed SQL predicates inside Postgres,
// not as JS array filters.
// ============================================================

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Repo, NodeFilter } from './types';
import type { User, HierarchyLevel, KnowledgeNode } from '@/lib/types';
import { buildWhereClause } from './whereClause';

const NODE_COLUMNS = `id, org_id, hierarchy_level_id, type, title, content,
  importance::float8 AS importance, zone, status,
  derivability_score::float8 AS derivability_score,
  compliance_tags, valid_until, department`;

// Cache the initialized DB on the global object so Next.js hot-reload / multiple
// requests reuse one in-memory Postgres instead of re-seeding every call.
const g = globalThis as unknown as { __brahmoDb?: Promise<PGlite> };

function loadDb(): Promise<PGlite> {
  if (!g.__brahmoDb) {
    g.__brahmoDb = (async () => {
      const db = new PGlite();
      const dir = join(process.cwd(), 'supabase');
      const schema = readFileSync(join(dir, 'schema.sql'), 'utf8');
      const seed = readFileSync(join(dir, 'seed.sql'), 'utf8');
      await db.exec(schema);
      await db.exec(seed);
      return db;
    })();
  }
  return g.__brahmoDb;
}

export class PgliteRepo implements Repo {
  backend = 'pglite' as const;
  private db!: PGlite;

  async init(): Promise<void> {
    this.db = await loadDb();
  }

  async getUsers(): Promise<User[]> {
    const res = await this.db.query<User>(
      `SELECT id, org_id, name, role, department, ceiling_level,
              write_ceiling, compliance_clearance, status
       FROM users ORDER BY ceiling_level ASC, name ASC`,
    );
    return res.rows;
  }

  async getUser(id: string): Promise<User | null> {
    const res = await this.db.query<User>(
      `SELECT id, org_id, name, role, department, ceiling_level,
              write_ceiling, compliance_clearance, status
       FROM users WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async getHierarchyLevels(orgId: string): Promise<HierarchyLevel[]> {
    const res = await this.db.query<HierarchyLevel>(
      `SELECT id, org_id, level_number, level_name, department, parent_ids, zone
       FROM hierarchy_levels WHERE org_id = $1 ORDER BY level_number ASC`,
      [orgId],
    );
    return res.rows;
  }

  async getOrgConfig(orgId: string): Promise<Record<string, unknown>> {
    const res = await this.db.query<{ config: Record<string, unknown> }>(
      `SELECT config FROM organizations WHERE id = $1`,
      [orgId],
    );
    return res.rows[0]?.config ?? {};
  }

  async totalNodeCount(orgId: string): Promise<number> {
    const res = await this.db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM knowledge_nodes WHERE org_id = $1`,
      [orgId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async countNodes(filter: NodeFilter): Promise<number> {
    const where = buildWhereClause(filter);
    const res = await this.db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM knowledge_nodes WHERE ${where}`,
    );
    return res.rows[0]?.n ?? 0;
  }

  async fetchNodes(filter: NodeFilter): Promise<KnowledgeNode[]> {
    const where = buildWhereClause(filter);
    const res = await this.db.query<KnowledgeNode>(
      `SELECT ${NODE_COLUMNS} FROM knowledge_nodes
       WHERE ${where} ORDER BY importance DESC, id ASC`,
    );
    return res.rows;
  }
}
