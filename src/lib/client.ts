'use client';
// Thin client-side API helpers.
import type { HierarchyLevel, PipelineResult, User } from '@/lib/types';

export async function fetchUsers(): Promise<{ backend: string; users: User[] }> {
  const r = await fetch('/api/users');
  if (!r.ok) throw new Error('failed to load users');
  return r.json();
}

export async function fetchHierarchy(): Promise<{ levels: HierarchyLevel[] }> {
  const r = await fetch('/api/hierarchy');
  if (!r.ok) throw new Error('failed to load hierarchy');
  return r.json();
}

export async function runPipeline(
  userId: string,
  injectZone2: boolean,
): Promise<PipelineResult> {
  const r = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, injectZone2 }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'pipeline failed');
  return data;
}
