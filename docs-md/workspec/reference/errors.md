# WorkSpec 2 error reference

WorkSpec problems use an RFC-7807-style structure:

```json
{
  "type": "https://universalautomation.wiki/workspec/errors/task.integrity.invalid_duration",
  "title": "Invalid Task Duration",
  "severity": "error",
  "detail": "Task 'mix' has invalid duration.",
  "instance": "/simulation/process/tasks/0/duration",
  "metric_id": "task.integrity.invalid_duration",
  "scope": "document",
  "provenance": { "layer": "document", "source": "start.workspec.json" },
  "context": { "task_id": "mix" },
  "suggestions": []
}
```

## Scope and provenance

| Scope | Source of truth | Examples |
|---|---|---|
| `document` | `start.workspec.json` | Schema, IDs, initial objects/properties/references, task syntax, dependency graph. |
| `source` | Relationships among project source files | Unknown Changes task IDs and JavaScript compilation errors. |
| `runtime` | A resolved run | Actor liveness, reservations/capacity, lifecycle, timing, movement, state writes. |
| `constraint` | User-authored invariants over resolved history | Domain stock, recipe, economic, safety, and service-level policy. |

## Common current metric IDs

| Metric | Scope | Meaning |
|---|---|---|
| `schema.integrity.missing_root` | document | The canonical `simulation` root is missing. |
| `schema.integrity.unsupported_version` | document | `schema_version` is not supported. |
| `object.integrity.invalid_object_id` | document | An initial object ID is malformed. |
| `object.integrity.missing_required_properties` | document | An initial object lacks properties required by its type. |
| `object.reference.invalid_location` | document/runtime | An initial reference or executed move names an undeclared location; provenance distinguishes the case. |
| `state_visuals.reference.invalid_state` | document | An object's initial state is outside its State Library. |
| `state_visuals.reference.invalid_runtime_state` | runtime | An executed write would assign a state outside the object's State Library. |
| `task.integrity.invalid_task_id` | document | A planned task ID is missing, malformed, or duplicated. |
| `task.integrity.invalid_start_time` | document | A task start is malformed. |
| `task.integrity.invalid_duration` | document | A task duration is malformed. |
| `task.reference.invalid_dependency` | document | A declared dependency is malformed or unknown. |
| `task.reference.invalid_actor` | document/runtime | An initial literal performer is incapable, or runtime selection did not resolve to a live performer. |
| `temporal.scheduling.circular_dependency` | document | The authored dependency graph contains a cycle. |
| `temporal.scheduling.dependency_violation` | document/runtime | An authored timing bound or actual executed dependency is violated. |
| `changes.task.unknown` | source | Changes names a task absent from Starting State. |
| `changes.compile.failed` | source | Changes could not compile. |
| `generator.compile.failed` | source | Generator could not compile. |
| `generator.execution.failed` | runtime | Generator threw during execution. |
| `generator.changes.conflict` | runtime | Generator won a same-time write over Changes. |
| `runtime.execution.event_limit` | runtime | Execution exceeded the bounded event safety limit. |
| `reservation.capacity.exceeded` | runtime | Actual reservations exceed declared capacity. |
| `reservation.exclusive.conflict` | runtime | Actually executing tasks attempted conflicting exclusive reservations. |
| `state_visuals.reference.unknown_library` | runtime | A runtime-created object named an unknown State Library. |
| `task.lifecycle.transition.invalid` | runtime | A task attempted an invalid status transition; failed effects use the explicit `failed` status. |
| `object.optimization.unused_resource` | runtime | An initial resource was unused through an explicit finite horizon. |
| `constraint.compile.failed` | constraint | Constraints could not compile. |
| `constraint.execution.failed` | constraint | A Constraint threw during execution. |

## WorkSpec 2.2 exclusions

Document validation does not emit unqualified 2.2 claims for unused resources,
profitability, stock history, recipe fulfillment, actor overlap, lifecycle, or
interaction effects. Those facts depend on Changes, optional Generator behavior,
runtime conditions, and a finite analysis horizon, or they express domain policy
that belongs in Constraints.

WorkSpec 2.0/2.1 retain their version-gated inline-interaction diagnostics.
Legacy flat-model catalog IDs such as `resource.definition.unused`,
`actor.scheduling.overlap`, and `resource.flow.recipe_violation` are not canonical
WorkSpec 2.2 metric IDs.
