'use client';
import type { FunnelStage } from '@/lib/types';

const CHECK_KEYS = new Set([
  'after_check1',
  'after_check2',
  'after_check3',
  'after_check4',
  'after_check5',
]);

export function FilterFunnel({ funnel }: { funnel: FunnelStage[] }) {
  const total = funnel[0]?.count || 1;
  return (
    <div className="space-y-1.5">
      {funnel.map((s) => {
        const pct = Math.max(2, (s.count / total) * 100);
        const isCheck = CHECK_KEYS.has(s.key);
        const isFinal = s.key === 'after_check5';
        return (
          <div key={s.key} className="flex items-center gap-3 text-sm">
            <div className="w-40 shrink-0 text-right text-slate-400">{s.label}</div>
            <div className="relative h-6 flex-1 rounded bg-slate-800/60">
              <div
                className={`h-6 rounded transition-all duration-500 ${
                  isFinal
                    ? 'bg-emerald-500'
                    : isCheck
                      ? 'bg-sky-500/80'
                      : 'bg-slate-500/70'
                }`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute left-2 top-0 flex h-6 items-center text-xs font-semibold text-white">
                {s.count}
              </span>
            </div>
            <div className="w-24 shrink-0 text-xs text-rose-400">
              {s.removed > 0 ? `−${s.removed}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
