// ============================================================
// Supabase backend — the production / deploy path.
//
// Translates the SAME NodeFilter into PostgREST predicates. Each check is an
// AND-ed filter group applied server-side, so restricted rows are filtered in
// Postgres before they cross the network (GAP 5). Swap this in by setting
// BRAHMO_BACKEND=supabase plus NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Repo, NodeFilter } from './types';
import type { User, HierarchyLevel, KnowledgeNode } from '@/lib/types';

const NODE_COLUMNS =
  'id, org_id, hierarchy_level_id, type, title, content, importance, zone, status, derivability_score, compliance_tags, valid_until, department';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

function applyFilter(base: Query, f: NodeFilter): Query {
  let q = base;

  // Structural reach OR Zone 2.
  const reach = f.reachableLevelIds.length
    ? `hierarchy_level_id.in.(${f.reachableLevelIds.join(',')})`
    : 'hierarchy_level_id.eq.__none__';
  q = f.includeZone2 ? q.or(`${reach},zone.eq.2`) : q.or(reach);

  if (f.applyIsolation) q = q.eq('org_id', f.orgId);

  if (f.applyCompliance && f.blockedTags.length) {
    q = q.not('compliance_tags', 'ov', `{${f.blockedTags.join(',')}}`);
  }

  if (f.applyPermission) {
    const perm = f.readableLevelIds.length
      ? `hierarchy_level_id.in.(${f.readableLevelIds.join(',')})`
      : 'hierarchy_level_id.eq.__none__';
    q = q.or(`${perm},zone.eq.2`);
  }

  if (f.applyTemporal) {
    q = q
      .not('status', 'in', '(SUPERSEDED,EXPIRED)')
      .or('valid_until.is.null,valid_until.gt.now()');
  }

  if (f.applyDerivability) {
    q = q.lt('derivability_score', f.derivabilityThreshold);
  }

  return q;
}

export class SupabaseRepo implements Repo {
  backend = 'supabase' as const;
  private client!: SupabaseClient;

  async init(): Promise<void> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Supabase backend selected but NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set.',
      );
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('ceiling_level', { ascending: true });
    if (error) throw error;
    return (data ?? []) as User[];
  }

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as User) ?? null;
  }

  async getHierarchyLevels(orgId: string): Promise<HierarchyLevel[]> {
    const { data, error } = await this.client
      .from('hierarchy_levels')
      .select('*')
      .eq('org_id', orgId)
      .order('level_number', { ascending: true });
    if (error) throw error;
    return (data ?? []) as HierarchyLevel[];
  }

  async getOrgConfig(orgId: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client
      .from('organizations')
      .select('config')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw error;
    return ((data?.config as Record<string, unknown>) ?? {});
  }

  async totalNodeCount(orgId: string): Promise<number> {
    const { count, error } = await this.client
      .from('knowledge_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);
    if (error) throw error;
    return count ?? 0;
  }

  async countNodes(filter: NodeFilter): Promise<number> {
    const base = this.client
      .from('knowledge_nodes')
      .select('*', { count: 'exact', head: true });
    const { count, error } = await applyFilter(base, filter);
    if (error) throw error;
    return count ?? 0;
  }

  async fetchNodes(filter: NodeFilter): Promise<KnowledgeNode[]> {
    const base = this.client
      .from('knowledge_nodes')
      .select(NODE_COLUMNS)
      .order('importance', { ascending: false });
    const { data, error } = await applyFilter(base, filter);
    if (error) throw error;
    return (data ?? []) as KnowledgeNode[];
  }
}
