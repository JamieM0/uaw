# WorkSpec 2.1 Cheatsheet

One-page reference for authoring WorkSpec 2.1.

---

## Minimal skeleton

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.1.schema.json",
    "simulation": {
        "schema_version": "2.1",
        "meta": { "title": "...", "description": "...", "domain": "..." },
        "config": { "time_unit": "minutes", "start_time": "09:00", "end_time": "17:00", "currency": "USD", "locale": "en-US" },
        "world": { "layout": { "locations": [] }, "objects": [] },
        "process": { "tasks": [], "recipes": {} }
    }
}
```

---

## Required fields

- `simulation.schema_version`
- `simulation.meta.title`
- `simulation.meta.description`
- `simulation.meta.domain`
- `simulation.config.time_unit`
- `simulation.config.start_time`
- `simulation.config.end_time`
- `simulation.config.currency`
- `simulation.config.locale`
- `simulation.world.objects` (array)
- `simulation.process.tasks` (array)

---

## IDs

- Plain: `^[a-z][a-z0-9_]{0,249}$`
- Optional namespaced: `{type}:{id}` (namespace must equal `type`)

---

## Time formats (strict)

- `"HH:MM"` (zero-padded)
- `"HH:MM:SS"` (zero-padded)
- ISO 8601 date-time: `"2026-02-03T09:30:00Z"`
- Multi-day: `{ "day": 2, "time": "09:30" }`

---

## Duration formats

- Integer: `30` (uses `simulation.config.time_unit`)
- ISO 8601: `"PT30M"`, `"P1D"`
- Shorthand: `"30m"`, `"1h"`, `"1d"`, `"10s"`, `"1w"`, `"1M"`

If using months/years (`"1M"`, `"P1M"`, `"P1Y"`), use an ISO 8601 start timestamp.

---

## Dependencies

- Array (implicit AND): `["task_a","task_b"]`
- Operators:

```json
{ "all": ["task_a"], "any": ["task_b","task_c"] }
```

Meaning: (ALL of `all`) AND (ANY of `any`).

---

## Value references and literals

- Object field/property: `"@shipment.temperature"`
- Task field: `"@inspect.end"`
- Task runtime fields: `"@inspect.status"`, `"@inspect.actual_end"`, and `"@inspect.progress"` when progress is declared
- Location field/property: `"@cold_store.access_level"`
- Current performer: `"@current.permissions"`
- Clock: `"@now"`
- Literal string: `"approved"`
- Literal leading `@`: `"@@shipment.temperature"` evaluates to `"@shipment.temperature"`

Use exactly one dot and only a direct member. Never create dotted property names, nested paths, or structured selector references.

## Runtime collections and work

```json
"collections": {
  "files": { "from": "objects", "as": "member", "where": { "==": ["@member.type", "settlement_file"] } }
}
```

- Quantifiers: `all_members`, `any_members`, `no_members` with `collection`, `as`, and `satisfy`.
- Count: `{ "count_members": { "collection": "files", "as": "file", "where": { ... } } }`.
- Runtime work: `process.work_definitions[]` with `id`, `instantiate: { for_each, as }`, and a task template without `id` or `start`.
- Pending runtime work can use `cancel_pending_on_exit: true`; active work uses `while` interruption.
- An open collection requires `open: true` and `closes_at`.

## Derived values and selection

- Pure numeric expressions: `{ "+": [a, b] }`, `{ "-": [a, b] }`, `{ "*": [a, b] }`, `{ "/": [a, b] }`, `{ "min": [a, b] }`, `{ "max": [a, b] }`.
- Deterministic member selection: `{ "select_member": { "collection": "technicians", "as": "candidate", "policy": "lowest", "by": "@candidate.load", "tie_break": "stable_id" } }`.
- Policies: `first_by_id`, `lowest`, `highest`.
- `actor_id` may be a literal ID, compact reference, or `select_member` expression.
- WorkSpec dispatches deterministically; it does not globally optimize schedules or assignments.

## Frozen boundaries

- No automatic continuous physical-state evolution from elapsed time.
- No general external unbounded arrival source; modeled open collections require a finite `closes_at`.
- No global schedule/assignment optimisation and no stochastic or Monte Carlo core.
- No external transaction, IAM, delivery, or device-control guarantees.

## Guards and interruption

- `when`: should this task execute? False → `skipped`.
- `requires`: is it allowed to start? False → `blocked`.
- `while`: must this remain true while active? False initially → `blocked`; false at a modeled event boundary → `interrupted`.
- `progress: "@entity.member"`: capture that value at completion or interruption; never infer it from elapsed time.
- `continues: { "task": "source" }`: this separate task can start only when `source` is interrupted.
- `@task.end` is planned; `@task.actual_end` is completion/interruption time.

Interruption keeps permanent effects, suppresses completion effects, restores temporary effects, and releases reservations. Recovery is normal authored work using `@task.status` and `@task.actual_end`.

---

## Interactions

Property change:

```json
{ "target_id": "flour", "property_changes": { "quantity": { "delta": -1 } } }
```

Create:

```json
{ "action": "create", "object": { "id": "x", "type": "product", "name": "X" } }
```

Delete:

```json
{ "action": "delete", "target_id": "x" }
```

Temporary:

```json
{ "target_id": "machine", "property_changes": { "state": { "to": "in_use" } }, "temporary": true }
```

---

## Links

- WorkSpec 2.1: [/docs/workspec/specification/v2.1/](/docs/workspec/specification/v2.1/)
- Canonical schema: [/workspec/v2.1.schema.json](/workspec/v2.1.schema.json)
- Error reference: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
- Migration: [/docs/workspec/guides/migration](/docs/workspec/guides/migration)
