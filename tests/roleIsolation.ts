// Role-isolation verification: the "surprise test" from the assessment.
//
// The assessment grades whether the pipeline handles roles it was NOT tuned for
// WITHOUT unexpected inclusion of nodes that belong to other roles, departments,
// permission levels, or compliance tiers. verify.ts only checks Priya/Vikram/
// Suresh; this file asserts the three isolation invariants for EVERY seeded user
// AND for synthetic "surprise" profiles the docs name but the seed omits
// (notably the External Auditor: AUDITOR, L3, MNPI-allowed).
//
// Run: npm run verify:roles
import assert from 'node:assert';
import { getRepo } from '@/lib/repo';
import { runPipeline } from '@/lib/pipeline/runPipeline';
import type { NodeFilter, Repo } from '@/lib/repo/types';
import type { User } from '@/lib/types';

const SENSITIVE_TAGS = ['MNPI', 'PHI', 'CONFIDENTIAL'];
// Roles whose remit spans the whole org — cross-department reach is EXPECTED.
const CROSS_DEPARTMENT_ROLES = ['ADMIN', 'QUALITY', 'AUDITOR'];

// Wrap the real repo so runPipeline resolves a synthetic user with ZERO pipeline
// code changes — precisely what the assessment's surprise test does.
function withInjectedUser(repo: Repo, u: User): Repo {
  return new Proxy(repo, {
    get(target, prop) {
      if (prop === 'getUser')
        return async (id: string) => (id === u.id ? u : target.getUser(id));
      if (prop === 'getUsers')
        return async () => [u, ...(await target.getUsers())];
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  }) as Repo;
}

// Surprise profiles the assessment explicitly names (SURPRISE TEST section) but
// the seed data does not include.
const SURPRISE_USERS: User[] = [
  {
    id: 'U-AUDIT', org_id: 'supra', name: 'External Auditor', role: 'AUDITOR',
    department: 'external', ceiling_level: 3, write_ceiling: null,
    compliance_clearance: ['MNPI'], status: 'ACTIVE',
  },
  {
    id: 'U-CARDIONURSE', org_id: 'supra', name: 'Cardio Nurse', role: 'VIEWER',
    department: 'cardiology', ceiling_level: 10, write_ceiling: null,
    compliance_clearance: [], status: 'ACTIVE',
  },
];

// A filter matching every node in the org (all checks off) — used to look up the
// real compliance_tags of each candidate, since CandidateNode omits them.
const ALL_NODES_FILTER: NodeFilter = {
  orgId: 'supra', reachableLevelIds: [], includeZone2: true,
  applyIsolation: false, applyCompliance: false, blockedTags: [],
  applyPermission: false, readableLevelIds: [], applyTemporal: false,
  applyDerivability: false, derivabilityThreshold: 0.7,
};

async function main() {
  const repo = await getRepo();
  const seeded = await repo.getUsers();
  const allNodes = await repo.fetchNodes(ALL_NODES_FILTER);
  const tagsById = new Map(allNodes.map((n) => [n.id, n.compliance_tags ?? []]));

  const everyUser: Array<{ user: User; repo: Repo }> = [
    ...seeded.map((user) => ({ user, repo })),
    ...SURPRISE_USERS.map((user) => ({ user, repo: withInjectedUser(repo, user) })),
  ];

  console.log(`\nRole isolation — ${seeded.length} seeded + ${SURPRISE_USERS.length} surprise users\n`);
  console.log('user'.padEnd(20), 'role'.padEnd(9), 'ceil', 'final');
  console.log('-'.repeat(50));

  const counts: Record<string, number> = {};

  for (const { user, repo: r } of everyUser) {
    const result = await runPipeline(r, user.id);
    const cs = result.candidate_set;
    counts[user.id] = cs.length;
    const cleared = new Set(user.compliance_clearance ?? []);
    const crossOk = CROSS_DEPARTMENT_ROLES.includes(user.role);

    for (const n of cs) {
      // Invariant 1 — PERMISSION: no node below the user's ceiling, except the
      // globally-injected Zone 2 safety nodes (exempt by design).
      if (n.zone !== 2) {
        assert(
          n.hierarchy_level >= user.ceiling_level,
          `${user.name}: permission leak — ${n.id} at L${n.hierarchy_level} < ceiling ${user.ceiling_level}`,
        );
      }
      // Invariant 2 — ISOLATION: single-department roles never see another
      // department's nodes (dept-null and Zone 2 globals are shared, so allowed).
      if (!crossOk && n.department) {
        assert(
          n.department === user.department,
          `${user.name}: cross-department leak — ${n.id} belongs to ${n.department}`,
        );
      }
      // Invariant 3 — COMPLIANCE: no node carries a sensitive tag the user is
      // not cleared for.
      for (const tag of tagsById.get(n.id) ?? []) {
        if (SENSITIVE_TAGS.includes(tag)) {
          assert(
            cleared.has(tag),
            `${user.name}: compliance leak — ${n.id} is tagged ${tag} (clearance: [${[...cleared]}])`,
          );
        }
      }
    }

    console.log(
      user.name.padEnd(20),
      user.role.padEnd(9),
      String(user.ceiling_level).padEnd(4),
      cs.length,
    );
  }

  // Surprise-test intent checks (positive inclusion, not just exclusion):
  // an MNPI-cleared auditor MUST see the MNPI-only node, proving compliance is
  // data-driven, not hardcoded to exclude for everyone.
  const auditor = await runPipeline(withInjectedUser(repo, SURPRISE_USERS[0]), 'U-AUDIT');
  assert(
    auditor.candidate_set.some((n) => n.id === 'N-O11'),
    'MNPI-cleared auditor should see the MNPI-only node N-O11',
  );
  assert(
    !auditor.candidate_set.some((n) => n.id === 'N-O12'),
    'Auditor lacking CONFIDENTIAL clearance must NOT see N-O12 (MNPI+CONFIDENTIAL)',
  );

  // Anti-hardcoding: the surprise auditor's count must differ from the demo users.
  assert(
    counts['U-AUDIT'] !== counts['U-PRIYA'] && counts['U-AUDIT'] !== counts['U-VIKRAM'],
    'Surprise auditor produced a demo user\'s exact count — looks hardcoded',
  );

  console.log('\n✅ Role isolation: no unexpected inclusion across any role.\n');
}

main().catch((e) => {
  console.error('\n❌ Role isolation failed:', e.message);
  process.exit(1);
});
