# WorkSpec 2 constraint-completeness dogfood

> Historical baseline: this report describes library coverage before constraints were retained. See [AI-CONSTRAINT-AUTHORING-DOGFOOD.md](AI-CONSTRAINT-AUTHORING-DOGFOOD.md) for the subsequent authored-constraint experiment and current representation.

Run date: 2026-09-09. This is a small executable dogfood study, not a statistical benchmark. The question is whether the currently checked-in constraint coverage rejects plausible semantic damage when a WorkSpec remains valid, runs successfully, and preserves its headline output.

## Important coverage boundary

The six entries in `web/assets/static/simulation-library.json` contain Starting State plus Changes, but no authored `constraints` or `generator` field ([library entry shape](../../web/assets/static/simulation-library.json:4-17)). The only checked-in executable library-wide constraint is synthetic `inventory.non_negative`, defined by the headless test itself ([test-headless-snapshot.js](scripts/test-headless-snapshot.js:17-31)); it is not a per-model library constraint. The capacity and cold-chain constraints discussed in the earlier repair note are evidence from that experiment, but their constraint source is not retained ([AI-REPAIR-DOGFOOD.md](AI-REPAIR-DOGFOOD.md:9-13)).

Accordingly, the primary score below uses only the reproducible checked-in coverage: validation, snapshot execution, and the synthetic inventory constraint. Reconstructed domain constraints are reported separately as positive controls and follow-up demonstrations, never mixed into the score.

The CLI exposes separate `validate`, `snapshot`, and `constraints` commands ([CLI](bin/workspec.js:18-27)). Runtime constraints receive read-only `state`, `stateAt`, `get`, `getAt`, and `times` ([runtime](workspec-runtime.js:2358-2403)); structured violations carry IDs, times, objects, properties, and observed/expected evidence ([runtime](workspec-runtime.js:2333-2355)).

## Six-model healthy baseline

These are the independent CLI results for every library entry. Each Starting State was copied to a fresh OS temporary directory and run as a subprocess with seed 1. Every validation, snapshot, and constraint command exited 0; snapshots had no runtime errors; constraints had no violations.

| Simulation | Validation warnings / info | Snapshot time | Headline output |
| --- | ---: | ---: | --- |
| `breadmaking` | 1 / 3 | 645 (10:45) | `baked_bread.quantity = 4` |
| `ecommerce_order` | 1 / 2 | 665 (11:05) | `packed_order.quantity = 1` |
| `electronics_assembly` | 1 / 7 | 805 (13:25) | `finished_phones.quantity = 12` |
| `pharmaceutical_production` | 1 / 9 | 1365 (22:45) | `finished_drug_product.quantity = 380` |
| `restaurant_kitchen` | 1 / 10 | 1320 (22:00) | `finished_entrees.quantity = 21` |
| `coffee-shop-multiperiod` | 0 / 2 | 18180 (day 13, 15:00) | `coffee_beans.quantity = 10` |

The warning/info counts are historical Starting State diagnostics from before the validation-layer correction. Current 2.2 document validation does not report resources as unused based only on declarative state; bounded utilization is evaluated by project/history validation. See the corrected context in the [baseline notes](SIMULATION-LIBRARY-DOGFOOD.md:9-24).

## Primary adversarial set: current checked-in coverage

Each mutation was independently created or replayed in an isolated temporary project. All six remained structurally valid, completed without runtime errors, preserved the headline output, and passed the checked-in `inventory.non_negative` constraint. The semantic damage is therefore invisible to current coverage.

