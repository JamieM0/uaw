# WorkSpec validation rules reference

This reference describes current WorkSpec 2.2 validation. WorkSpec 2.0 and 2.1
inline-interaction checks remain supported for legacy documents, but are not
applied as project-wide conclusions to a 2.2 Starting State.

Every structured problem includes `metric_id`, `severity`, `instance`, `scope`,
and `provenance`. Scope is one of `document`, `source`, `runtime`, or
`constraint`.

## Document rules

Document validation reads only `start.workspec.json`.

| Rule family | What it establishes |
|---|---|
| `schema.integrity.*` | Canonical root, supported version, required sections, configuration, and Starting State boundaries. |
| `calendar.integrity.*` | Calendar and day-type declarations are internally valid. |
| `object.integrity.*` | Initial object IDs, types, type definitions, and required properties are valid. |
| `object.reference.invalid_location` | An initial object or planned task names a declared initial location. |
| `state_visuals.integrity.*` | State Library declarations are well formed. |
| `state_visuals.reference.*` | Initial object state and appearance references are declared. |
| `task.integrity.*` | Planned task IDs, starts, durations, dependencies, and other declarative syntax are valid. |
| `task.reference.invalid_dependency` | Declared dependency IDs exist. |
| `temporal.scheduling.circular_dependency` | The authored dependency graph is acyclic. |
| `temporal.scheduling.dependency_violation` | An explicit authored start contradicts the declared dependency timing bound. |
| `starting_state.behaviour.disallowed` | A 2.2 Starting State contains executable effects that belong in Changes. |

For 2.2, a literal `actor_id` that names an initial object is checked for
performer capability, including inherited traits with `can_be_actor_id: true`.
Missing performer expressions are document errors. General performer liveness is
a runtime fact because Changes or Generator may create the performer before use.

## Source rules

Project validation reports lightweight source facts such as:

| Metric | Meaning |
|---|---|
| `changes.task.unknown` | A statically known `WorkSpec.task("...")` ID is absent from Starting State. |
| `changes.task.dynamic` | A dynamic Changes task reference is deferred to runtime. |
| `changes.compile.failed` | Changes source could not compile. |
| `generator.compile.failed` | Generator source could not compile. |

Source analysis is deliberately limited. It does not pretend to prove behavior
for arbitrary JavaScript.

## Runtime and history rules

Runtime validation executes the project and reports actual or deliberately
bounded behavior. Important families include:

| Rule family | What it establishes |
|---|---|
| `task.*` | Runtime actor selection, conditions, lifecycle, and continuation are valid. |
| `timing.*`, `temporal.scheduling.*`, `dependency.*` | Resolved timing and executed scheduling constraints hold. |
| `reservation.*` | Reservations acquired by tasks that actually execute satisfy target, exclusivity, and capacity rules. |
| `interaction.*`, `object.lifecycle.*` | Executed effects target live objects and compatible properties. |
| `object.reference.invalid_location` | An executed move targets a location that exists at that point in the run. |
| `state_visuals.reference.invalid_runtime_state` | An executed state write uses a state declared by the object's State Library. |
| `generator.*` | Generator compilation, execution, or precedence produced a problem. |

`object.optimization.unused_resource` has special bounded semantics in 2.2. It is
not emitted by document validation. Project validation emits it only when the
caller supplies a finite horizon, and the problem context includes
`horizon_minutes`. A resource read by a task condition or Generator `get()`,
written, reserved, created, or removed during the run is considered used.

The built-in 2.2 validator does not emit `economic.profitability.negative_margin`,
`resource.flow.negative_stock`, or `recipe.compliance.missing_inputs` as generic
project policy. Their meaning depends on domain semantics and belongs in a
Constraint unless a future runtime metric defines explicit semantics and a
finite horizon.

## Constraints

Constraint IDs are user-authored. A violation is converted to the same structured
problem model with `scope: "constraint"` while retaining its time, objects,
property, observed value, and expected value.

## Legacy WorkSpec 2.0/2.1 rules

The canonical document validator preserves inline-interaction validation for
2.0/2.1, including interaction operators/actions, interaction targets and state,
inline lifecycle, recipe compliance, negative stock, profitability, actor
overlap, and unused resources. These rules inspect the behavior embedded in the
legacy document and are version-gated off for 2.2.

The older flat-model `SimulationValidator` and `metrics-catalog.json` use metric
IDs such as `resource.definition.unused` and `actor.scheduling.overlap`. Those IDs
are legacy catalog IDs, not current canonical WorkSpec 2.2 IDs.
