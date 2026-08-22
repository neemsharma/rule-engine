'use client';
import type { PipelineResult } from '@/lib/types';

function facts(r: PipelineResult) {
  const set = r.candidate_set;
  const has = (pred: (d: string | null) => boolean) => set.some((n) => pred(n.department));
  return {
    cardio: has((d) => d === 'cardiology'),
    mnpi: set.some((n) => n.id === 'N-O11' || n.id === 'N-O12' || n.id === 'N-A01'),
    zone2: set.some((n) => n.from_zone2),
    admin: set.some((n) => n.id === 'N-A01' || n.id === 'N-A02'),
  };
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>{ok ? '✓' : '✗'}</span>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

export function ComparisonView({ results }: { results: PipelineResult[] }) {
  const finalCount = (r: PipelineResult) =>
    r.funnel.find((s) => s.key === 'after_check5')?.count ?? r.candidate_set.length;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${results.length}, minmax(0,1fr))` }}>
      {results.map((r) => {
        const f = facts(r);
        const bfs = r.funnel.find((s) => s.key === 'after_bfs')?.count ?? 0;
        const z2 = r.funnel.find((s) => s.key === 'after_zone2')?.count ?? 0;
        return (
          <div key={r.user} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-sm font-semibold text-slate-100">{r.user_name}</div>
            <div className="text-[11px] text-slate-500">
              {r.role}, L{r.ceiling_level} · {r.department}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              <div>BFS reach: <span className="text-slate-200">{bfs}</span></div>
              <div>+ Zone 2: <span className="text-slate-200">{z2}</span></div>
              <div className="text-base font-bold text-emerald-400">
                After 5 checks: {finalCount(r)}
              </div>
              <div className="text-slate-500">{r.pipeline_timing.total_ms} ms</div>
            </div>
            <div className="mt-2 space-y-0.5 border-t border-slate-800 pt-2">
              <Row label="Ortho / own dept" ok={r.candidate_set.length > 0} />
              <Row label="Drug safety (Zone 2)" ok={f.zone2} />
              <Row label="Cardiology nodes" ok={f.cardio} />
              <Row label="MNPI nodes" ok={f.mnpi} />
              <Row label="Admin/board nodes" ok={f.admin} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
