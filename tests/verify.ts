// Standalone verification: runs the real pipeline (PGlite) for every seeded
// user and asserts the assessment's core invariants. Run: npm run verify
import assert from 'node:assert';
import { getRepo } from '@/lib/repo';
import { runPipeline } from '@/lib/pipeline/runPipeline';

const CROSS_DEPT = ['cardiology', 'paediatrics', 'icu', 'medicine'];

function funnelMap(r: Awaited<ReturnType<typeof runPipeline>>) {
  return Object.fromEntries(r.funnel.map((s) => [s.key, s.count]));
}

async function main() {
  const repo = await getRepo();
  const users = await repo.getUsers();

  console.log(`\nBackend: ${repo.backend}   Users: ${users.length}\n`);
  console.log(
    'user'.padEnd(18),
    'entry'.padEnd(16),
    'bfs'.padEnd(5),
    '+z2'.padEnd(5),
    'final'.padEnd(6),
    'ms',
  );
  console.log('-'.repeat(70));

  const results: Record<string, Awaited<ReturnType<typeof runPipeline>>> = {};
  for (const u of users) {
    const r = await runPipeline(repo, u.id);
    results[u.id] = r;
    const f = funnelMap(r);
    console.log(
      `${u.name} (${u.role})`.padEnd(18),
      r.entry_point.padEnd(16),
      String(f.after_bfs).padEnd(5),
      String(f.after_zone2).padEnd(5),
      String(f.after_check5).padEnd(6),
      r.pipeline_timing.total_ms,
    );
  }

  console.log('\nRunning assertions...');
  const priya = results['U-PRIYA'];
  const vikram = results['U-VIKRAM'];
  const suresh = results['U-SURESH'];

  // Different users -> different candidate sets (anti-hardcoding).
  const pCount = priya.candidate_set.length;
  const vCount = vikram.candidate_set.length;
  const sCount = suresh.candidate_set.length;
  assert(pCount !== vCount, `Priya (${pCount}) and Vikram (${vCount}) must differ`);
  assert(vCount < sCount, `Vikram (${vCount}) should see fewer than Suresh (${sCount})`);
  assert(pCount <= vCount, `Priya (${pCount}) should see <= Vikram (${vCount})`);

  // Priya: zero cross-department nodes.
  for (const n of priya.candidate_set) {
    assert(
      !CROSS_DEPT.includes(n.department ?? ''),
      `Priya leaked cross-dept node ${n.id} (${n.department})`,
    );
  }
  // Priya: zero MNPI/CONFIDENTIAL nodes (no clearance).
  for (const n of priya.candidate_set) {
    assert(n.id !== 'N-O11' && n.id !== 'N-O12', `Priya leaked MNPI node ${n.id}`);
  }
  // Priya: superseded Sepsis v2 absent.
  assert(!priya.candidate_set.find((n) => n.id === 'N-M08'), 'Superseded node leaked');
  // Priya: high-derivability generic facts absent.
  for (const id of ['N-D01', 'N-D03', 'N-D04']) {
    assert(!priya.candidate_set.find((n) => n.id === id), `Derivable node ${id} leaked`);
  }
  // Priya: Zone-2 drug safety present.
  assert(priya.candidate_set.find((n) => n.id === 'N-G01'), 'Zone-2 Warfarin node missing');
  // Zone-2 derivable node must still be filtered.
  assert(!priya.candidate_set.find((n) => n.id === 'N-D03'), 'Zone-2 derivable N-D03 not filtered');

  // Suresh (ADMIN, full clearance) sees MNPI admin nodes.
  assert(suresh.candidate_set.find((n) => n.id === 'N-A01'), 'Admin should see N-A01');
  assert(suresh.candidate_set.find((n) => n.id === 'N-C04'), 'Admin should see cardio MNPI trial');

  // Zone-2 toggle: turning injection off drops the global drug-safety nodes.
  const priyaNoZone2 = await runPipeline(repo, 'U-PRIYA', { injectZone2: false });
  assert(
    !priyaNoZone2.candidate_set.find((n) => n.from_zone2),
    'Zone-2 off should remove all zone-2 nodes',
  );
  assert(
    priyaNoZone2.candidate_set.length < pCount,
    'Zone-2 off should shrink Priya set',
  );

  // Silent exclusion: result carries no "denied"/error surface, just fewer nodes.
  assert(!('error' in priya), 'no error surface');

  // Performance budget.
  assert(suresh.pipeline_timing.total_ms < 500, `Suresh pipeline ${suresh.pipeline_timing.total_ms}ms > 500ms`);

  console.log('\nZone-2 toggle: Priya', pCount, '->', priyaNoZone2.candidate_set.length, '(zone2 off)');
  console.log('\n✅ All assertions passed.\n');
}

main().catch((e) => {
  console.error('\n❌ Verification failed:', e.message);
  process.exit(1);
});
