'use client';
import { useCallback, useEffect, useState } from 'react';
import type { HierarchyLevel, PipelineResult, User } from '@/lib/types';
import { fetchHierarchy, fetchUsers, runPipeline } from '@/lib/client';
import { FilterFunnel } from '@/components/FilterFunnel';
import { DAGViewer } from '@/components/DAGViewer';
import { CandidateTable } from '@/components/CandidateTable';
import { ComparisonView } from '@/components/ComparisonView';

const COMPARE_DEFAULT = ['U-PRIYA', 'U-VIKRAM', 'U-SURESH'];

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [backend, setBackend] = useState<string>('');
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [userId, setUserId] = useState<string>('U-PRIYA');
  const [injectZone2, setInjectZone2] = useState(true);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<PipelineResult[] | null>(null);

  useEffect(() => {
    fetchUsers().then((d) => {
      setUsers(d.users);
      setBackend(d.backend);
    });
    fetchHierarchy().then((d) => setLevels(d.levels));
  }, []);

  const run = useCallback(async (uid: string, z2: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await runPipeline(uid, z2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(userId, injectZone2);
  }, [userId, injectZone2, run]);

  const runCompare = useCallback(async () => {
    const rs = await Promise.all(COMPARE_DEFAULT.map((u) => runPipeline(u, true)));
    setCompare(rs);
  }, []);

  const t = result?.pipeline_timing;
  const selectedUser = users.find((u) => u.id === userId);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 text-slate-200">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            BRAHMO Rules Engine — BFS + 5-Check Filter Pipeline
          </h1>
          <p className="text-sm text-slate-400">
            Knowledge graph → candidate set. Deterministic ·{' '}
            <span className="font-semibold text-emerald-400">ZERO LLM</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">
            backend: <span className="font-mono text-sky-300">{backend || '…'}</span>
          </span>
        </div>
      </header>

      {/* Controls */}
      <section className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">User</label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.role}, L{u.ceiling_level}, {u.department}
            </option>
          ))}
        </select>

        <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={injectZone2}
            onChange={(e) => setInjectZone2(e.target.checked)}
            className="h-4 w-4 accent-indigo-500"
          />
          Inject Zone 2 (global safety)
        </label>

        <button
          onClick={() => run(userId, injectZone2)}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {loading ? 'Running…' : 'Run Pipeline'}
        </button>

        {selectedUser && (
          <span className="text-xs text-slate-500">
            Entry: <span className="text-slate-300">{result?.entry_point_name}</span> · clearance:{' '}
            {selectedUser.compliance_clearance.length
              ? selectedUser.compliance_clearance.join(', ')
              : 'none'}
          </span>
        )}
      </section>

      {error && (
        <div className="mb-4 rounded border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Stage cards */}
          <section className="mb-5 grid grid-cols-4 gap-3">
            {[
              { label: 'TOTAL', value: result.total_nodes, sub: 'nodes', color: 'text-slate-300' },
              {
                label: 'BFS REACH',
                value: result.funnel.find((s) => s.key === 'after_bfs')?.count,
                sub: 'reachable',
                color: 'text-sky-300',
              },
              {
                label: '+ ZONE 2',
                value: result.funnel.find((s) => s.key === 'after_zone2')?.count,
                sub: 'combined',
                color: 'text-indigo-300',
              },
              {
                label: '5-CHECK',
                value: result.candidate_set.length,
                sub: 'final',
                color: 'text-emerald-400',
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-center"
              >
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">
                  {c.label}
                </div>
                <div className={`text-3xl font-bold ${c.color}`}>{c.value ?? '—'}</div>
                <div className="text-[11px] text-slate-500">{c.sub}</div>
              </div>
            ))}
          </section>

          {/* Funnel + timing */}
          <section className="mb-5 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Filter funnel</h2>
            <FilterFunnel funnel={result.funnel} />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-400">
                Pipeline time: {t?.total_ms} ms
              </span>
              <span>perm {t?.permission_compile_ms}ms</span>
              <span>entry {t?.entry_resolve_ms}ms</span>
              <span>bfs {t?.bfs_ms}ms</span>
              <span>zone2 {t?.zone2_inject_ms}ms</span>
              <span>c1 {t?.check1_isolation_ms}ms</span>
              <span>c2 {t?.check2_compliance_ms}ms</span>
              <span>c3 {t?.check3_permission_ms}ms</span>
              <span>c4 {t?.check4_temporal_ms}ms</span>
              <span>c5 {t?.check5_derivability_ms}ms</span>
              <span className="font-semibold text-emerald-400">0 LLM calls</span>
            </div>
          </section>

          {/* DAG + candidate set */}
          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">
                DAG — reachable vs unreachable
              </h2>
              <DAGViewer
                levels={levels}
                reachableIds={result.reachable_level_ids}
                entryId={result.entry_point}
              />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">
                Candidate set ({result.candidate_set.length} nodes)
              </h2>
              <CandidateTable nodes={result.candidate_set} />
            </div>
          </section>
        </>
      )}

      {/* Comparison */}
      <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            Comparison — same graph, different users
          </h2>
          <button
            onClick={runCompare}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            Run Priya · Vikram · Suresh
          </button>
        </div>
        {compare ? (
          <ComparisonView results={compare} />
        ) : (
          <p className="text-xs text-slate-500">
            Click to run the pipeline for three users side-by-side.
          </p>
        )}
      </section>
    </main>
  );
}
