# BRAHMO Rules Engine — BFS Traversal + 5-Check Filter Pipeline

Make the AI see **only what this user should see.** Given a DAG of 50 knowledge
nodes and a user profile, this pipeline produces the exact candidate set that
user should see — different per user, from the same graph, in under 500 ms,
with **zero LLM calls**.

> Assessment 01 · Stack **Option B (full Node.js)**: Next.js API routes + React +
> Tailwind. Data runs on an **embedded Postgres (PGlite)** out of the box, and is
> **Supabase-ready** (same schema, same SQL).

---

## Quick start (zero external setup)

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it — no database account, no keys. The app boots an embedded Postgres
(PGlite), loads `supabase/schema.sql` + `supabase/seed.sql`, and runs the real
SQL pipeline locally.

Verify the pipeline logic from the command line:

```bash
npm run verify       # runs the pipeline for all 7 users and asserts invariants
npm run typecheck
```

## What you'll see

- **User dropdown** (7 seeded users) + **Run Pipeline** + a **Zone 2** toggle.
- **Stage cards**: Total → BFS reach → +Zone 2 → 5-Check final.
- **Filter funnel**: count remaining after every stage, with per-check removals.
- **DAG viewer**: reachable vs unreachable levels, entry point, multi-parent, Zone 2.
- **Candidate set**: survivors grouped by type with importance / distance /
  compression-hint metadata.
- **Comparison view**: Priya vs Vikram vs Suresh side-by-side from the same graph.
- **Timing**: total ms + per-check breakdown, "0 LLM calls".

Expected final counts: **Priya (VIEWER L10) ≈ 13 · Vikram (HOD L4) ≈ 21 ·
Suresh (ADMIN L1) ≈ 42** — different users, same graph.

## The four demo scenarios

1. **Core pipeline** — select Nurse Priya, watch 50 → 20 (BFS) → 31 (+Zone 2) → 13.
2. **Same graph, different user** — switch to Dr. Vikram; count jumps to ~21. Same
   code path, only the profile changed.
3. **Silent exclusion** — Priya's set contains zero Cardiology / Paediatrics /
   ICU / MNPI nodes, with no error and no "hidden" count. They're absent, not denied.
4. **Zone 2 saves lives** — toggle **Inject Zone 2** off; Priya's drug-safety
   nodes (Warfarin–NSAID, etc.) disappear (13 → 5). Toggle on; they return.

## Switching to Supabase (deploy path)

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` → `.env.local` and set:
   ```
   BRAHMO_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. `npm run dev`. No pipeline code changes — the same `NodeFilter` is translated
   to PostgREST predicates.

## How it works

DAG → BFS (upward, department-gated, visited set) → Zone 2 injection → five
**sequential SQL** checks (isolation · compliance · permission · temporal ·
derivability) → annotated candidate set. The five checks run as indexed
`WHERE` clauses **inside Postgres**, so restricted rows never leave the database
(GAP 5). Permissions are compiled once per session into an O(1) lookup.

Full design, BFS rationale, filter ordering, and every resolved ambiguity are in
**[`docs/architecture.md`](docs/architecture.md)**.

## Project structure

```
src/
  app/
    page.tsx                    main pipeline demo page
    api/{users,hierarchy,pipeline}/route.ts
  components/                   FilterFunnel · DAGViewer · CandidateTable · ComparisonView
  lib/
    pipeline/                   permissionCompiler · entryPointResolver · bfsTraversal
                                zone2Injector · fiveCheckFilter · candidateAssembler · runPipeline
    repo/                       Repo contract · pgliteRepo · supabaseRepo · whereClause
    types.ts
supabase/schema.sql · seed.sql  shared by both backends
docs/architecture.md
tests/verify.ts
```

## Notes

- **Zero LLM** anywhere in the pipeline — every decision is a binary predicate.
- Derivability is a **pre-computed** score on each node (per the brief), not a
  runtime model call.
- Adding a department or a user requires **no code changes** — the pipeline reads
  everything from the graph and the user profile.
