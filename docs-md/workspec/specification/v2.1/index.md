# WorkSpec 2.1

WorkSpec 2.1 models scheduled work whose execution and effects can depend on modeled state. The canonical schema is `/workspec/v2.1.schema.json`; the package validator and runtime define the normative semantics.

## IDs and values

Every authored entity `id` is unique across the document, even across entity kinds. Definition keys (`type_definitions`, `type_traits`, `state_libraries`, and `day_types`) keep their own namespaces. The exact entity ID `current` is reserved.

References use the compact `@entity.member` form:

```json
"@pallet_1.location"
"@pallet_1.temperature"
"@inspect.actor_id"
"@cold_store.access_level"
"@now"
```

WorkSpec resolves the globally unique entity first. A referenceable built-in field wins; otherwise the member must be a direct member of `properties`. Nested paths are not supported. Property names containing `.` are invalid, as are properties that shadow referenceable built-in fields. Use names such as `sensor_temperature` and `quality_result_final`.

`@current.member` selects the current task performer, whether it is an actor, equipment, service, or custom performer. `@now` is the only clock form.

In a ValueExpression, `"approved"` is a literal, `"@machine.state"` is a reference, and `"@@machine.state"` is the literal string `"@machine.state"`. Two or more leading `@` characters always lose exactly one. This escape applies only to ValueExpression positions; descriptions and other normal strings are unchanged.

## Conditions

Conditions use strict types and symbolic comparisons. There is no string/number or truthy/falsy coercion.

```json
{
  "all": [
    { "==": ["@receipt.verified", true] },
    { "<=": ["@shipment.exposure_minutes", 30] },
    { "contains": ["@current.permissions", "release"] }
  ]
}
```

The operators are `==`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `all`, `any`, `not`, and `held_for`. Comparisons and `contains` take exactly two operands. `all` and `any` take non-empty arrays.

```json
{
  "held_for": {
    "condition": { "==": ["@sensor.stable", true] },
    "duration": "10m"
  }
}
```

### Live collections and member quantifiers

Named collections are evaluated from one authoritative runtime snapshot. Membership can change at modeled state changes, but one condition evaluation never mixes snapshots.

```json
"collections": {
  "participating_groups": {
    "from": "objects",
    "as": "member",
    "where": { "==": ["@member.type", "response_group"] }
  }
}
```

`all_members`, `any_members`, and `no_members` quantify a collection. Their explicit `as` field declares the local member binding; it does not change `@current`, which still means the task performer.

```json
{
  "all_members": {
    "collection": "participating_groups",
    "as": "group",
    "satisfy": { "==": ["@group.clear", true] }
  }
}
```

`count_members` is a numeric ValueExpression and filters with `where`, for example `{ ">=": [{ "count_members": { "collection": "technicians", "as": "technician", "where": { "==": ["@technician.qualified", true] } } }, 2] }`. Existing `all` and `any` keep their authored-condition-list meaning.

## Pure derived values

ValueExpression supports side-effect-free `+`, `-`, `*`, `/`, `min`, and `max` objects. Each takes at least two finite numeric operands. There is no coercion, concatenation, unit conversion, assignment, or mutation, and division by zero is an error.

```json
{ "+": ["@sensor.reading", "@sensor.error"] }
{ "-": ["@batch.total", "@batch.used"] }
```

Derived values work in condition operands, effect values, created-object properties, capacity reservation amounts, and every other ValueExpression position. They calculate a value only; an authored interaction still decides if and when it is written.

## Task execution

`when` asks whether a task should execute; false means skipped. `requires` asks whether it is allowed to start; false means blocked. `while` asks what must remain true while it is active; false before activation blocks it, and false at a later modeled event boundary interrupts it. Skipped, blocked, and interrupted tasks do not satisfy dependencies.

```json
{
  "id": "create_archive",
  "actor_id": "archive_service",
  "start": "10:00",
  "duration": "5m",
  "depends_on": ["verify_receipt"],
  "when": { "==": ["@receipt.verified", true] },
  "requires": { "contains": ["@current.permissions", "archive"] },
  "while": { "==": ["@route.open", true] }
}
```

At task start WorkSpec checks dependency readiness, then `when`, `requires`, initial `while`, and reservations before start effects make it active. A false initial `while` never creates a start-and-immediate-interrupt interval.

## Interruption, progress, and continuation

The lifecycle is `pending → skipped|blocked|active`, then `active → completed|interrupted`. `interrupted` is terminal for that task instance. WorkSpec evaluates active `while` conditions after state-changing phases at modeled event boundaries; it does not continuously sample the world or create hidden timer events. At one timestamp it completes planned completions first, stabilizes active invariants, starts eligible work, and stabilizes again. A task whose planned end equals another state change therefore completes: intervals remain `[start, planned_end)` and **completion wins**.

On interruption, committed permanent effects remain, normal completion interactions are suppressed, temporary effects restore, all reservations release, and the stale planned completion event is suppressed. The runtime records the interruption time as `actual_end`.