| Simulation / intended behavior | Mutation and resolved evidence | Validation / runtime / headline | Constraint result | Classification | Query API |
| --- | --- | --- | --- | --- | --- |
| Bread recipe consumes 3 kg flour per batch | Changes `flour` `-3 → -1`; final flour `49 kg`; 4 loaves | valid / success / preserved | pass; no violations | missing recipe/material-balance invariant | sufficient to compare resolved stock, but no causal attribution |
| Electronics BOM consumes 12 memory chips for batch 1 | Batch-1 memory change `-12 → -6`; final memory `378`; 12 phones | valid / success / preserved | pass; no violations | missing BOM/yield invariant | sufficient to inspect quantities with `get`/`getAt` |
| Pharmaceutical tablet blend consumes 50 units | Blend consumption `-50 → -25`; remaining blend `25`; 380 packages | valid / success / preserved | pass; no violations | missing process material-balance invariant | sufficient to inspect remaining quantity |
| Electronics conveyor retains operating headroom | Conveyor capacity `10 → 8`; observed batch fits exactly; 12 phones | valid / success / preserved | pass; no violations | missing safety-margin policy | sufficient for capacity-vs-throughput, but no policy was present |
| Restaurant cold-appetizer recipe consumes 1.5 kg greens | `-1.5 → -1`; final greens `4` instead of `3.5`; 21 entrees | valid / success / preserved | pass; no violations | missing recipe/yield policy | sufficient for resolved quantities |
| Coffee day-13 service is assigned to lead barista Alice | `day_13_weekend_service.actor_id: barista_alice → manager`; output unchanged (`10` beans, `35` lattes) | valid / success / preserved | pass; no violations | missing staffing-role invariant | yes: `stateAt()` exposes active reservations, including the task/resource assignment; `getAt()` itself only targets objects/locations |

Primary detection rate: **0/6 = 0%**. This is the useful completeness result for what a fresh checkout can actually reproduce today. The first three survivors are the strongest evidence: they alter domain quantities while preserving both production output and non-negative inventory.

## Positive controls and follow-up demonstrations (unscored)

The known negative-inventory mutations remain useful calibration: reducing bread flour to 2 kg produces `flour.quantity = -1`, and analogous library cases produce negative inventory; the synthetic constraint catches those observable safety failures ([headless test](scripts/test-headless-snapshot.js:130-179)). A reconstructed cold-chain temperature check caught a 12 C restaurant walk-in, and a reconstructed capacity check caught throughput above capacity. These are positive controls, not evidence that the library currently carries those constraints.

For the three material-balance survivors, I separately demonstrated minimal domain-truth constraints without changing the runtime or library. They passed all three healthy baselines and caught all three mutations using the existing query API:

| Constraint ID | Mutation caught | Evidence |
| --- | --- | --- |
| `bread.recipe.flour_per_batch` | flour `-3 → -1` | observed `1`, expected `3` |
| `electronics.bom.memory_chips` | memory `-12 → -6` | observed `22`, expected `28` |
| `pharma.flow.tablet_blend_consumed` | blend `-50 → -25` | observed remaining `25`, expected `0` |

These follow-ups show that the three missing invariants are expressible with `get`/`getAt`; they are demonstrations of how to close the gaps, not part of the 0/6 current-coverage score. They do not establish causal provenance: a resolved-value constraint can reject the wrong result but cannot say which Changes handler wrote it.

The coffee case is still a missing model invariant, but not an API limitation. `serialiseState` materializes objects, locations, task statuses/runtime, active tasks, reservations, collections, and work definitions ([runtime](workspec-runtime.js:1794-1827)). At day 13 09:00, `stateAt()` exposes the active `day_13_weekend_service` reservation with resource `barista_alice` (or `manager` in the mutation), so a staffing-role constraint can inspect the assignment. `getAt()` only targets objects/locations, but the broader `stateAt()` snapshot is sufficient. No genuine query limitation was found.

## Reproduction appendix

For each case, `<tmp>` was a fresh `mktemp -d` directory containing `start.workspec.json`, `changes.workspec.js`, and (for the constraint command) `constraints.workspec.js`:

```sh
node packages/workspec/bin/workspec.js validate <tmp>/start.workspec.json --json
node packages/workspec/bin/workspec.js snapshot <tmp>/start.workspec.json \
  --changes <tmp>/changes.workspec.js --time <minutes> --seed 1 --json
node packages/workspec/bin/workspec.js constraints <tmp>/start.workspec.json \
  --changes <tmp>/changes.workspec.js \
  --constraints <tmp>/constraints.workspec.js \
  --time <minutes> --seed 1 --json --yes
```

The existing headless test uses the same temporary-project/subprocess pattern ([scripts/test-headless-snapshot.js](scripts/test-headless-snapshot.js:130-179)) and independently exercises temporal `stateAt`/`getAt` evidence ([same test](scripts/test-headless-snapshot.js:182-228)).

Conclusion: current checked-in library coverage detects basic non-negative inventory failures but detects none of six plausible semantic mutations that preserve output. All six gaps are expressible as domain constraints with the existing API. Constraint completeness therefore depends on explicitly modelling recipes, BOMs, process flows, margins, and staffing intent—not only checking that a simulation runs and finishes plausibly.
