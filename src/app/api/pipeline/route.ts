import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';
import { runPipeline } from '@/lib/pipeline/runPipeline';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.userId;
    const injectZone2: boolean = body.injectZone2 !== false;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const repo = await getRepo();
    const result = await runPipeline(repo, userId, { injectZone2 });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'pipeline error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
