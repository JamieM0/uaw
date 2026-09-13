# WorkSpec 2 AI constraint-authoring dogfood

Run date: 2026-09-09. This is a small executable experiment, not a benchmark. Constraint design was completed from the six healthy Simulation Library models before a separate role designed mutations. The mutation role was not shown the authored constraints. Every run used the packaged CLI, seed `1`, and isolated temporary project files; no browser automation was used.

## Result

The AI produced a compact, useful description of process correctness, but not a complete one. Fourteen retained constraints captured recipes/BOMs, transformation and material balance, commercial/release gates, cold-chain safety, staffing policy, stock reserve, and maintenance isolation. All six healthy models passed. The locked set caught **3/18 (16.7%)** independently authored mutations; 11 of the 15 survivors were then closed by small, general follow-up constraints using the existing query API. The other four were two changes with no resolved behavioural effect and two duration policies not established by the model.

The low first-pass rate is the main dogfood signal: AI-authored constraints are valuable as a normal modelling stage, but one healthy-model pass misses obvious stock, capacity, qualification, and ordering truths. A distinct adversarial review materially improves completeness.

## Compact domain description retained in the library

| Model | Authored constraints | Domain intent, rather than implementation mirroring |
| --- | --- | --- |
| Breadmaking | `bread.recipe`; `bread.transformation_yield` | Ingredient depletion scales with loaves, and dough must be observed in mixed, risen, and shaped stages with no stranded final WIP. It does not inspect handler literals. |
| E-commerce | `order.fulfilment_balance`; `order.payment_gate` | Each packed order consumes one item and one box and closes a pending order; packing is gated by validation, payment, confirmation, inventory update, and picking. |
| Electronics | `phone.bom`; `phone.qa_packaging_gate` | Component depletion follows the 1:1:2:1:1:1 phone BOM; finished phones consume QA-passed stock and one packaging set each. Batch sizes are derived from observations. |
| Pharmaceutical | `drug.formulation_mass_balance`; `drug.release_gate`; `drug.packaging_bom` | Released API plus excipients conserves blend mass; identity and purity checks gate formulation; packages contain 20 tablets, one PVC sheet, and 0.1 m² foil each. |
| Restaurant | `kitchen.cold_chain`; `entree.material_balance` | Chilled storage and raw foods remain at or below 4 °C throughout history; entrée output conserves prepared protein and pan sauce. |
| Coffee shop | `coffee.stock_reserve`; `coffee.role_qualification`; `coffee.maintenance_isolation` | Service retains weekday/weekend ingredient reserves, work is assigned by role class, and customer service cannot overlap machine maintenance. Reserve thresholds are explicitly marked as inferred policy. |

These are executable strings in `web/assets/static/simulation-library.json`. Plain-English comments travel with each constraint source.

## Adversarial results

All 18 variants passed structural validation, executed successfully, and preserved the stated headline output. “Caught” means the retained constraint identified the actual damaged semantic rule.

| Model | Mutation / challenged truth | Locked result | Survivor classification |
| --- | --- | --- | --- |
| Bread | Initial yeast `500 → 0`; production needs available yeast | survived | Important stock invariant omitted |
| Bread | Swap mixing/kneading order while preserving chain length | **caught by `bread.transformation_yield`** | Correct violation: mixed dough remains stranded |
| Bread | Oven capacity `4 → 1`; batch must fit | survived | Important capacity invariant omitted |
| E-commerce | Pick before inventory update | survived | Important ordering invariant omitted; original gate was too late |
| E-commerce | Initial boxes `500 → 0`; packing needs stock | survived | Important non-negative stock invariant omitted |
| E-commerce | Warehouse worker processes payment | survived | Important qualification policy omitted |
| Electronics | Remove explicit reflow dependency, while another dependency preserves the same resolved order | survived | No current observable behavioural damage; latent robustness change |
| Electronics | Display stock `150 → 10`; two batches consume 14 | survived | Important non-negative stock invariant omitted |
| Electronics | Conveyor capacity `10 → 1`; batches must fit | survived | Important capacity invariant omitted |
| Pharmaceutical | Run purity assay before identity test | survived | Important QA ordering invariant omitted; release gate was too weak |
| Pharmaceutical | Junior chemist performs synthesis | survived | Important qualification policy omitted |
| Pharmaceutical | Reactor capacity `10L → 1L`; 8.5 L solvent charge must fit | survived | Important physical-capacity invariant omitted |
| Restaurant | Walk-in temperature `2 → 10` °C | **caught by `kitchen.cold_chain`** | Correct food-safety violation |
| Restaurant | Prep cook runs grill protein service | survived | Important qualification policy omitted |
| Restaurant | Protein cook duration `40m → 4m` | survived | Required duration is plausible but absent/ambiguous domain intent |
| Coffee | Declared opening beans `100 → 5` | survived | No resolved damage: every trading-day open handler overwrites this value |
| Coffee | Lead barista performs equipment service | **caught by `coffee.role_qualification`** | Correct qualification violation |
| Coffee | Equipment service duration `180m → 18m` | survived | Required duration is plausible but absent/ambiguous domain intent |

