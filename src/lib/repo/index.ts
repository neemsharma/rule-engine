// Factory: pick the backend from env. Defaults to the embedded PGlite database
// so the app runs with zero external setup. Set BRAHMO_BACKEND=supabase to use
// a real Supabase project.
import type { Repo } from './types';
import { PgliteRepo } from './pgliteRepo';
import { SupabaseRepo } from './supabaseRepo';

let cached: Promise<Repo> | null = null;

export function getRepo(): Promise<Repo> {
  if (!cached) {
    cached = (async () => {
      const backend = (process.env.BRAHMO_BACKEND ?? 'pglite').toLowerCase();
      const repo: Repo = backend === 'supabase' ? new SupabaseRepo() : new PgliteRepo();
      await repo.init();
      return repo;
    })();
  }
  return cached;
}

export type { Repo, NodeFilter } from './types';
