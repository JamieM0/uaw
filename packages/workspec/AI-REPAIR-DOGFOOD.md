# WorkSpec 2.2 AI repair dogfood

Run on 2026-09-08 with three existing projects from `web/assets/static/simulation-library.json`. Each project was exported to an isolated temporary directory and exercised through the packaged `workspec validate`, `workspec snapshot`, and `workspec constraints` commands with seed `1`. The faults remained structurally valid, executed without runtime errors, and preserved the simulation's principal output before repair.

Three separate GPT-5.6 Luna agents with medium reasoning repaired the isolated projects. They received the broken project, CLI location, validation/runtime outcomes, and structured constraint violations. They were explicitly denied the original library source, mutation description, expected edit, git history, and other scenarios.

## Results

| Scenario | Injected failure | Evidence given to repair agent | Agent repair | Iterations | Final result | Assessment |
| --- | --- | --- | --- | ---: | --- | --- |
| Artisan bread inventory | Starting flour reduced from 50 kg to 2 kg; mixing consumed 3 kg | `inventory.non_negative`; `flour.quantity = -1`; expected minimum `0`; first at minute `435`, repeated through `645` | Changed flour consumption from `-3` to `-1` in `changes.workspec.js` | 1 | Valid; no runtime problems; no violations; four baked loaves remain | Constraint-clean but causally wrong. The agent changed the recipe instead of restoring stock. Final flour is 1 kg rather than the healthy model's 47 kg. |
| Electronics conveyor capacity | Conveyor capacity reduced from 10 phones to 6 while the second batch produces 8 | `assembly_conveyor.capacity`; `partial_phones.quantity = 8`; expected maximum `6`; minutes `705` and `715` | Raised capacity from `6` to `8` in `start.workspec.json` | 1 | Valid; no runtime problems; no violations; 12 finished phones remain | Correct causal area and a one-line repair. It chose the minimum passing capacity, not the original capacity of 10, because no headroom policy was represented. |
| Restaurant cold chain | Kitchen setup raised walk-in temperature to 12 C for the service period, then restored it to 2 C | `cold_chain.temperature`; observed `12`; expected maximum `5` throughout `[960, 1320]`; first violation at minute `990` | Changed the setup assignment from `12` to `2` in `changes.workspec.js` | 1 | Valid; no runtime problems; no violations; 21 finished entrees remain; resolved final state matches healthy model | Correct unsafe assignment and one-line repair. Two redundant 2 C assignments remain relative to the original source, so the repair was behavior-preserving but not a perfect restoration. |

## Baselines and verification

Before mutation, all three original projects validated with zero errors, produced zero runtime errors, and passed their runtime constraints:

- bread at minute `645`: `baked_bread.quantity = 4`;
- electronics at minute `805`: `finished_phones.quantity = 12`;
- restaurant at minute `1320`: `finished_entrees.quantity = 21`.

The same outputs were present in the broken runs, showing that the constraints detected unacceptable resolved world state rather than a failed simulation. After the agents stopped, the orchestrator independently reran all three CLI sequences. Every repaired project returned exit `0` from validation, snapshot, and constraints, with zero runtime problems and zero constraint violations.

The complete WorkSpec package test suite also passed, including the existing six-project headless library dogfood and runtime constraint query coverage.

## Locality, regressions, and unnecessary changes

All repairs changed one authored line relative to the broken input, and no agent edited a constraint. There was no regeneration or broad restructuring.

The important outputs remained unchanged in all three simulations. The cold-chain final resolved state was identical to the healthy baseline. Capacity retained the intended production result but reduced healthy-model headroom from 10 to 8. Inventory retained four loaves but changed recipe semantics and left only 1 kg of flour rather than 47 kg. That inventory result is a semantic regression even though all available formal checks pass.

No repair introduced a validation error, runtime problem, or new constraint violation.

## What the experiment says about the feedback

Structured violations were effective at identifying the affected object, property, bad value, bound, and time. They drove small repairs and achieved constraint convergence in one iteration in all three cases.

They did not reliably identify the authoritative modelling decision. For negative inventory, both increasing supply and reducing consumption satisfy the invariant; the agent selected the wrong one. This is primarily an underspecified model/constraint, not a repair-agent failure and not evidence that WorkSpec needs automatic remediation metadata. A recipe or material-balance invariant would be needed to reject the agent's change. Similarly, the capacity constraint establishes a minimum of 8 but says nothing about the original 10-unit operating headroom.

The cold-chain agent found the correct source event, but left harmless redundant assignments. That is best classified as repair-agent imprecision rather than a runtime limitation.

One concrete diagnostic gap appeared across the temporal cases: violations expose resolved time and state but not the task/event that last wrote the property. The cold-chain repair therefore required manually correlating minute `990` with the schedule and Changes handlers. Negative inventory also produced the same violation at every later resolved time, which is noisy; that repetition came from the constraint's reporting policy and can be fixed by returning the first crossing rather than by expanding the WorkSpec API.

No missing state-query capability blocked a repair. `times()`, `stateAt()`, and `getAt()` were sufficient for point, capacity, and across-period checks. The experiment does not justify exposing Changes or Generator internals, adding a constraint DSL, or adding remediation hints.

## Overall assessment

The loop reliably converged to a formally clean model in this sample: 3/3 scenarios passed after one local edit, with intended headline output preserved and no new formal failures. It did **not** reliably converge to the known healthy semantics: one repair was causally wrong and another recovered only the minimum constraint-satisfying capacity.

The central answer is therefore qualified: an AI agent can use WorkSpec's formal feedback to locate a bad resolved state and make a small correction, but invariant violations alone are not enough to choose among multiple semantically plausible repairs. Reliability depends on modelling the invariants that distinguish supply, recipe, capacity policy, and other domain intent—not merely the final safety bound.
