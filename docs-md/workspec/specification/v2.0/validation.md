# WorkSpec v2.0 Validation & Errors

WorkSpec is designed to be validation-first. Validators should provide precise, actionable feedback before a document is executed or simulated.

This page defines the error format and the core validation rules required for v2.0.

See also:

- Error code reference: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
- JSON Schema: [/docs/workspec/specification/v2.0/schema](/docs/workspec/specification/v2.0/schema)

---

## Problem Details (RFC 7807)

All validation results are represented using RFC 7807 **Problem Details** with WorkSpec extensions.

```json
{
    "type": "https://universalautomation.wiki/workspec/errors/{category}/{specific}",
    "title": "Human-Readable Title",
    "severity": "error",
    "detail": "Detailed explanation of what went wrong.",
    "instance": "/simulation/path/to/problem",
    "metric_id": "schema.integrity.missing_version",
    "context": {
        "relevant": "data"
    },
    "suggestions": [
        "First suggested fix",
        "Second suggested fix"
    ],
    "doc_uri": "https://universalautomation.wiki/workspec/docs/errors/{specific}"
}
```

### Required fields

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | URI | Yes | Error type identifier |
| `title` | string | Yes | Short, human-readable title |
| `severity` | enum | Yes | `error` \| `warning` \| `info` |
| `detail` | string | Yes | Full explanation |
| `instance` | JSON Pointer | Yes | Pointer to the exact location in the document |
| `metric_id` | string | Yes | Validation metric identifier |
| `context` | object | Yes | Structured debugging data |
| `suggestions` | string[] | Yes | Fix suggestions |
| `doc_uri` | URI | No | Documentation link |

### Severity semantics

| Severity | Meaning | Blocks execution |
|---|---|---:|
| `error` | Invalid document | Yes |
| `warning` | Suspicious but allowed | No |
| `info` | Optimization or note | No |

---

## Example error (invalid time)

```json
{
    "type": "https://universalautomation.wiki/workspec/errors/invalid-time-format",
    "title": "Invalid Time Format",
    "severity": "error",
    "detail": "Task 'proof_dough' has invalid start time '07:60'. Minutes must be 00-59.",
    "instance": "/simulation/process/tasks/2/start",
    "metric_id": "task.integrity.invalid_start_time",
    "context": {
        "task_id": "proof_dough",
        "field": "start",
        "value": "07:60"
    },
    "suggestions": [
        "Change to '08:00' if you meant 8:00 AM",
        "Change to '07:59' if you meant 7:59 AM"
    ]
}
```

---

## Metric IDs

Metric IDs are namespaced:

```
{domain}.{category}.{specific}
```

Domains used in WorkSpec validation include:

- `schema` — structural correctness
- `object` — object-level issues
- `task` — task-level issues
- `resource` — resource flow
- `temporal` — scheduling/dependencies
- `economic` — costs/revenue/profitability
- `spatial` — layout/location references
- `recipe` — recipe compliance
- `custom` — user-defined metrics

---

## Required validation rules (v2.0)

This list describes the core rules a v2.0 validator must enforce.

### Schema rules

- `simulation` must exist.
- `simulation.schema_version` must exist and match supported versions (v2.0: `"2.0"`).
- Document structure must include `simulation.world` and `simulation.process`.
- `simulation.world.objects` must be an array.
- `simulation.process.tasks` must be an array.
- `simulation.meta` must exist and include required v2 fields (`title`, `description`, `domain`).
- `meta.article_title` must not be present.

### Object rules

- Objects must include required fields: `id`, `type`, `name`.
- Object IDs must follow the ID rules (including optional `{type}:{id}` namespacing).
- Disallowed type aliases (`material`, `ingredient`, `tool`) must be rejected.
- Reserved type names must be rejected.
- Custom types must have corresponding `simulation.type_definitions` entries and valid `extends`.
- `location` values must reference a valid location if a layout is present.

### Task rules

- Tasks must include required fields: `id`, `actor_id`, `start`, `duration`.
- `actor_id` must reference a valid performer object.
- Task `start` must be valid and strictly formatted.
- Task `duration` must be valid (integer, ISO 8601 duration, or shorthand).
- `depends_on` must reference valid task ids and must not contain cycles.
- Dependency timing must be respected (task cannot start before dependency condition is met).

### Interaction rules

- `target_id` is required for property-change interactions and delete interactions.
- `property_changes` is required for property-change interactions.
- `object` is required for create interactions.
- Legacy interaction fields `object_id` and `revert_after` must be rejected.
- References to deleted objects must be rejected.

### Recipe rules (optional; warnings)

If recipes are provided under `simulation.process.recipes`, a validator may check recipe compliance:

1. When a task produces a product (positive quantity delta), check for `recipes[product_id]`.
2. If a recipe exists, verify that required inputs are consumed by that task.
3. Missing inputs produce a **warning**, not an error.

Recipe schema details (inputs/equipment/output quantity/process time) live in:

- [/docs/workspec/specification/v2.0/](/docs/workspec/specification/v2.0/)

---

## Time format validation (strict)

Time strings must be strict and zero-padded:

- `HH:MM` where `HH` is `00`–`23` and `MM` is `00`–`59`
- `HH:MM:SS` where `SS` is `00`–`59`

Invalid times (example: `"07:60"`, `"9:30"`) must be rejected (not corrected).
