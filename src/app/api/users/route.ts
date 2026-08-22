import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';

export const runtime = 'nodejs';

export async function GET() {
  const repo = await getRepo();
  const users = await repo.getUsers();
  return NextResponse.json({ backend: repo.backend, users });
}
