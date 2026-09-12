# WorkSpec 2.2 staged AI-modelling dogfood

Run date: 2026-09-09. This is one fresh end-to-end case study, not a benchmark. The model follows two reusable implant trays through hospital sterile processing. It was built from a process description and primary-source research rather than copied from the six Simulation Library models.

## Result

Yes, with an important qualification: the staged workflow produced a coherent, executable formal model and materially improved it through blind adversarial review without any WorkSpec-specific architectural change. The healthy final project validates, snapshots without runtime errors at its full horizon, deterministically replays for a fixed seed, releases two trays, and passes all retained constraints. The blind first-pass constraints caught only **1/10** plausible mutations; four grounded follow-ups raise coverage to **5/10**. The five deliberately unclosed survivors are duration or policy questions the source/model does not settle, a legitimate staffing alternative, or a changed external cycle identity whose authority is not represented locally.

This supports making staged generation the normal AI workflow, provided that independent semantic review is mandatory and survivor count is not treated as a target to optimise. The useful target is a small set of defensible domain truths.

## Stage 0 — information needed

The useful source material was modest: 88 lines of notes distilled from official CDC, FDA, and OSHA guidance. Modelling could begin once seven facts were clear:

1. cleaning precedes inspection, packaging, and sterilisation;
2. instruments are dry, visibly clean, functional, and compatibly packaged before loading;
3. load configuration stays within validated equipment limits;
4. each load has mechanical and chemical monitoring;
5. an implant load receives a BI and remains quarantined until a negative result whenever possible;
6. packages cool and remain dry/intact before release;
7. a pre-vacuum steriliser passes its daily air-removal test before its first processed load.

Exact equipment capacities, task durations, total cycle/drying/cooling time, BI latency, staffing split, and device IFU were not universal facts. They were made visible as scenario assumptions or retained as ambiguities. See [PROCESS-RESEARCH.md](PROCESS-RESEARCH.md).

Approximate change: **88 research-note lines**; no WorkSpec source.

## Stage 1 — world structure and Starting State

The smallest useful world has six locations, four human roles, three constrained machines, six tray-flow states, four consumable stocks, and one traceable implant-load record. Eleven tasks cover the daily readiness check and one load from receipt to release. [WORLD-MODEL.md](WORLD-MODEL.md) records the structure/behaviour boundary.

Starting State validation found two useful construction errors:

- custom object type `record` lacked a type definition;
- changing it to built-in `digital_object` exposed that this built-in requires numeric `quantity` and string `state`.

The final choice was a single stateful/quantifiable `digital_object`, avoiding an unnecessary custom type. Validation then exited 0 with five expected informational `object.optimization.unused_resource` notices: the declarative validator cannot see later consumption authored in Changes.

Approximate change: **28 world-model lines and 315 Starting State lines**. The constraint pass later added about 16 of those lines for the sourced daily air-removal test and explicit cycle compatibility/pressure state.

## Stage 2 — behaviour and simulation

- `changes.workspec.js` owns authored transformations, movements, monitor results, and release decisions.
- `generator.workspec.js` owns minute-by-minute chamber heating, seeded in-band temperature variation, pressure, exposure accumulation, and cooling.
- Starting State continues to own the world, schedule, capacity, roles, and scenario parameters.

At 10:30 with seed 17, the CLI returns zero runtime problems, two released sterile trays, zero stranded WIP, 16 qualifying exposure minutes, a negative BI, and a closed released load record. Seeds 1, 17, and 999 all pass the healthy constraints; two seed-17 snapshot envelopes were byte-identical.

One runtime inspection issue appeared: `snapshot --time 08:40` produced correct intermediate observable values but also emitted `timing.resolution.dependency_unresolved` errors for downstream tasks beyond the truncated horizon. A full-horizon run is clean, and runtime constraints can inspect intermediate `stateAt` history. This is a CLI/runtime horizon ergonomics limitation, not a missing modelling or constraint-query capability.

