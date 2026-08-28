# Data Sources — Clinical Content

This document records **where the clinical data in this demo came from** and how it
was constructed. It is a deliverable requirement: no real patient data is used, and
every clinical statement is either public-guideline-derived or entirely synthetic.

**TL;DR:** All data is **synthetic**. The *knowledge graph structure* (50 hierarchy
levels + nodes) is authored for this assessment. The *clinical substance* inside each
node is paraphrased from **publicly available clinical guidelines** and adapted to a
fictional hospital ("Supra"). There is **no real PHI** — patients, staff, INR values,
incident histories, and MNPI figures are invented.

---

## 1. What the "clinical data" is

The data lives in [`supabase/seed.sql`](../supabase/seed.sql) and consists of:

- **~28 hierarchy levels** — a fictional hospital org DAG (org → clinical division →
  departments → units/wards → patient rooms). Departments: ortho, medicine,
  cardiology, paediatrics, ICU, pharmacy, quality, admin.
- **~50 knowledge nodes** across four types: `CONSTRAINT` (16), `DECISION` (14),
  `FACT` (14), `ANTI_PATTERN` (6). Each carries `importance`, `zone`,
  `derivability_score`, `status`, `valid_until`, and `compliance_tags`.
- **7 seeded users** spanning VIEWER / EDITOR / HOD / ADMIN / QUALITY roles.

Nothing here is extracted from a real EHR, a real hospital, or any proprietary
dataset. It is a **teaching corpus** built to exercise the pipeline (BFS reach,
Zone-2 injection, isolation, compliance, temporal, derivability).

## 2. Provenance of the clinical substance

The *wording* of the clinical rules is paraphrased from well-known, publicly
available guidance so the demo reads as clinically plausible. None is copied
verbatim; all is summarised and re-attributed to fictional "Supra policy."

| Node(s) | Clinical topic | Public basis (paraphrased, not quoted) |
|---|---|---|
| `N-G01`, `N-O13`, `N-O14` | Warfarin ↔ NSAID GI-bleed interaction | Well-established anticoagulant interaction guidance (BNF / NICE anticoagulation advice) |
| `N-G02` | Penicillin ↔ cephalosporin cross-reactivity | Standard allergy/antimicrobial-stewardship teaching (~10% 1st-gen, <2% 3rd-gen) |
| `N-G04` | Hand hygiene | WHO "5 Moments for Hand Hygiene" |
| `N-M02`, `N-M08` | Sepsis bundle (1-hr lactate, 30 mL/kg, MAP<65) | Surviving Sepsis Campaign bundle concepts |
| `N-M03` | Insulin sliding-scale anti-pattern | General inpatient glycaemic-management guidance (basal-bolus over sliding-scale-only) |
| `N-C05` | DAPT duration post-drug-eluting-stent | ESC/ACC dual-antiplatelet-therapy duration guidance (6/12/36 months) |
| `N-C03` | Echo before MI discharge | General post-MI standard-of-care teaching |
| `N-O01`, `N-O11` | Post-op vitals / neurovascular checks | Generic post-operative monitoring practice |

> These are used **only as realistic flavour**. The pipeline's behaviour depends on
> the *metadata* (level, zone, tags, scores, status), not on the medical accuracy of
> the prose. Do not treat any node text as clinical advice.

## 3. Fully invented (no external source)

Everything below is fabricated for the demo and corresponds to **no real person,
hospital, or record**:

- **Hospital**: "Supra" — fictional. All org structure and department layout.
- **Patients**: e.g. "Rajan, 68M, AF, INR 2.4, GI bleed 2024" (`N-O13`/`N-O14`) —
  invented. INR values, dates, and incident histories are made up.
- **Staff**: Dr. Vikram, Dr. Sharma, Dr. Sunita, Dr. Ananya, Nurse Priya,
  Pharmacist Ravi, Admin Suresh — fictional.
- **MNPI / confidential nodes**: research-trial budgets, "ATOM-2026" trial,
  acquisition/financial figures — invented to exercise the compliance filter. Tags
  used: `MNPI`, `PHI`, `CONFIDENTIAL` (8 nodes total).
- **Superseded/expired records** (`N-M08` Sepsis v2, expired temporal nodes) —
  invented to exercise the temporal check.

## 4. Compliance & privacy statement

- **No real PHI / PII.** No data was sourced from patient records, an EHR, a
  hospital information system, or any identifiable individual.
- **No proprietary datasets.** No licensed or paywalled clinical database was
  ingested. Only publicly known clinical *concepts* were paraphrased.
- The `PHI` / `MNPI` / `CONFIDENTIAL` tags in the seed are **simulated
  sensitivity labels** for testing access control — not real classified content.

## 5. How to regenerate / extend

The corpus is hand-authored SQL, so it is fully inspectable and version-controlled:

- Structure: `supabase/schema.sql`
- Content: `supabase/seed.sql`
- Both backends (PGlite default, Supabase deploy) load the **same** two files, so the
  data source is identical regardless of runtime.

Adding a department, user, or node requires no pipeline code change — see
[`architecture.md`](architecture.md) §1.
