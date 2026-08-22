import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';

export const runtime = 'nodejs';

export async function GET() {
  const repo = await getRepo();
  // Single-org demo; use the first user's org.
  const users = await repo.getUsers();
  const orgId = users[0]?.org_id ?? 'supra';
  const levels = await repo.getHierarchyLevels(orgId);
  return NextResponse.json({ levels });
}
