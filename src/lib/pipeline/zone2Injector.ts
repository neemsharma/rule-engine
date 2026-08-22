// ============================================================
// Module 4 — Zone 2 Injector
//
// After BFS, hospital-wide GLOBAL nodes (zone = 2) are injected into the
// working set regardless of the user's traversal path — drug-safety
// constraints that must be present in EVERY session. They are injected BEFORE
// the 5 checks, so they are still filtered (a Zone-2 node that is MNPI, expired,
// or derivable is still removed). Injection here is expressed as a flag on the
// NodeFilter (`includeZone2`) so the same SQL WHERE clause covers reachable
// nodes OR zone=2 in one pass. The flag is toggleable for the Scenario-4 demo.
// ============================================================

import type { PipelineOptions } from '@/lib/types';

export function shouldInjectZone2(options: PipelineOptions): boolean {
  return options.injectZone2 !== false;
}