`progress` is one observational compact world reference:

```json
{
  "id": "transfuse",
  "actor_id": "clinician",
  "start": "10:00",
  "duration": "60m",
  "while": { "==": ["@blood_unit_42.reaction_absent", true] },
  "progress": "@blood_unit_42.infused_ml"
}
```

At completion or interruption the current resolved value is captured in task history. WorkSpec does not infer it from elapsed duration and does not assume a percentage, monotonicity, zero start, or completion threshold. After termination, `@transfuse.progress` reads that stable capture. `@transfuse.status` reads the authoritative lifecycle state, `@transfuse.actual_end` reads the completion/interruption timestamp, and the existing `@transfuse.end` remains the planned end. `@task.progress` is invalid when that task has no `progress` declaration.

A continuation is a separate authored task interval:

```json
{
  "id": "continue_move",
  "actor_id": "replacement_operator",
  "duration": "20m",
  "continues": { "task": "move_pallet" },
  "when": { "==": ["@move_pallet.status", "interrupted"] },
  "timing": [{
    "relation": "offset",
    "event": "start",
    "relative_to": "@move_pallet.actual_end",
    "min_offset": "0m"
  }]
}
```

The source must be interrupted when the continuation starts. The new task acquires its own actor and reservations and has its own duration, conditions, effects, `while`, and progress. It does not reactivate, resume, or roll back the source. Recovery is ordinary authored work selected with `@task.status` and timed from `@task.actual_end`; there is no `on_interrupt` hook.

## Deterministic task timing

`duration` is required. `start` is optional only when WorkSpec can derive one unique earliest start from completion dependencies and lower timing bounds. An explicit `start` remains authoritative and is never moved; dependencies and timing constraints validate it.

```json
[
  { "id": "prepare", "actor_id": "operator", "start": "09:00", "duration": "20m" },
  { "id": "approve", "actor_id": "approver", "duration": "10m", "depends_on": ["prepare"] }
]
```

Here `approve` starts at `09:20`, exactly when `prepare` completes. Intervals are half-open, so this boundary is valid and the new task sees the predecessor's completion effects.

An array or `depends_on.all` derives from the latest predecessor completion: `max(A.end, B.end)`. For `depends_on.any`, skipped alternatives do not count; the earliest completed eligible alternative satisfies the join. If every alternative is skipped or blocked, the downstream start is unresolved. A direct dependency on a skipped task is likewise unsatisfied.

Lower offset bounds contribute to the derived earliest start. WorkSpec takes the maximum of every deterministic dependency and lower timing bound:

```json
{
  "id": "approve_refund",
  "actor_id": "approver",
  "duration": "10m",
  "depends_on": ["prepare_refund"],
  "timing": [{
    "relation": "offset",
    "event": "start",
    "relative_to": "@prepare_refund.end",
    "min_offset": "30m",
    "max_offset": "2h"
  }]
}
```

The lower bound derives the earliest start; the upper bound only validates it. A start-to-start bound uses `"@other.start"`. A startless task with no dependency or lower timing anchor is invalid.

## Runtime work definitions and instances

`process.work_definitions` holds reusable templates separately from authored `process.tasks`. `instantiate.for_each` creates exactly one task instance for each live member of a named collection, including members that appear after execution begins.

```json
{
  "id": "validate_file",
  "instantiate": {
    "for_each": "incoming_files",
    "as": "file",
    "start": "on_appearance",
    "cancel_pending_on_exit": true
  },
  "task": {
    "actor_id": "processor",
    "duration": "10m",
    "requires": { "==": ["@file.valid", true] },
    "interactions": [{
      "target_id": "@file.id",
      "property_changes": { "processed": { "set": true } }
    }]
  }
}
```

The runtime instance ID is a deterministic namespaced ID derived from the definition/member pair. Inspection retains `definition_id`, `correlation_id`, collection, appearance time, resolved timing, selected actor, and assignment history. Repeated or corrected input with the same member ID does not create another instance. Removing a member can cancel a pending instance when `cancel_pending_on_exit` is true; active work must instead be interrupted through its modeled `while` rule. Runtime instances use the same timing, dependency, condition, reservation, interaction, interruption, progress, and continuation event system as authored tasks.

Appearance time is a lower timing bound. Dependencies and other normal lower bounds can move a runtime instance to their deterministic maximum without scheduling search. `offset` adds a fixed delay to appearance. An open streaming collection declares `"open": true` and a finite `closes_at` cut-off; the runtime does not pretend an unbounded source has completed.

## Runtime performer and resource selection

`actor_id` may be a literal ID, a compact reference that resolves to a previously selected modeled ID, or a `select_member` expression. `select_member` also works in reservation `resource` and other ValueExpression positions.

```json
"actor_id": {
  "select_member": {
    "collection": "technicians",
    "as": "candidate",
    "where": { "==": ["@candidate.qualified", true] },
    "policy": "lowest",
    "by": "@candidate.load",
    "tie_break": "stable_id"
  }
}
```

