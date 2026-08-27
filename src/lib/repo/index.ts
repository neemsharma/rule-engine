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
    // Don't cache a failed init: otherwise a bad config poisons the process and
    // every later request fails even once the config is corrected.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

export type { Repo, NodeFilter } from './types';