Approximate change: **133 Changes lines and 26 Generator lines**.

## Stage 3 — locked first-pass constraints

The healthy model was complete before this pass. Eight initial constraints (157 lines) were authored through resolved `state`, `stateAt`, `get`, `getAt`, and `times` only:

| Constraint | Plain-English intent |
| --- | --- |
| `flow.tray_conservation` | Tray quantity stays non-negative and conserved across every stage; all received trays are accounted for at completion. |
| `flow.load_consumables` | One detergent dose, wrap set, and internal indicator is consumed per tray, plus one BI for this implant load. |
| `workflow.required_stages` | Cleaned, inspected, packaged, processed, and released quantities appear in order with no final WIP. |
| `sterilisation.daily_air_removal_gate` | The daily empty-chamber air-removal test passes before the first pre-vacuum load. |
| `sterilisation.capacity_and_compatibility` | The load fits both batch machines and the selected and validated compatible cycles agree. |
| `sterilisation.minimum_exposure` | The cycle reaches the required steam exposure and has an acceptable mechanical record. |
| `release.implant_load_gates` | Release waits for cool/dry/intact packages, mechanical and chemical passes, a negative BI, and authorised review. |
| `staffing.role_qualification` | Dirty-side, clean-side, steriliser, and release work uses personnel qualified for that responsibility. |

The first healthy constraint run revealed one constraint implementation bug: actor reservations are absent in the state at the exact completion event. Qualification was correctly checked in the immediately preceding resolved state instead. The locked first-pass file is preserved identically in every adversarial mutant (SHA-256 `4d37babda9e83fac534de4ec001af0a0d478ab8da19c14bc302cfc37ae0ad903`).

Approximate change: **157 constraint lines**, plus the small readiness/compatibility additions described in Stage 1.

## Stage 4 — independent adversarial review

An independent **GPT-5.6 Luna / Medium** reviewer received only the four healthy WorkSpec files and CLI path. It was not shown the research note, expected mutations, suspected weak rules, hidden outcomes, or any orchestrator mutation plan. It created ten isolated runnable projects and ran `validate`, `snapshot`, and `constraints` against each with seed 17. All ten remained structurally valid, executed without runtime problems, and preserved two released trays.

| Mutation | Locked result | Survivor classification | Final decision/result |
| --- | --- | --- | --- |
| M01 record says one tray while two flow | Survived | Genuine omitted traceability invariant | Count consistency retained; now caught. |
| M02 both opaque cycle IDs changed to a mutually matching but differently named policy | Survived | Unstated/external IFU policy; runtime behaviour still follows the pre-vacuum profile | No string-specific rule added; survives. |
| M03 cooling task shortened 30m → 5m | Survived | Ambiguous local cooling duration; package temperature is not modelled | No duration literal added; survives. |
| M04 trays released while `release_status` remains `not_released` | Survived | Genuine omitted audit-record invariant | Record consistency retained; now caught. |
| M05 BI incubation shortened 60m → 1m | Survived | Ambiguous manufacturer-specific BI latency | No duration literal added; survives. |
| M06 supervisor assigned as BI task actor while incubator remains reserved | Survived | Legitimate alternative responsibility model | No staffing prohibition added; survives. |
| M07 equipment declares gravity displacement while running the short pre-vacuum protocol | Survived | Weak exposure constraint: protocol type was ignored | Protocol-specific exposure retained; now caught. |
| M08 cycle-record write removed | **Caught** | Correct violation of two existing gates | Still caught. |
| M09 cleaned trays never move from dirty to clean side | Survived | Genuine omitted location/boundary invariant | Processing-zone rule retained; now caught. |
| M10 rinse/dry shortened 15m → 1m | Survived | Ambiguous device/IFU-specific duration | No duration literal added; survives. |

