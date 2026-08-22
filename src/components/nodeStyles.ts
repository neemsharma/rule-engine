import type { NodeType } from '@/lib/types';

export const TYPE_META: Record<NodeType, { label: string; dot: string; text: string }> = {
  CONSTRAINT: { label: '🔴 CONSTRAINT', dot: 'bg-rose-500', text: 'text-rose-300' },
  DECISION: { label: '🟡 DECISION', dot: 'bg-amber-400', text: 'text-amber-200' },
  ANTI_PATTERN: { label: '🟠 ANTI_PATTERN', dot: 'bg-orange-500', text: 'text-orange-200' },
  FACT: { label: '🔵 FACT', dot: 'bg-sky-400', text: 'text-sky-200' },
};

export const COMPRESSION_META: Record<string, string> = {
  FULL: 'bg-emerald-500/20 text-emerald-300',
  COMPRESSED: 'bg-amber-500/20 text-amber-300',
  CONSTRAINT_ONLY: 'bg-slate-500/20 text-slate-300',
};