The policies are `first_by_id`, `lowest`, and `highest`. Ranked policies require a numeric `by`. A ranked tie is an error unless `tie_break` is explicitly `stable_id`. Selection uses the start snapshot, then normal performer qualifications and reservations still apply. A reservation conflict blocks the resolved start; WorkSpec never delays the task or searches another schedule.

An active task is never rebound. Reassignment first interrupts through G008, releases reservations, and starts a distinct continuation task with a fresh deterministic binding. Each task interval retains its assignment history.

## Effect timing

Permanent interactions default to task completion. Set `at` to make start timing explicit. An interaction-level `when` suppresses only that effect.

```json
{
  "target_id": "shipment",
  "at": "completion",
  "when": { ">": ["@shipment.exposure_minutes", 30] },
  "property_changes": { "state": { "set": "quarantined" } }
}
```

Temporary property changes always apply at task start, capture the actual previous value, and restore it at completion or interruption:

```json
{
  "target_id": "machine",
  "temporary": true,
  "property_changes": { "state": { "set": "reserved" } }
}
```

Temporary create/delete and `temporary: true` with `at: "completion"` are invalid.

For one timestamp, temporary restoration and the completion-effects event occur before starts are evaluated. Restored values are therefore part of the pre-event snapshot used to resolve completion effects. A starting task sees another task's co-timed completion effects. Tasks starting together evaluate against the same pre-start snapshot and do not see one another's start effects.

Each completion-effects phase and start-effects phase is one WorkSpec simulation event. All eligible effects in one simulation event are resolved against the same pre-event snapshot and committed as one modeled state transition. Operands and interaction guards cannot observe writes from another effect in that event, and conditions, playback, State Visuals, and history samples cannot observe an intermediate state. Conflict checks apply to the complete co-timed write set: numeric `delta` writes to one property aggregate, while other multiple-writer combinations conflict.

This event atomicity exists only inside the WorkSpec simulation model. It does not imply an external transactional guarantee, database transaction, distributed transaction, crash consistency, or real-world atomic commit.

## Relative timing

Timing constraints validate resolved schedules. Lower offset bounds may derive a missing start as described above; upper bounds do not choose a time.

```json
"timing": [
  {
    "relation": "offset",
    "event": "start",
    "relative_to": "@prepare_refund.end",
    "min_offset": "30m",
    "max_offset": "2h"
  },
  {
    "relation": "not_overlap",
    "with": { "task": "fuelling_operation" }
  }
]
```

Task intervals are half-open: `[start, end)`. Two tasks may touch at one task's end without overlapping.

`not_overlap` is validation only. It never chooses whether one startless task belongs before or after another, because that would select between multiple legal schedules. Such an unresolved model is invalid.

## Reservations

An explicit `actor_id` is an implicit exclusive reservation for the task interval. Additional reservations are all-or-none.

```json
"reservations": [
  { "resource": "tug_01", "mode": "exclusive" },
  { "resource": "bay_04", "mode": "capacity", "amount": 1 },
  { "resource": "@current.id", "mode": "exclusive" }
]
```

Exclusive reservations target a live world object or a location. Capacity reservations target one of those entities with numeric, non-negative `properties.capacity`; `amount` must resolve to a positive number. Reservations occupy the actual active interval and release before co-timed acquisitions, including recovery work starting at an interruption timestamp.

Reservations validate the resolved interval. A conflict is reported at the explicit or derived start; WorkSpec does not delay the task to find a free slot or select a different resource.

Deterministic derivation stops whenever WorkSpec would have to choose among schedules, wait for resources, or optimize an objective. An `actual_end` timing anchor or runtime population may remain unresolved until its modeled event occurs; this is deterministic event resolution, not search.

WorkSpec can deterministically instantiate, quantify, bind, and dispatch. It does not globally optimize schedules or assignments, silently wait for a resource, invent a comparator, run arbitrary scripts, infer progress, provide mutable resume modes, or promise external transaction semantics.

## Frozen 2.1 limitations

These boundaries are intentional in the frozen 2.1 language:

- Physical properties do not evolve continuously or automatically from elapsed task time. State changes occur only at authored modeled events; `progress` observes a modeled value rather than synthesizing one.
- Runtime work can react to members of modeled collections, including finite open collections with `closes_at`, but 2.1 has no general external unbounded object-arrival source.
- Timing derivation, reservations, and selection are deterministic validation/dispatch mechanisms, not automatic or global schedule optimisation and not global assignment optimisation.
- Core semantics are deterministic. Stochastic distributions, Monte Carlo execution, and probabilistic branching are outside 2.1.
- WorkSpec event atomicity does not provide external database transactions, IAM enforcement, device-control safety, delivery guarantees, or other operational guarantees.

Model these concerns in a surrounding system when needed; do not encode them by inventing WorkSpec syntax.