Locked detection was **1/10**. Excluding the three unsupported duration policies, the legitimate staffing alternative, and the externally authoritative cycle-ID relabelling leaves five grounded locally observable challenges; the final set catches **5/5** of those.

Each mutation changed only one semantic line, except M02 (two matching identifiers); removals in M04, M08, and M09 were also single-line edits. The runnable mutant corpus is 6,307 lines because each project deliberately carries standalone copies of all four files. Full raw results are in [adversarial/REVIEW.md](adversarial/REVIEW.md).

## Stage 5 — retained follow-ups

The final constraint file strengthens three existing rules and adds one rule:

- recorded load count must equal both received and released tray counts;
- the final audit record must be closed/released and name the actual authorised reviewer role;
- exposure thresholds depend on the observable equipment cycle type—pre-vacuum uses 132 C/4m and gravity displacement uses 121 C/30m—and the cycle must contain a finite pressure series that rises above its starting value;
- cleaned trays must cross to clean assembly before inspection, and released trays remain in sterile storage.

These are reusable statements of process intent, not checks for mutation values. The final constraint delta relative to the locked set is approximately **+55/-14 lines**, producing nine final constraints (199 lines), including defensive handling for missing stages/releases. The healthy model still passes, and replaying the ten original mutants against the final constraint file catches M01, M04, M07, M08, and M09 while leaving the intentionally unclosed five above.

## Ambiguities requiring domain judgement

- Device and package IFUs are authoritative for cleaning details, load mass/density, drying, and the exact validated cycle.
- The scenario's two-tray capacities and hands-on durations are illustrative local parameters, not universal standards.
- A manufacturer-specific BI system is needed before asserting a minimum result latency.
- “Cool” and “dry/intact” need a package or load measurement if they are to be more than an authored inspection outcome; chamber temperature is not automatically package temperature.
- Local competency policy determines whether the supervisor may also handle BI incubation and whether clean-side roles require distinct people.
- Non-implant BI release rules, rework branches, failure probabilities, storage outdating, and operating-room demand remain outside this bounded healthy path.

## WorkSpec capability assessment

No required invariant exceeded the existing WorkSpec API. Material conservation, stage ordering, capacity, role qualification, location boundaries, thermal history, protocol choice, monitoring, quarantine, and record consistency were all expressible through resolved observable state/history. No provenance, last-writer API, source inspection, constraint DSL, new history abstraction, remediation layer, or Generator helper was needed.

The only concrete limitation observed was the noisy partial-horizon snapshot behaviour described above. Two survivors also show representation boundaries rather than API gaps: external IFU truth cannot be inferred from two mutually changed opaque identifiers, and unmodelled package temperature cannot be queried. The appropriate response is to model authoritative data when the domain requires it, not to expose Changes/Generator internals.

## Reproduction

From the repository root:

```sh
node packages/workspec/bin/workspec.js validate packages/workspec/dogfood/steam-sterilisation/start.workspec.json --json

node packages/workspec/bin/workspec.js snapshot packages/workspec/dogfood/steam-sterilisation/start.workspec.json \
  --changes packages/workspec/dogfood/steam-sterilisation/changes.workspec.js \
  --generator packages/workspec/dogfood/steam-sterilisation/generator.workspec.js \
  --time 10:30 --seed 17 --json

node packages/workspec/bin/workspec.js constraints packages/workspec/dogfood/steam-sterilisation/start.workspec.json \
  --changes packages/workspec/dogfood/steam-sterilisation/changes.workspec.js \
  --generator packages/workspec/dogfood/steam-sterilisation/generator.workspec.js \
  --constraints packages/workspec/dogfood/steam-sterilisation/constraints.workspec.js \
  --time 10:30 --seed 17 --json --yes
```

Expected final result: validation exit 0 (five info notices), snapshot exit 0 with zero runtime problems and `released_sterile_trays.quantity = 2`, and constraints exit 0 with zero violations/problems.
