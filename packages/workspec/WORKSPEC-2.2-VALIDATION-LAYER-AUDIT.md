# WorkSpec 2.2 validation-layer audit

Date: 2026-09-12

Scope: the canonical dependency-free validator, the package runtime checks that
supersede some of its legacy semantic checks, CLI entry points, Studio validation
paths, built-in catalog fallback, tests, and first-party documentation. This is an
investigation only; no implementation behavior was changed.

## Executive summary

`object.optimization.unused_resource` is not isolated. The canonical validator
still contains a block of pre-2.2, inline-interaction simulation analysis. Four
currently meaningful conclusions are not truthful document-only conclusions in
WorkSpec 2.2:

- `object.optimization.unused_resource` (D) ignores Changes, Generator, and even
  2.2 task `reservations` already present in Starting State.
- `economic.profitability.negative_margin` (D) counts planned labor cost while
  revenue and material effects have moved to Changes/Generator. A normal 2.2
  project can therefore be reported as loss-making from the exact absence of
  effects that 2.2 requires.
- `temporal.scheduling.actor_overlap` (D) assumes unconditional literal actor
  assignments; it ignores `when`, runtime actor selection, reservations, and
  actual execution. Mutually exclusive branches produce a false error.
- `task.reference.invalid_actor` has mixed claims. Missing `actor_id` is local,
  but general performer validity/liveness is D: an earlier Change or Generator
  can create the performer and runtime binding determines the selected live
  actor. A narrower literal-Changes-create cross-reference is C. The current type
  test also rejects a performer enabled through a 2.2 type trait despite having
  all necessary Starting State information.

