# WorkSpec 2.1 Error Reference (All Error Codes)

This page lists validation error codes (`metric_id`) used for WorkSpec 2.1 validation.

If you are looking for the error format and severity semantics, see:

- [/docs/workspec/specification/v2.1/](/docs/workspec/specification/v2.1/)

---

## Error identifier fields

### `metric_id`

Every problem includes a `metric_id`:

```
{domain}.{category}.{specific}
```

Example: `task.integrity.invalid_start_time`

### `type`

`type` is a URI identifier for the kind of problem.

In the WorkSpec specification, `type` is expected to be within the WorkSpec namespace, for example:

```
https://universalautomation.wiki/workspec/errors/...
```

In the WorkSpec Studio validator implementation, the default is currently:

```
https://universalautomation.wiki/workspec/errors/{metric_id}
```

### `instance`

`instance` is a JSON Pointer to the exact location in the document.

Common pointer shapes in WorkSpec 2.1:

- `/simulation/schema_version`
- `/simulation/meta`
- `/simulation/world/objects/{index}`
- `/simulation/process/tasks/{index}`

---

## Error code catalog

This catalog includes:

- WorkSpec 2.1 schema/versioning errors emitted by the validator
- Built-in UAW validation metrics for WorkSpec documents

| metric_id | severity | title | Description (what it checks) | Typical fix |
|---|---|---|---|---|
| `schema.integrity.missing_root` | error | Simulation Root Check | Ensures the top-level `simulation` object exists. | Wrap the document in `{ "simulation": { ... } }`. |
| `schema.integrity.missing_version` | error | Missing Schema Version | Missing required `simulation.schema_version` (WorkSpec v2 requires version declaration). | Add `simulation.schema_version: "2.1"`. |
| `schema.integrity.invalid_version` | error | Invalid Schema Version | `simulation.schema_version` is not Major.Minor (e.g., `"2.1"`). | Use `"2.1"` and keep Major.Minor format. |
| `schema.integrity.unsupported_version` | error | Unsupported Schema Version | `simulation.schema_version` is not supported by the validator. | Use the supported version (`"2.1"`). |
| `schema.integrity.missing_world` | error | Missing World Section | Missing required section `simulation.world`. | Add `simulation.world` with `objects` (required) and optional `layout`. |
| `schema.integrity.missing_process` | error | Missing Process Section | Missing required section `simulation.process`. | Add `simulation.process` with `tasks` (required) and optional `recipes`. |
| `schema.integrity.invalid_world_objects` | error | Invalid World Objects | `simulation.world.objects` must be an array. | Set `simulation.world.objects` to `[]` or an array of objects. |
| `schema.integrity.invalid_process_tasks` | error | Invalid Process Tasks | `simulation.process.tasks` must be an array. | Set `simulation.process.tasks` to `[]` or an array of tasks. |
| `reference.compact.grammar` | error | Invalid Compact Reference | A ValueExpression begins with one `@` but is not `@entity.member` or `@now`, or attempts a nested path. | Use compact syntax such as `"@shipment.temperature"`; use `@@` for a literal leading `@`. |
| `reference.entity.unknown` | error | Unknown Reference Entity | The entity before the dot does not match a globally declared entity ID. | Fix the ID or declare the entity. |
| `reference.member.unknown` | error | Unknown Reference Member | The member is neither an allowed built-in field nor a direct property on that entity. | Use an existing direct member, for example `"@shipment.temperature"`. |
| `reference.clock.invalid` | error | Invalid Clock Reference | A clock expression is not exactly `"@now"`. | Use `"@now"`; do not append a member. |
| `reference.structured.malformed` | error | Malformed Compatibility Reference | A reference-key-only object does not exactly match a supported compatibility shape. | Replace it with compact `"@entity.member"` syntax. |
| `reference.property.dotted` | error | Dotted Property Name | A referenceable property name contains `.`, which is reserved for compact references. | Rename it with underscores, such as `sensor_temperature`. |
| `reference.property.shadows_builtin` | error | Built-in Property Collision | A property has the same name as a referenceable built-in field. | Rename the property; built-in fields take precedence. |
| `collection.reference.unknown` | error | Unknown Runtime Collection | A quantifier, selection, or work trigger names an undeclared collection. | Declare it in `simulation.collections` or fix the ID. |
| `collection.binding.invalid` | error | Invalid Member Binding | A collection alias is missing, malformed, or ambiguously uses `current`. | Declare a plain local alias such as `member`, `candidate`, or `file`. |
| `collection.cutoff.invalid` | error | Invalid Open Collection Cut-off | An open collection lacks a valid finite `closes_at`. | Add a strict time/date-time cut-off. |
| `work_definition.id.duplicate` | error | Duplicate Work Definition | Two reusable work definitions use the same ID. | Give each definition a unique plain ID. |
| `instance.trigger.collection.invalid` | error | Invalid Instance Trigger | `instantiate.for_each` does not name a live collection. | Fix the collection ID. |
| `instance.identity.collision` | error | Runtime Instance Identity Collision | A deterministic runtime instance ID collides with another task. | Rename the definition or colliding authored task. |
| `actor.selection.policy.invalid` | error | Invalid Selection Policy | `select_member` uses an unsupported or nondeterministic policy. | Use `first_by_id`, `lowest`, or `highest`. |
| `actor.selection.tie` | error | Unresolved Selection Tie | Ranked candidates tie without a deterministic tie-break. | Add `"tie_break": "stable_id"`. |
| `actor.selection.by.type` | error | Invalid Selection Rank Type | A ranked selection's `by` expression is definitely non-numeric. | Rank by a numeric property or arithmetic expression. |
| `value.arithmetic.type` | error | Invalid Arithmetic Operand | A pure arithmetic operand is definitely non-numeric. | Use numeric operands; WorkSpec does not coerce. |
| `value.arithmetic.division_by_zero` | error | Division By Zero | A divisor is zero. | Change the expression or guard the modeled state. |
| `reservation.amount.type` | error | Invalid Reservation Amount Type | A capacity amount is definitely non-numeric. | Use a numeric ValueExpression. |
| `object.property.type.declared` | error | Declared Property Type Mismatch | An initial custom property value contradicts its `type_definitions` declaration. | Correct the value or the custom property declaration. |
| `reservation.conflict.possible` | warning | Possible Branch Reservation Conflict | Co-timed branch claims are not provably mutually exclusive. | Use simple exclusive guards or remove the conflict. |
| `temporal.scheduling.actor_overlap_possible` | warning | Possible Branch Actor Conflict | Co-timed actor claims are not provably mutually exclusive. | Use simple exclusive guards or assign distinct performers. |
| `schema.integrity.missing_meta` | error | Missing Meta Section | Missing required section `simulation.meta`. | Add `simulation.meta` with required fields. |
| `schema.integrity.missing_meta_fields` | error | Missing Meta Fields | Missing required meta fields: `title`, `description`, `domain`. | Add required fields to `simulation.meta`. |
| `schema.integrity.disallowed_meta_field` | error | Disallowed Meta Field | Legacy field `meta.article_title` is not allowed in WorkSpec 2.1. | Remove `meta.article_title` and use `meta.title`. |
| `schema.integrity.disallowed_types` | error | Disallowed Object Types | Ensures no objects use internally reserved types that could cause system conflicts. | Use allowed types; avoid reserved names (e.g., `_internal`, `timeline_actors`). |
| `object.integrity.invalid_object_id` | error | Invalid Object ID | Ensures object IDs are unique strings and not empty/null. | Use unique, non-empty snake_case IDs (max 250 chars). |
| `object.integrity.missing_required_properties` | error | Missing Required Properties | Check that objects have required properties based on their type. | Add the missing properties (e.g., `quantity` for resources/products). |
| `object.integrity.invalid_property_types` | error | Invalid Property Types | Validate that object properties match expected data types. | Fix property value types (number vs string vs boolean). |
| `object.spatial.location_undefined` | error | Undefined Location | Ensures every object with a location property references a valid layout location. | Add the location to `world.layout.locations` or fix the ID. |
| `resource.flow.negative_stock` | error | Negative Stock Check | Verifies that no consumable resource stock level drops below zero. | Increase starting stock or reduce consumption. |
| `resource.flow.recipe_violation` | warning | Recipe Ingredients Check | If a task produces a product with a recipe, checks required inputs are consumed in that task. Missing inputs produce warnings. | Add missing input consumption interactions or adjust/remove the recipe. |
| `resource.integrity.invalid_quantity` | error | Invalid Quantity Values | Ensure resource quantities are non-negative numbers. | Use numeric `quantity >= 0`. |
| `resource.integrity.type_consistency` | error | Resource Type Consistency | Ensure resources maintain consistent types throughout interactions. | Keep `quantity` numeric; avoid switching types across tasks. |
| `resource.definition.unused` | info | Unused Resource | Flags resources defined but never consumed or produced. | Remove unused resources or add tasks that use them. |
| `task.integrity.invalid_task_id` | error | Invalid Task ID | Ensures task IDs are unique strings and not empty/null. | Use unique snake_case task IDs. |
| `task.integrity.unassigned_actor` | error | Unassigned Task Actor | Ensures every task is assigned to a valid performer object. | Set `actor_id` to an existing performer (`actor`, `equipment`, `service`). |
| `task.integrity.invalid_start_time` | error | Invalid Start Time Format | Ensures task start times follow strict WorkSpec formats (time-of-day, ISO date-time, or `{day,time}`). | Use `"HH:MM"` (zero-padded), `"HH:MM:SS"`, ISO date-time, or `{ "day": N, "time": "HH:MM" }`. |
| `task.integrity.invalid_duration` | error | Invalid Task Duration | Ensures task durations are valid (positive integer, ISO 8601 duration, or shorthand). | Use `30`, `"PT30M"`, `"30m"`, `"1h"`, etc. |
| `task.integrity.invalid_object_reference` | error | Invalid Object Reference | Ensures tasks and interactions reference valid object IDs. | Fix IDs; ensure objects are created before use and not deleted before use. |
| `task.integrity.end_time_overflow` | error | Task End Time Overflow | Checks if `start + duration` causes invalid day boundary handling. | Use multi-day start objects or adjust times/durations. |
| `task.while.failed_at_start` | error | Initial Active Invariant Failed | A task's `while` condition is false before activation. | Correct modeled state or author a conditional branch; the task is blocked, not briefly started. |
| `task.progress.invalid` | error | Invalid Progress Reference | Task progress is not one compact reference to a world object or location member. | Use a compact reference such as `"@blood_unit_42.infused_ml"`. |
| `reference.task.progress.undeclared` | error | Undeclared Task Progress | `@task.progress` refers to a task without a `progress` declaration. | Declare observational progress on the source task or remove the reference. |
| `reference.task.runtime_field.compact_required` | error | Compact Runtime Reference Required | A new task runtime field uses structured compatibility syntax. | Use `"@task.status"`, `"@task.actual_end"`, or `"@task.progress"`. |
| `task.continues.invalid` | error | Invalid Continuation | `continues` is malformed. | Use `{ "task": "interrupted_task" }`. |
| `task.continues.unknown` | error | Unknown Continuation Source | The continuation source task does not exist. | Fix the source task ID. |
| `task.continues.self` | error | Self Continuation | A task attempts to continue itself. | Reference a distinct interrupted task. |
| `task.continues.cycle` | error | Continuation Cycle | Static continuation links form a cycle. | Break the cycle. |
| `task.continues.source_not_interrupted` | error | Continuation Source Not Interrupted | A continuation reaches its start while the source is not interrupted. | Guard with `@source.status` and time from `@source.actual_end`. |
| `task.lifecycle.transition.invalid` | error | Illegal Lifecycle Transition | Runtime code attempted a transition outside the WorkSpec lifecycle. | Use only pending-to-start/terminal or active-to-completed/interrupted transitions. |
| `task.dependency.unreachable` | error | Unreachable Task Dependency | Ensures every `depends_on` reference points to an existing task. | Fix typos; add missing tasks; remove invalid dependencies. |
| `task.dependency.self_reference` | error | Self-Referencing Dependencies | Catches tasks that depend on themselves. | Remove the self-reference. |
| `task.dependency.missing_reference` | error | Missing Task Dependencies | Validates referenced dependency IDs exist. | Fix dependency IDs. |
| `task.dependency.circular_reference` | error | Circular Dependencies | Detects cycles in task dependency chains. | Break cycles by removing/rewriting dependencies. |
| `temporal.dependency.violation` | warning | Task Dependency Timing | Ensures no task starts before its dependency condition is met. | Move task start later or fix dependencies. |
| `actor.scheduling.overlap` | error | Actor Task Overlap | Checks if an actor is assigned overlapping tasks. | Adjust times/durations or assign a different performer. |
| `equipment.state.logic` | error | Equipment State Logic | Checks for logical consistency in equipment usage (e.g., using dirty equipment). | Fix state transitions; add cleaning tasks; adjust `from/to`. |
| `equipment.state.invalid_transitions` | error | Invalid State Transitions | Validates state transitions are logically valid. | Use sensible `from`/`to` sequences or `set` when appropriate. |
| `equipment.integrity.invalid_capacity` | error | Equipment Capacity Validation | Checks equipment `capacity` values are positive integers. | Set `capacity` to a positive integer. |
| `task.spatial.unmet_proximity_requirement` | error | Task Proximity Check | Checks actors and required objects are in the same location as the task. | Align locations or add movement/location-change tasks/interactions as needed. |
| `display.spatial.elements_outside_bounds` | warning | Display Elements Outside Bounds | Checks if display elements extend beyond the display viewport. | Resize or reposition UI elements. |
| `scheduling.optimization.missing_buffer` | info | Missing Buffer Time | Suggests adding buffers between consecutive tasks for realism. | Add small gaps between tasks (same performer). |
| `economic.profitability.negative_margin` | warning | Negative Profitability | Computes total revenue minus labor and resource costs; warns on negative results. | Adjust costs/revenue, productivity, or resource consumption. |
| `system.error` | error | System Error | Validator internal error (configuration or execution failure). | Inspect validator logs/config; simplify document and retry. |
| `system.info` | info | System Info | Validator informational message. | No action required. |
