'use client';
import { useMemo } from 'react';
import type { CandidateNode, NodeType } from '@/lib/types';
import { TYPE_META, COMPRESSION_META } from './nodeStyles';

const ORDER: NodeType[] = ['CONSTRAINT', 'DECISION', 'ANTI_PATTERN', 'FACT'];

export function CandidateTable({ nodes }: { nodes: CandidateNode[] }) {
  const grouped = useMemo(() => {
    const g: Record<string, CandidateNode[]> = {};
    for (const n of nodes) (g[n.type] ??= []).push(n);
    return g;
  }, [nodes]);

  return (
    <div className="space-y-4">
      {ORDER.filter((t) => grouped[t]?.length).map((type) => (
        <div key={type}>
          <div className={`mb-1.5 text-sm font-semibold ${TYPE_META[type].text}`}>
            {TYPE_META[type].label}{' '}
            <span className="text-slate-500">({grouped[type].length})</span>
          </div>
          <ul className="space-y-1.5">
            {grouped[type].map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-100">{n.title}</span>
                  {n.from_zone2 && (
                    <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                      ◆ ZONE 2
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{n.content}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono text-slate-400">{n.id}</span>
                  <span>importance {n.importance.toFixed(2)}</span>
                  <span>· L{n.hierarchy_level}</span>
                  <span>· dist {n.distance_from_entry}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      COMPRESSION_META[n.compression_hint] ?? ''
                    }`}
                  >
                    {n.compression_hint}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {nodes.length === 0 && (
        <p className="text-sm text-slate-500">No nodes in candidate set.</p>
      )}
    </div>
  );
}
