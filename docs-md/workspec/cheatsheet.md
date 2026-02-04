# WorkSpec v2.0 Cheatsheet

One-page reference for authoring WorkSpec v2.0.

---

## Minimal skeleton

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0",
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

- v2.0 overview: [/docs/workspec/specification/v2.0/](/docs/workspec/specification/v2.0/)
- Schema reference: [/docs/workspec/specification/v2.0/schema](/docs/workspec/specification/v2.0/schema)
- Error reference: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
- Migration: [/docs/workspec/guides/migration](/docs/workspec/guides/migration)