| Model | Caught / attempted | Rate |
| --- | ---: | ---: |
| Breadmaking | 1 / 3 | 33.3% |
| E-commerce | 0 / 3 | 0% |
| Electronics | 0 / 3 | 0% |
| Pharmaceutical | 0 / 3 | 0% |
| Restaurant | 1 / 3 | 33.3% |
| Coffee shop | 1 / 3 | 33.3% |
| **Overall** | **3 / 18** | **16.7%** |

The raw rate intentionally includes the two mutations that proved behaviourally ineffective and the two ambiguous duration policies. Excluding those four leaves 3/14 independently proposed, observable, established-policy mutations caught (21.4%).

## Survivor follow-up

After scoring was frozen, minimal follow-up constraints were run against both healthy and mutated projects. All healthy projects still passed. The existing API closed every survivor classified as an omitted important invariant:

| Follow-up domain truth | Mutations now rejected |
| --- | --- |
| Inventory may not become negative | No yeast, no boxes, insufficient displays |
| Batch must fit operating equipment | Undersized bread oven, conveyor, and pharmaceutical reactor charge |
| Inventory reservation precedes completed picking | Pick-before-update reversal |
| Qualified roles perform payment, synthesis, and grill work | Three staffing substitutions |
| Identity testing completes before the purity assay | Reversed pharmaceutical QA order |

These follow-ups are demonstrated in the experiment runner, not added to the retained constraint score. They are genuine reusable domain truths, not mutation-string checks. The stock and capacity rules are especially strong candidates for the permanent library. The exact staffing qualifications should be confirmed by a domain owner before retention. The duration survivors should not be constrained until the minimum safe/service duration is made explicit. The overwritten coffee value and latent reflow dependency should not inflate a semantic-detection score.

## API and representation findings

No genuine WorkSpec constraint-query limitation was found. `state`, `stateAt`, `get`, `getAt`, and `times` expressed every observable rule tested, including historical ordering, active reservations, role qualification, capacity, conservation, and reserve policy. String-valued units such as `"10L"` are inconvenient but still locally interpretable; this experiment does not justify a new API.

The removed explicit reflow edge cannot be distinguished through resolved history when another edge preserves identical order. Under this experiment's rule that constraints inspect observations rather than Changes internals, that is a non-observable latent model edit, not evidence for provenance or dependency-query APIs.

Simulation Library entries now retain optional `constraints` beside `simulation`, `changes`, and optional `generator`. Studio projects persist that source as `constraints.workspec.js`/`constraintsDraft`; template creation, folder reopen, duplication, checkpoints, ZIP import/export, and the manifest carry it without using a parallel store. Runtime constraints are no longer conflated with the legacy custom-metrics validator setting.

## Reproduction

Run the experiment (it is intentionally not in the permanent test suite):

```sh
node packages/workspec/scripts/run-domain-constraint-dogfood.js
```

The runner writes isolated temporary projects and invokes:

```text
workspec validate
workspec snapshot --seed 1
workspec constraints --seed 1
```

The permanent integration tests verify that all healthy retained constraints execute without violations and survive folder-backed template creation/reload.

## Recommendation

Make constraint authoring a normal WorkSpec model-generation stage, but pair it with an independent semantic mutation/review pass. The first pass did produce a compact formal description of correctness rather than merely encode handlers—the caught order, cold-chain, and role failures prove that—but it systematically under-enumerated adjacent domain truths. The useful workflow is therefore: model, author a small intent set, adversarially challenge it, then retain only follow-ups that a domain owner recognizes as real policy.
