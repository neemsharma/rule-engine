# BRAHMO Rules Engine — Architecture & Decision Record

BFS Traversal + 5-Check Filter Pipeline. **Zero LLM. Deterministic.** Given a
user profile and a DAG of 50 knowledge nodes, produce the exact candidate set
that user should see — different per user, from the same graph, in < 500 ms.

---

## 1. Data flow

```
User profile (role, ceiling, department, clearance)
  │
  ├─▶ 1. Permission Compiler   → O(1) {level → {can_read, can_write}} + blocked tags
  ├─▶ 2. Entry Point Resolver  → the DAG level where BFS starts
  ├─▶ 3. BFS Traversal (up)    → reachable level-ids + distance (visited set)
  ├─▶ 4. Zone 2 Injection      → global safety nodes added to the working set
  ├─▶ 5. Five-Check Filter     → sequential SQL WHERE clauses (the funnel)
  └─▶ 6. Candidate Assembler   → annotate survivors (type, distance, compression)
```

The pipeline code is **identical for every user**. Only the profile data
changes what comes out. This is what makes the surprise-test (a brand-new user)
work with zero code changes, and how the design resists hardcoding.

## 2. Stack (Option B — full Node.js)

| Layer | Choice |
|---|---|
| Runtime / API | **Next.js 16 (App Router) API routes** — no Python |
| Language | TypeScript |
| UI | React + Tailwind CSS |
| Data (default) | **PGlite** — embedded Postgres (WASM) in the Node server |
| Data (deploy) | **Supabase** (Postgres) — same schema, same SQL |

### Decision — one `NodeFilter` contract, two backends

The pipeline never talks to a specific database. It builds a declarative
`NodeFilter` (the 5 checks as data) and hands it to a `Repo`. Two `Repo`
implementations translate the same filter:

- `PgliteRepo` → a single SQL `WHERE` clause (`src/lib/repo/whereClause.ts`).
- `SupabaseRepo` → equivalent PostgREST predicates.

Why PGlite as default: the assessment stack is Supabase, but a reviewer can't be
handed a project that needs an account before it runs. PGlite is **real
Postgres**, so the checks still execute as **indexed SQL WHERE clauses inside the
database** (GAP 5 preserved), yet the whole thing runs offline with
`npm run dev`. Set `BRAHMO_BACKEND=supabase` + keys to flip to the hosted path —
no pipeline code changes.

## 3. The five checks are SQL, not JS (GAP 5)

`buildWhereClause()` compiles the enabled checks into one WHERE clause. The
funnel is produced by enabling **one predicate at a time** and asking Postgres to
`COUNT`, then a final `SELECT` returns only the surviving rows' full content.

**Restricted rows never leave the database.** We never fetch 50 nodes and filter
in JS — that would be the GAP-5 violation the brief calls out (restricted data
retrieved before the permission check, even if later discarded). Checks 1–4 are
indexed predicates; check 5 is a pre-computed score comparison. This is also the
scalability answer: at 15,000 nodes the traversal still touches only the user's
reachable subgraph, and the checks scale with indexes, not table size.

```sql
-- Illustrative final clause for Nurse Priya:
(hierarchy_level_id IN (...ortho+spine...) OR zone = 2)   -- BFS reach + Zone 2
AND org_id = 'supra'                                       -- Check 1 isolation
AND NOT (compliance_tags && ARRAY['MNPI','PHI','CONFIDENTIAL']::text[])  -- Check 2
AND (hierarchy_level_id IN (...readable...) OR zone = 2)   -- Check 3 permission
AND status NOT IN ('SUPERSEDED','EXPIRED')                -- Check 4 temporal
AND (valid_until IS NULL OR valid_until > NOW())          -- Check 4 temporal
AND derivability_score < 0.7                              -- Check 5 derivability
```

## 4. BFS strategy (the most important module)

The DAG is defined on **hierarchy levels** (`parent_ids` on
`hierarchy_levels`); nodes hang off levels. BFS runs on the level graph:

- **Edges UP (`parent_ids`): always traversed** — reach ancestors up to the root.
- **Edges DOWN (children): traversed only into the user's own department** — so a
  ward user still reaches sibling units they own (Ortho TKR unit, the
  multi-parent Post-TKR area) without leaking other departments from a shared
  ancestor (Clinical Division).
- **Cross-department roles (ADMIN / QUALITY / AUDITOR) descend into every
  child** — their remit spans the org; their ceiling + clearance then narrow what
  actually passes.