The resource-flow, recipe, lifecycle, interaction-state, and interaction-target
checkers are mostly dormant for a valid 2.2 Starting State because 2.2 forbids
inline executable behavior. They remain older-version validators, not 2.2 project
validators. Their corresponding 2.2 claims belong in runtime/history validation
(D), and several already have materially better runtime equivalents in
[`workspec-runtime.js`](workspec-runtime.js#L1156).

There are also two **missing D-layer validations**, rather than false canonical
Starting-State conclusions: Changes can move an actor to an undeclared location
or set a state-library-backed object to an undeclared state, and both canonical
validation and current runtime execution remain clean. The initial-reference
checks are sound A checks, but they must not be mistaken for history invariants.

Both CLI and Studio call the canonical validator with the same incomplete input.
Studio later runs project/runtime checks additively, but does not retract or
recompute a canonical warning. No current test supplies a genuine 2.2
Starting-State + Changes/Generator project and asserts the truth of any canonical
project-wide diagnostic. The only 2.2 unused-resource test explicitly locks in the
known incomplete result.

The evidence supports a small first-class **project validation orchestration
layer**, conceptually `validateProject(startingState, { changesSource,
generatorSource, seed, until })`. It should compose, rather than replace:

1. canonical Starting-State document validation (A);
2. source/index checks such as Changes task references (C);
3. authoritative runtime validation over a defined resolved run (D);
4. optional domain Constraints.

It does **not** support moving arbitrary domain policy into the core validator.
“Never”, profitability, stock history, utilization, capacity-in-use, and similar
claims require an explicit run horizon/seed or a user-authored Constraint.

## Classification rubric

- **A — Starting-State-local and sound:** decidable from `start.workspec.json`.
- **B — Sound only for older WorkSpec versions:** an inline-interaction/document
  rule for 2.0/2.1, not a valid 2.2 project check.
- **C — Needs project-level analysis:** source relationships across Starting State
  and Changes/Generator are sufficient for the stated claim.
- **D — Needs resolved-history analysis:** truth depends on executed behavior,
  runtime selection/conditions, ordering, state, seed, or analysis horizon.

For mixed metric IDs, the table splits the individual claims because one metric
currently conflates multiple questions.

## Canonical validator inventory

The public API is `validate(documentValue, options = {})`, but `options` is not
used; the function derives everything from the one document
([`workspec-validator.js:752-756`](workspec-validator.js#L752)). Its semantic
simulation block builds task timing and reference sets solely from `world.objects`
and `process.tasks` ([lines 1456-1482](workspec-validator.js#L1456)).

| Checker / metric | Claim and actual input | Class | 2.2 assessment and destination |
|---|---|---:|---|
| All `schema.integrity.*` root/version/meta/config/world/process checks; `starting_state.behaviour.disallowed` | Shape and allowed contents of this JSON document; only Starting State | A | Keep document validation. The behavior prohibition is specifically a Starting-State boundary ([lines 1678-1694](workspec-validator.js#L1678)). |
| All `calendar.integrity.*` checks | Calendar/day-type declarations are internally well formed and references resolve in this Starting State | A | Keep document validation ([`validateMultiPeriodConfiguration`](workspec-validator.js#L339)). Runtime-created objects and effects do not alter whether the declaration is well formed. |
| `object.integrity.invalid_object`, `missing_required_fields`, `invalid_object_id`, `namespace_mismatch`, initial `duplicate_object_id`, `disallowed_type_alias`, `missing_type_definition`, `invalid_type_definition`, `missing_required_properties` | Initial object declarations, IDs/types, and required initial properties | A | Keep document validation ([lines 1175-1390](workspec-validator.js#L1175)). Changes can later change quantity/state but cannot make an invalid initial declaration valid. The duplicate-ID subcheck for inline `action:create` is B. |
| `object.reference.invalid_location` (initial object/task location) | Named initial/planned location exists in Starting State layout | A | Keep document validation ([lines 1309-1320](workspec-validator.js#L1309), [1630-1641](workspec-validator.js#L1630)). Movement validity at execution time is a separate D question. |
| `state_visuals.integrity.*`; object-level `state_visuals.reference.*` | State library declarations and the object's **initial** state/appearance references | A | Keep document validation ([lines 1111-1450](workspec-validator.js#L1111)). |
| `task.integrity.invalid_task`, `invalid_task_id`, `duplicate_task_id`, `invalid_start_time`, `invalid_duration`; dependency format/self-reference | Planned task declaration and syntax | A | Keep document validation ([lines 1484-1660](workspec-validator.js#L1484)). Runtime may resolve omitted starts, but explicit syntax and IDs are local. |
| `task.reference.invalid_dependency` (unknown declared task) | Every declared `depends_on` ID exists among declared tasks | A | Keep as document/project-source structural validation ([lines 1880-1909](workspec-validator.js#L1880)). Changes/Generator do not author planned task IDs. Runtime work-definition templates need their own validator, which the runtime now supplies. |
| `temporal.scheduling.circular_dependency` | The declared dependency graph contains a cycle | A | Keep document validation ([lines 1911-1966](workspec-validator.js#L1911)). This is a graph fact, not a resource/state-history claim. |
| `temporal.scheduling.dependency_violation` for explicit starts and declared durations | Explicit start is earlier than the declared dependency timing bound | A | Keep document validation if worded as an **authored schedule contradiction** ([lines 2150-2198](workspec-validator.js#L2150)). Actual completion/continuation constraints are D and are separately modeled by runtime timing checks. |
| `task.reference.invalid_actor`: missing `actor_id` | A task has no performer expression | A | Keep the local presence/type portion. |
| `task.reference.invalid_actor`: “unknown actor” | Validator converts `actor_id` to a string and looks only in initial objects plus inline `action:create` ([lines 1467-1482, 1501-1503, 1546-1566](workspec-validator.js#L1467)) | D (narrow C subset) | Earlier Changes/Generator can create a performer and runtime binding/liveness/order decide the general claim. A source-aware project check can recognize the narrower case of a statically indexable literal Changes create. |
| `task.reference.invalid_actor`: performer capability | Initial object type inheritance only | A (currently incorrect) | Information is local, but implementation ignores 2.2 `type_traits[trait].can_be_actor_id`; runtime accepts such traits ([`performerType`](workspec-runtime.js#L1508)). This is a separate stale-semantics defect, not a missing-file defect. Runtime-selected actor expressions also require D. |
| `temporal.scheduling.actor_overlap` | Same literal `actor_id`, overlapping declared starts/durations ([lines 2119-2151](workspec-validator.js#L2119)) | D | `when` branches, actor selection, runtime instances, actual interruption, and reservations can change who actually runs concurrently. Runtime has bounded/possible claims and execution-time reservation checks ([lines 632-690](workspec-runtime.js#L632), [1528-1558](workspec-runtime.js#L1528)). Move the unqualified execution claim to runtime; at most retain a deliberately worded “authored unconditional overlap” static check. |
| Interaction shape/action/operator metrics (`task.integrity.invalid_interactions`, `invalid_interaction`, `invalid_interaction_action`, `legacy_field`, `interaction.operator.*`) | Inline `task.interactions` | B | Valid 2.2 Starting State rejects the whole field. Keep version-gated support for 2.0/2.1 only. Validate compiled Changes through runtime/source validation in 2.2 ([canonical lines 1677-1869](workspec-validator.js#L1677); runtime lines 1156-1260](workspec-runtime.js#L1156)). |
| `task.integrity.invalid_object_reference`; `state_visuals.reference.invalid_interaction_state` | Inline interaction target/state exists in the same document | B | Older inline architecture. The equivalent 2.2 target liveness/type/state-transition question is D because Changes/Generator can create, remove, or mutate targets. |
| `object.reference.lifecycle_violation` / `lifecycle_validation_error` and create-time duplicate ID | Best-effort chronological replay of inline create/delete effects ([lines 1968-2118](workspec-validator.js#L1968)) | B | Not reachable from a valid 2.2 Starting State. Runtime already evaluates live targets/lifecycle after Changes lowering (`object.lifecycle.*`; [`prepareInteractions`/`commitWrites`](workspec-runtime.js#L1350)). Project truth is D. |
| `recipe.compliance.missing_inputs` | Inline per-task quantity deltas versus `process.recipes` ([lines 2200-2253](workspec-validator.js#L2200)) | B as implemented; D for 2.2 claim | In valid 2.2 the checker sees no production at all. Whether a resolved production has its required inputs depends on Changes/Generator and potentially conditional effects. Make this runtime/Constraint validation, not Starting-State validation. |
| `resource.flow.negative_stock` | Initial quantity plus a restricted subset of inline deltas, ordered by declared start ([lines 2255-2312](workspec-validator.js#L2255)) | D | Quantity can be set/changed by Changes and Generator; conditions, same-time conflict precedence, runtime-created objects, and history determine truth. It is dormant on valid 2.2 raw input and incomplete even on lowered input. Use resolved history/Constraint. |
| `economic.profitability.negative_margin` | Planned task duration × initial performer costs, plus revenue/material deltas found only in inline interactions ([lines 2314-2386](workspec-validator.js#L2314)) | D | Systematically asymmetric in 2.2: costs remain visible in Starting State while revenue/material flow moved out. Actual task selection/duration and all effects are runtime facts. Use a resolved-run metric or domain Constraint with declared economic semantics. |
| `object.optimization.unused_resource` | Resource ID absent from actor IDs, inline interaction targets, and recipe inputs ([lines 2388-2416](workspec-validator.js#L2388)) | D | False for Changes/Generator use and for Starting-State `reservations`. “Never used” requires a horizon and resolved history; a C-layer check could only make the narrower claim “no statically indexable reference”. |

### What is notably absent

The canonical validator does not inspect 2.2 `when`, `requires`, `while`, actor
selection, `reservations`, collections, work definitions/runtime-created task
instances, continuation, progress/`actual_end`, or relative timing. The package
runtime now validates these surfaces in `validateStatic`, bounded claim checks,
timing resolution, and replay ([`workspec-runtime.js:1168-1344`](workspec-runtime.js#L1168),
[`580-825`](workspec-runtime.js#L580), [`1570-1775`](workspec-runtime.js#L1570)).
Those runtime diagnostics are correctly located: expression/shape facts are A/C;
selection, reservation capacity/conflicts, lifecycle, conditions, and actual
timing are D.

Two caveats qualify that last sentence. Runtime currently does not validate a
Changes move against declared locations, and does not re-check state-library
membership after a Changes/Generator state write. Those are unresolved D-layer
gaps. Also, Studio automatic validation currently appends only runtime problem
IDs prefixed `generator.`, `changes.`, or `constraint.`. It therefore drops
runtime `reservation.*`, `task.*`, `object.*`, and timing diagnostics even when
`runProject` correctly produces them
([`playground-editor.js:959-968`](../../web/assets/js/playground/playground-editor.js#L959)).

## Minimal reproductions

These were executed directly against `require('./packages/workspec')` in the
current tree. In each example, omitted envelope fields are the same minimal 2.2
`meta`, `config.time_unit`, `world`, and `process` structure shown in package docs.

### R1 — resource reserved in Starting State is reported unused (D)

```json
{
  "world": { "objects": [
    { "id": "worker", "type": "actor", "name": "Worker", "properties": { "state": "idle" } },
    { "id": "kit", "type": "resource", "name": "Kit", "properties": { "quantity": 1 } }
  ]},
  "process": { "tasks": [{
    "id": "work", "actor_id": "worker", "start": "09:00", "duration": "1m",
    "reservations": [{ "resource": "kit", "mode": "exclusive" }]
  }]}
}
```

`validate(start)` emits `object.optimization.unused_resource`; `runProject(start,
'', '')` has no problems. No cross-file analysis is needed to disprove this
particular result—the current checker overlooks a relevant Starting-State field.

### R2 — resource used through Changes is reported unused (D)

```js
WorkSpec.task('work').onComplete(() => change('material', 'quantity', -1));
```

With initial `material.quantity = 1`, `validate(start)` emits unused-resource;
`runProject` consumes it correctly. `validate(runtime.applyChanges(start,
changes))` stops emitting unused-resource because the lowered interactions are
visible, but emits `starting_state.behaviour.disallowed`. This is not a usable fix:
`applyChanges()` produces execution input, not a legal 2.2 Starting State
([`applyChanges`](workspec-runtime.js#L2088)).

### R3 — profitable Changes project is reported loss-making (D)

```json
{
  "world": { "objects": [
    { "id": "worker", "type": "actor", "name": "Worker",
      "properties": { "state": "idle", "cost_per_hour": 60 } },
    { "id": "material", "type": "resource", "name": "Material",
      "properties": { "quantity": 1, "cost_per_unit": 10 } },
    { "id": "goods", "type": "product", "name": "Goods",
      "properties": { "quantity": 0, "revenue_per_unit": 100 } }
  ]},
  "process": { "tasks": [
    { "id": "work", "actor_id": "worker", "start": "09:00", "duration": "60m" }
  ]}
}
```

```js
WorkSpec.task('work').onComplete(() => {
  change('material', 'quantity', -1);
  change('goods', 'quantity', 1);
});
```

`validate(start)` reports gross profit `-60` and reports `material` unused because
it sees labor but neither material use nor revenue. After Changes lowering, the
same algorithm sees cost `10` and revenue `100`; both project-wide diagnostics
disappear (alongside the expected behavior-in-Starting-State error). The full
project runs without runtime errors, ends with material/product quantities `0/1`,
and its intended gross margin is `30`.

### R4 — Changes creates the later performer (C)

```json
{
  "world": { "objects": [
    { "id": "starter", "type": "actor", "name": "Starter", "properties": { "state": "idle" } }
  ]},
  "process": { "tasks": [
    { "id": "make", "actor_id": "starter", "start": "09:00", "duration": "1m" },
    { "id": "use", "actor_id": "future_worker", "start": "09:02", "duration": "1m",
      "depends_on": ["make"] }
  ]}
}
```

```js
WorkSpec.task('make').onComplete(() => create({
  id: 'future_worker', type: 'actor', name: 'Future Worker', properties: { state: 'idle' }
}));
```

`validate(start)` emits `task.reference.invalid_actor`; `runProject` creates the
actor at 09:01 and runs the 09:02 task without a problem. Lowering makes the
canonical unknown-actor check “correct”, but again turns the input into an illegal
2.2 Starting State.

### R5 — mutually exclusive branches are reported as actor overlap (D)

```json
{
  "world": { "objects": [
    { "id": "worker", "type": "actor", "name": "Worker", "properties": { "state": "idle" } },
    { "id": "flag", "type": "digital_object", "name": "Flag",
      "properties": { "state": "a", "quantity": 0 } }
  ]},
  "process": { "tasks": [
    { "id": "a", "actor_id": "worker", "start": "09:00", "duration": "10m",
      "when": { "==": ["@flag.state", "a"] } },
    { "id": "b", "actor_id": "worker", "start": "09:00", "duration": "10m",
      "when": { "==": ["@flag.state", "b"] } }
  ]}
}
```

`validate(start)` emits `temporal.scheduling.actor_overlap`; runtime's bounded
guard analysis proves the branches mutually exclusive and the resolved project
has no problem. Changes or Generator could also determine the flag's value, which
is why the general execution claim is D.

### R6 — Generator invalidates lowered negative-stock conclusion (D)

Starting quantity is zero; a Changes start handler decrements by one, while the
Generator writes ten at the same time:

```js
// changes.workspec.js
WorkSpec.task('work').onStart(() => change('stock', 'quantity', -1));

// generator.workspec.js
WorkSpec.onStart(({ set }) => set('stock', 'quantity', 10));
```

`validate(applyChanges(start, changes))` emits `resource.flow.negative_stock`
(`0 -> -1`). `runProject` applies Generator second as specified and exposes
quantity `10` at both resolved history points, with only the expected
`generator.changes.conflict` warning. This is the clearest example of why even
Changes-lowered source is insufficient for a history claim; Generator precedence
is implemented at [`workspec-runtime.js:2191-2257`](workspec-runtime.js#L2191).

An even simpler verified gap shows missing coverage rather than a false emission:
with starting quantity `0` and only `change('stock', 'quantity', -1)` in Changes,
canonical validation emits only `object.optimization.unused_resource`; runtime
ends at `-1` without a `resource.flow.negative_stock` problem. A history Constraint
is currently the only reliable way to enforce non-negative stock in 2.2.

### R7 — local performer trait is rejected (separate stale-semantics bug)

A custom `robot` extends `resource` and has a declared type trait with
`can_be_actor_id: true`. Canonical validation emits `task.reference.invalid_actor`
because `isPerformerType` only follows built-in inheritance; `runProject` accepts
and executes the task because runtime `performerType` honors the trait. This is
decidable from Starting State (A), but implemented incorrectly.

### R8 — runtime-only invalid movement and state are not checked

Two independently executed projects completed with no canonical or runtime
problem. The initial location was valid before the Change; the State Library
declared only `idle` and `working`:

```js
WorkSpec.task('work').onComplete(() => move('worker', 'missing'));
WorkSpec.task('work').onComplete(() => set('machine', 'state', 'teleported'));
```

In the first, final `worker.location` is `missing`. In the second, final state is
`teleported`, absent from the library.
These do not make the initial A checks unsound; they demonstrate that the
corresponding project/history invariants have no current D checker.

### R9 — capacity reservations are runtime-correct but hidden by Studio

Two co-timed tasks with distinct actors each reserve capacity on equipment whose
capacity is one. Canonical validation is clean. `runProject` emits
`reservation.conflict.authored` plus two `reservation.capacity.exceeded`
problems, and both tasks are blocked. Studio's prefix filter omits all three from
automatic Problems. This is not a Starting-State false positive; it is evidence
that a project-validation result must preserve all runtime diagnostics rather
than a hand-picked prefix family.

## CLI and Studio impact

| Surface | What it passes to canonical validation | Result |
|---|---|---|
| CLI `workspec validate` | One parsed JSON file; no Changes/Generator flags are consumed by `handleValidate` ([`bin/workspec.js:240-264`](bin/workspec.js#L240)) | All canonical C/D issues affect CLI. Custom validation is equally document-only. |
| CLI `snapshot` | Start + Changes + Generator to `runtime.snapshotProjectAt` ([`bin/workspec.js:380-393`](bin/workspec.js#L380)) | Project-aware runtime problems, but no reconciliation with canonical project-wide warnings. |
| CLI `constraints` | Canonical-validates Starting State first, then supplies all sources to runtime Constraints ([`bin/workspec.js:442-461`](bin/workspec.js#L442)) | A false canonical **error** can prevent a correct project/Constraint run. Canonical warning/info is not recomputed from history. |
| Studio automatic validation | Calls `WorkSpecValidator.validate(parsed)` first; subsequently obtains project sources and runs runtime/Constraints only after no built-in error ([`playground-editor.js:923-989`](../../web/assets/js/playground/playground-editor.js#L923)) | Same incomplete canonical result. Only `generator.*`, `changes.*`, and `constraint.*` runtime problems are appended; e.g. reservation/capacity errors are lost. Canonical results are never retracted. |
| Studio manual validation | Canonical start validation; only runs project machinery when Constraints source exists ([`playground-editor.js:1105-1126`](../../web/assets/js/playground/playground-editor.js#L1105)) | Without Constraints, Changes/Generator are not used for validation at all. |
| Studio display/import/AI/checkpoint gates | Parse and validate Starting State only ([`playground-validation.js:844-876`](../../web/assets/js/playground/playground-validation.js#L844), [`playground-save-load.js:104-119`](../../web/assets/js/playground/playground-save-load.js#L104), [`playground-agent-v2.js:325-334`](../../web/assets/js/playground/playground-agent-v2.js#L325), [`playground-projects-v2.js:535-540`](../../web/assets/js/playground/playground-projects-v2.js#L535)) | Project-wide canonical claims can affect editing workflows despite correct playback. |
| Studio playback | Uses `WorkSpecRuntime.runProject` with Changes/Generator ([`playground-timeline.js:296-357`](../../web/assets/js/playground/playground-timeline.js#L296)) | History can be correct while Problems retains a false document diagnostic. |

The canonical browser asset actually loaded by Studio is the synced
`web/packages/workspec/workspec-validator.js`, byte-identical to the package copy;
`playground.html` loads it at lines 136-137. This is true CLI/Studio parity of the
same incomplete input, not independent confirmation.

## Legacy Studio fallback catalog

If `WorkSpecValidator` is unavailable, Studio can still instantiate the older
[`SimulationValidator`](../../web/assets/js/simulation-validator.js#L5) using
[`metrics-catalog.json`](../../web/assets/static/metrics-catalog.json). It stores
only the simulation JSON and primarily reads legacy `simulation.objects/tasks`,
so it is neither canonical nor 2.2-project-aware. It is also actively invoked by
the Metrics Editor at
[`playground-metrics-editor.js:863`](../../web/assets/js/playground/playground-metrics-editor.js#L863),
not merely dead fallback code. Executing it against a canonical nested 2.2
fixture incorrectly returned success for negative stock, actor overlap,
unassigned actor, unused resource, location, and proximity because the relevant
legacy arrays were empty/undefined. Its relevant checkers classify as follows:

| Legacy functions / catalog metrics | Class in 2.2 |
|---|---:|
| `validateRootObject`, location declaration, display bounds, IDs, initial required/property types, initial resource quantity/equipment capacity, disallowed types | B as flat-model implementations; their equivalent declarations are A and are covered by the canonical validator |
| old duration/start/end-overflow checks | B (reject valid 2.2 duration and multi-day forms) |
| unknown/self/circular/missing dependency declaration checks | B as legacy array/path implementations; equivalent graph facts are A |
| `validateNegativeStock`, `validateRecipeCompliance`, `validateEquipmentState`, `validateActorOverlap`, `validateMissingBufferTime`, `validateUnusedResources`, `validateProfitability`, `validateTaskProximity`, `validateStateTransitions`, `validateResourceTypeConsistency` | B as flat/inline implementations; their meaningful 2.2 equivalents are D |
| `validateUnassignedTasks`, `validateObjectReferences` | B as flat/inline implementations; 2.2 liveness/binding equivalents are C/D |
| `validateDependencyTiming` | B as implemented; an authored static contradiction equivalent is A, while actual scheduling is D |

Notable stale IDs include `resource.definition.unused` rather than canonical
`object.optimization.unused_resource`, `actor.scheduling.overlap` rather than
`temporal.scheduling.actor_overlap`, and `resource.flow.recipe_violation` rather
than `recipe.compliance.missing_inputs` ([catalog entries](../../web/assets/static/metrics-catalog.json#L42)).

## Tests: coverage and gaps

- [`scripts/self-test.js:227-237`](scripts/self-test.js#L227) is the only explicit
  canonical unused-resource test. Its comment acknowledges that Starting State
  cannot establish Changes use; the fixture supplies no Changes/Generator and
  merely locks in the incomplete emission.
- Canonical tests exercise dependency timing, parsing, state libraries, and legacy
  interactions. They do not assert project-level truth for any 2.2 diagnostic.
- [`test-generator-2.2.js`](scripts/test-generator-2.2.js) separately tests
  Generator precedence and canonical dependency behavior; it never feeds the
  resulting project/history back into canonical semantic claims.
- [`test-changes-api-2.2.js`](scripts/test-changes-api-2.2.js) proves Changes can
  move, consume, create, remove, and mutate state, and proves `runProject` is
  correct. It does not test `unused_resource`, profitability, recipe, stock, actor
  creation, or lifecycle against canonical output.
- [`test-studio-templates-2.2.js`](scripts/test-studio-templates-2.2.js) validates
  Starting State, runs project, and runs Constraints as three independent phases;
  it does not reconcile cross-source diagnostic truth.
- Browser/package parity tests use Starting-State-only fixtures. They prove both
  surfaces return the same answer, not that the answer is project-sound.

Missing high-value tests are exactly the reproductions R1-R9, plus:

1. Changes-only and Generator-only use/modification of an initial resource;
2. runtime-created actor/object later used successfully;
3. conditional/runtime-selected actor assignments and capacity reservations;
4. stock/product flow where Generator precedence changes the apparent result;
5. recipe/economic outcomes over resolved history and a declared horizon;
6. Studio behavioral tests that show whether a canonical result is retained,
   replaced, or namespaced after runtime validation.

## Stale documentation

- [`docs-md/simulations/validation.md:34-55`](../../docs-md/simulations/validation.md#L34)
  calls the legacy catalog/`simulation-validator.js` the validation source of
  truth and describes checks against current JSON. The package canonical
  validator and four-file 2.2 architecture supersede this.
- [`validation-rules-reference.md:416-456`](../../docs-md/simulations/validation-rules-reference.md#L416)
  documents `resource.definition.unused` using inline consumes/produces/
  interactions and recommends deletion or adding a task.
- [`docs-md/workspec/reference/errors.md:77-100`](../../docs-md/workspec/reference/errors.md#L77)
  contains stale metric IDs and unqualified whole-simulation claims for stock,
  overlap, dependency timing, lifecycle, and profitability.
- [`validation-rules-reference.md:538-733`](../../docs-md/simulations/validation-rules-reference.md#L538)
  describes proximity/movement as timeline-aware by replaying inline property
  changes—the pre-2.2 interaction architecture.
- [`docs-md/workspec/guides/authoring.md:121-126`](../../docs-md/workspec/guides/authoring.md#L121)
  says Problems inspect the same resolved history. That is true for runtime/
  Constraint results, but not canonical document diagnostics.
- In contrast, [`packages/workspec/README.md:13-47`](README.md#L13) and
  [`docs-md/workspec/guides/ai-generation.md:61-66`](../../docs-md/workspec/guides/ai-generation.md#L61)
  correctly separate Starting-State validation, project execution, and resolved
  Constraints.
- Several dogfood reports explicitly normalize the false diagnostics as expected
  rather than treating them as checker failures:
  [`SIMULATION-LIBRARY-DOGFOOD.md:24`](SIMULATION-LIBRARY-DOGFOOD.md#L24)
  lists both negative-margin warnings and Changes-used resources as Starting-State
  output; [`CONSTRAINT-COMPLETENESS-DOGFOOD.md:28`](CONSTRAINT-COMPLETENESS-DOGFOOD.md#L28)
  repeats that unused resources are actually used by Changes;
  [`STUDIO-PRODUCT-DOGFOOD-RECONCILIATION.md:15-25`](STUDIO-PRODUCT-DOGFOOD-RECONCILIATION.md#L15)
  calls the notices “false friends” but retains them; and
  [`dogfood/steam-sterilisation/STAGED-MODELLING-REPORT.md:31-36`](dogfood/steam-sterilisation/STAGED-MODELLING-REPORT.md#L31)
  calls five such notices expected because the validator cannot see Changes.

## Historical evidence

`git show 3964ea0^:packages/workspec/workspec-validator.js` contains the lifecycle,
actor-overlap, dependency, recipe, negative-stock, profitability, and
unused-resource blocks before the “Implement WorkSpec 2.2 authoring architecture”
commit. The 2.2 commit mainly added schema-version support, the Starting-State
behavior prohibition, and dependency-start correction metadata; it did not
relocate those older semantic blocks. `git blame` dates the unused-resource block
to the 2026-02-04 WorkSpec 2.0 completion work. This strongly supports “multiple
pre-2.2 assumptions,” not one accidental message.

## Recommended ownership by validation layer

| Keep in document validation | Future project/source validation | Runtime / Constraint validation |
|---|---|---|
| schema/version/root; calendar declarations; initial object/type/property invariants; initial locations/state-library references; task IDs/syntax; dependency reference/cycle; explicit authored timing contradiction; prohibition on executable Starting-State fields | Changes syntax/compilation; literal Changes task IDs; statically indexable target/create references; cross-file source navigation; possibly an explicitly qualified “no statically indexable reference” informational hint | actual target liveness/lifecycle; actor selection and overlap; reservations/capacity/utilization; conditions; runtime-created instances; movement/proximity; quantity/resource flow; recipe fulfillment; state-transition history; profitability; “never used”; domain impossibility/invariants |

### Does WorkSpec need `validateProject(...)`?

Yes, as an orchestration/API boundary. CLI and Studio already implement fragments
of it independently: canonical `validate(start)`, `analyzeChanges`, `runProject`,
and `runConstraints`. A first-class project entry point would give both surfaces
one result model and prevent document diagnostics from masquerading as project
diagnostics.

The evidence does not justify a large new static JavaScript analyzer. Changes
analysis is intentionally lightweight, and package docs state runtime execution
is authoritative for dynamic JavaScript
([`packages/workspec/README.md:45-47`](README.md#L45)). A project validator should
therefore expose scope/provenance (`document`, `source`, `runtime`, `constraint`)
and require run parameters for history claims. Without a seed/horizon, D checks
must be deferred or phrased as bounded/possible—not asserted as “never” or
“impossible”.

## Conclusion

The validator contains a coherent stale cluster from the interaction-based
architecture: inline lifecycle, flow, recipe, economics, utilization, and simple
actor scheduling. `unused_resource` is the most visible member, but negative
profitability and actor overlap already produce independent false positives in
valid 2.2 projects, and actor reference/type handling has two more 2.2 gaps.
WorkSpec should preserve the strong document-local core, version-gate legacy
inline checks, and make project/history provenance explicit before expanding any
diagnostic set.
