# WorkSpec v2.0 JSON Schema Reference

This page describes the WorkSpec v2.0 JSON Schema and how to use it for autocomplete and validation.

---

## Canonical schema URI

Use this `$schema` value in WorkSpec documents:

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json"
}
```

Schema identity:

- `$id`: `https://universalautomation.wiki/workspec/v2.0.schema.json`
- Draft: `http://json-schema.org/draft-07/schema#`

The UAW Playground ships a local copy of this schema at:

- `/workspec/v2.0.schema.json`

---

## What the schema validates

At a high level, the schema validates:

- WorkSpec root structure (`simulation` object)
- v2.0 structure (`simulation.world` and `simulation.process`)
- required meta fields (`title`, `description`, `domain`)
- time formats (strict `HH:MM`, `HH:MM:SS`, or ISO 8601 date-time)
- duration formats (integer, ISO 8601 duration, or shorthand)
- object/task required fields and ID patterns
- interaction shapes (property-change vs create vs delete)

For additional validation rules beyond JSON Schema (like cross-reference checks and lifecycle checks), see:

- [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation)

---

## Key schema fragments (v2.0)

### Document root

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": { }
}
```

### Simulation required fields

`simulation` requires:

- `schema_version` (must be `"2.0"`)
- `meta`
- `config`
- `world`
- `process`

### Meta required fields

`meta` requires:

- `title`
- `description`
- `domain`

### World/Process split

- `simulation.world.objects` is an array of objects
- `simulation.process.tasks` is an array of tasks
- `simulation.process.recipes` is optional

---

## ID patterns

The schema validates:

- Plain IDs: `^[a-z][a-z0-9_]{0,249}$`
- Object IDs may optionally be namespaced: `{type}:{identifier}` (max length 250)

Namespaced IDs are additionally validated by WorkSpec validators (namespace must match `type`).

---

## Time and duration patterns

### Time strings

`TimeOrDateTime` is any of:

- `HH:MM` (strict, zero-padded)
- `HH:MM:SS` (strict, zero-padded)
- ISO 8601 date-time (`format: "date-time"`)

### Duration

`Duration` supports:

- integer >= 1
- shorthand: `^\d+[smhdwWM]$`
- ISO 8601 durations: `^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$`

For the semantics of months/years, see [/docs/workspec/specification/v2.0/tasks](/docs/workspec/specification/v2.0/tasks).

---

## Authoritative schema file

The authoritative JSON Schema shipped in this repository is:

- `web/workspec/v2.0.schema.json`