A **visited set** guarantees each level is processed once — this handles the
multi-parent Post-TKR node (Ortho **and** Surgery) and makes any accidental
cycle terminate (the graph is a DAG, but we don't trust the data to stay acyclic).

Distance from entry = BFS layer, used for the `compression_hint`.

**Why this shape and not pure "walk up":** pure upward traversal misses sibling
units the user genuinely owns; ungated descent from a shared ancestor leaks every
department. Department-gated descent gives correct isolation in a single BFS and
reproduces the assessment's expected reach (~20 levels/nodes for Priya).

## 5. Permission model

Compiled once per session into `{level_number → {can_read, can_write}}` — every
per-node check is then an O(1) map hit, never a DB round-trip (no N+1).

| Role | can_read | can_write |
|---|---|---|
| VIEWER | level ≥ ceiling | none |
| EDITOR | level ≥ ceiling | level ≥ write_ceiling |
| HOD | all | level ≥ ceiling |
| ADMIN | all | all |
| QUALITY | level ≥ ceiling | level ≥ write_ceiling |
| AUDITOR | level ≥ ceiling | none |

QUALITY and AUDITOR are **not** specified in the brief — they exist in the schema
but not the permission spec. We defined them (read like VIEWER/EDITOR, honoring
their `compliance_clearance`) so the surprise-test passes with zero code changes.

## 6. Resolved ambiguities / deviations from the brief

The provided brief is internally inconsistent in a few places. Each was resolved
deliberately; here is what and why.

### 6.1 Schema `UNIQUE(org_id, level_number, department)` is unsatisfiable
The provided seed has three Level-8 Ortho units, all `(supra, 8, 'ortho')`, which
violates the provided schema's own unique constraint. **Fix:** dropped that
constraint (the `id` primary key already guarantees uniqueness). See
`supabase/schema.sql`.

### 6.2 Permission check vs Zone 2 (the important one)
Check 3 is specified as `hierarchy_level >= ceiling`, and the brief's own note
says "levels < 10 are above Priya's ceiling → excluded." Taken literally this
also excludes **every Zone-2 global node** (they live at Level 3) — which would
break **Scenario 4 (a required demo showing drug-safety nodes present for
Priya).**

**Resolution:** keep `level ≥ ceiling` (it matches the target counts — Priya ~13,
Vikram ~21, Suresh ~42 — and makes the ceiling the clean per-user
differentiator), **but exempt Zone-2 nodes from the level check.** Global safety
constraints are hierarchy-independent by definition — that is the entire premise
of Zone 2 ("apply regardless of the user's traversal path"). Zone-2 nodes are
still subject to **compliance, temporal, and derivability** (e.g. the derivable
"normal vital signs" Zone-2 node `N-D03` at score 0.98, and hand-hygiene `N-G04`
at 0.75, are still filtered out). This keeps Scenario 4 working without weakening
the other checks.

### 6.3 Compliance is absolute, even for a HOD
The brief's Vikram note implies a HOD sees their department's MNPI budget node
(`N-O11`). But the evaluation criteria reward "MNPI nodes invisible to non-cleared
users" and "compliance tags enforced." A HOD seeing MNPI **without clearance**
would be a security gap. **Resolution:** compliance is absolute — a node is
excluded if its tags overlap the user's blocked tags, regardless of role. Vikram
(no clearance) does not see `N-O11`/`N-O12`; Sunita (MNPI) and Suresh (all) do.
We favored the security criteria over the narrative aside.

### 6.4 Entry point resolution
The brief hardcodes examples (Priya→ward, Vikram→dept, Suresh→root) but no rule.
**Resolution:** data-driven — among levels in the user's department, pick the one
whose `level_number` is closest to the user's `ceiling_level` (ties → deeper).
Departments with no level (pharmacy, quality, admin, or any surprise department)
fall back to the org root. This reproduces every hardcoded example without
per-user branching.

## 7. Candidate set contract

Each survivor is annotated for the downstream Composition Agent (not built here):
`id, type, title, content, importance, zone, hierarchy_level,
distance_from_entry, compression_hint, from_zone2`.

`compression_hint`: distance 0–1 → `FULL`, 2 → `COMPRESSED`, 3+ →
`CONSTRAINT_ONLY`. Zone-2 nodes bypass BFS, so they are treated as far
(constraint-only).

## 8. Silent exclusion

Unauthorized nodes are **absent**, never "denied." The API returns a smaller
candidate set with no error surface, no count of hidden nodes, no 403. An
attacker cannot learn that restricted nodes exist. This is enforced structurally:
excluded rows are filtered inside the SQL WHERE clause, so they are never even
materialized in the response.

## 9. Files

```
src/lib/pipeline/     the six modules (one file each) + runPipeline orchestrator
src/lib/repo/         Repo contract, PGlite + Supabase backends, whereClause builder
src/app/api/          /api/users, /api/hierarchy, /api/pipeline (nodejs runtime)
src/components/        FilterFunnel, DAGViewer, CandidateTable, ComparisonView
supabase/             schema.sql + seed.sql (shared by both backends)
tests/verify.ts       runs the real pipeline for all 7 users + asserts invariants
```
