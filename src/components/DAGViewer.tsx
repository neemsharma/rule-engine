'use client';
import { useMemo } from 'react';
import type { HierarchyLevel } from '@/lib/types';

interface Props {
  levels: HierarchyLevel[];
  reachableIds: string[];
  entryId: string | null;
}

export function DAGViewer({ levels, reachableIds, entryId }: Props) {
  const reachable = useMemo(() => new Set(reachableIds), [reachableIds]);

  // Build a tree using the first parent for layout (DAG rendered as a tree).
  const { roots, childrenOf } = useMemo(() => {
    const byId = new Map(levels.map((l) => [l.id, l]));
    const childrenOf = new Map<string, HierarchyLevel[]>();
    const roots: HierarchyLevel[] = [];
    for (const l of levels) {
      const parent = (l.parent_ids ?? [])[0];
      if (parent && byId.has(parent)) {
        (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(l);
      } else {
        roots.push(l);
      }
    }
    for (const arr of childrenOf.values())
      arr.sort((a, b) => a.level_number - b.level_number || a.id.localeCompare(b.id));
    return { roots, childrenOf };
  }, [levels]);

  function render(level: HierarchyLevel, depth: number): React.ReactNode {
    const isReachable = reachable.has(level.id);
    const isEntry = level.id === entryId;
    const isZone2 = level.zone === 2;
    const multiParent = (level.parent_ids ?? []).length > 1;
    const marker = isZone2 ? '◆' : isReachable ? '●' : '○';
    const markerColor = isZone2
      ? 'text-indigo-400'
      : isReachable
        ? 'text-emerald-400'
        : 'text-slate-600';
    return (
      <div key={level.id}>
        <div
          className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs ${
            isEntry ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : ''
          }`}
          style={{ marginLeft: depth * 14 }}
        >
          <span className={markerColor}>{marker}</span>
          <span className="font-mono text-[10px] text-slate-500">L{level.level_number}</span>
          <span className={isReachable ? 'text-slate-200' : 'text-slate-500'}>
            {level.level_name}
          </span>
          {multiParent && (
            <span className="rounded bg-fuchsia-500/20 px-1 text-[9px] text-fuchsia-300">
              multi-parent
            </span>
          )}
          {isEntry && (
            <span className="rounded bg-emerald-500/30 px-1 text-[9px] font-semibold text-emerald-200">
              ← ENTRY
            </span>
          )}
        </div>
        {(childrenOf.get(level.id) ?? []).map((c) => render(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {roots.map((r) => render(r, 0))}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        <span><span className="text-emerald-400">●</span> reachable</span>
        <span><span className="text-slate-600">○</span> not reachable</span>
        <span><span className="text-indigo-400">◆</span> Zone 2 (global)</span>
      </div>
    </div>
  );
}
