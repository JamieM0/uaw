# WorkSpec v2.0 Error Reference (All Error Codes)

This page lists validation error codes (`metric_id`) used for WorkSpec v2.0 validation.

If you are looking for the error format and severity semantics, see:

- [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation)

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

In the UAW Playground validator implementation, the default is currently:

```
https://universalautomation.wiki/workspec/errors/{metric_id}
```

### `instance`

`instance` is a JSON Pointer to the exact location in the document.

Common pointer shapes in WorkSpec v2.0:

- `/simulation/schema_version`
- `/simulation/meta`
- `/simulation/world/objects/{index}`
- `/simulation/process/tasks/{index}`

---

## Error code catalog

This catalog includes:

- WorkSpec v2.0 schema/versioning errors emitted by the validator
- Built-in UAW validation metrics for WorkSpec documents

| metric_id | severity | title | Description (what it checks) | Typical fix |
|---|---|---|---|---|
| `schema.integrity.missing_root` | error | Simulation Root Check | Ensures the top-level `simulation` object exists. | Wrap the document in `{ "simulation": { ... } }`. |
| `schema.integrity.missing_version` | error | Missing Schema Version | Missing required `simulation.schema_version` (WorkSpec v2 requires version declaration). | Add `simulation.schema_version: "2.0"`. |
| `schema.integrity.invalid_version` | error | Invalid Schema Version | `simulation.schema_version` is not Major.Minor (e.g., `"2.0"`). | Use `"2.0"` and keep Major.Minor format. |
| `schema.integrity.unsupported_version` | error | Unsupported Schema Version | `simulation.schema_version` is not supported by the validator. | Use the supported version (`"2.0"`). |
| `schema.integrity.missing_world` | error | Missing World Section | Missing required section `simulation.world`. | Add `simulation.world` with `objects` (required) and optional `layout`. |
| `schema.integrity.missing_process` | error | Missing Process Section | Missing required section `simulation.process`. | Add `simulation.process` with `tasks` (required) and optional `recipes`. |
| `schema.integrity.invalid_world_objects` | error | Invalid World Objects | `simulation.world.objects` must be an array. | Set `simulation.world.objects` to `[]` or an array of objects. |
| `schema.integrity.invalid_process_tasks` | error | Invalid Process Tasks | `simulation.process.tasks` must be an array. | Set `simulation.process.tasks` to `[]` or an array of tasks. |
| `schema.integrity.missing_meta` | error | Missing Meta Section | Missing required section `simulation.meta`. | Add `simulation.meta` with required fields. |
| `schema.integrity.missing_meta_fields` | error | Missing Meta Fields | Missing required meta fields: `title`, `description`, `domain`. | Add required fields to `simulation.meta`. |
| `schema.integrity.disallowed_meta_field` | error | Disallowed Meta Field | Legacy field `meta.article_title` is not allowed in WorkSpec v2.0. | Remove `meta.article_title` and use `meta.title`. |
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
