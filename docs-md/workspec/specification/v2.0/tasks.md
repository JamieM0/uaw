# WorkSpec v2.0 Task Model

Tasks define the dynamic process: who performs work, when it starts, how long it takes, and what it changes.

---

## Where tasks live (v2.0)

Tasks are defined under:

- `simulation.process.tasks[]`

---

## Task structure

```json
{
    "id": "mix_dough",
    "emoji": "🥄",
    "actor_id": "head_baker",
    "start": "06:30",
    "duration": 20,
    "location": "prep_area",
    "depends_on": ["measure_ingredients"],
    "interactions": [],
    "description": "Mix all ingredients in industrial mixer",
    "priority": "high",
    "tags": ["preparation", "mixing"]
}
```

### Fields

| Field | Required | Type | Meaning |
|---|---:|---|---|
| `id` | Yes | string | Task identifier |
| `emoji` | No | string | Visual icon |
| `actor_id` | Yes | string | Performer object id |
| `start` | Yes | time/date-time or `{day,time}` | Start time |
| `duration` | Yes | integer or duration string | How long the task takes |
| `location` | No | string | Location id (where it occurs) |
| `depends_on` | No | array or `{all,any}` | Dependency constraints |
| `interactions` | No | array | Effects on objects |
| `description` | No | string | Human-readable notes |
| `priority` | No | enum | `low` \| `medium` \| `high` \| `critical` |
| `tags` | No | string[] | Labels for filtering |

---

## Task ID rules

Task IDs follow the same rules as object IDs:

- Plain IDs (recommended): `^[a-z][a-z0-9_]{0,249}$`
- Optional namespacing is allowed for objects (not required for tasks).

Task IDs must be unique within `simulation.process.tasks[]`.

---

## `actor_id` (performers)

`actor_id` must reference an object that can perform tasks.

Built-in performer types:

- `actor`
- `equipment`
- `service`

Custom types can perform tasks if their base type (via `extends`) is a performer type.

---

## Start times

WorkSpec v2.0 supports:

1) Time-of-day strings (strict, zero-padded):

- `HH:MM` (e.g., `"09:30"`)
- `HH:MM:SS` (e.g., `"09:30:00"`)

2) ISO 8601 date-time strings:

- `"2026-02-03T09:30:00Z"`

3) Multi-day start object:

```json
{ "day": 2, "time": "09:30" }
```

Rules:

- `day` is an integer >= 1
- `time` uses the same formats as above
- Time-of-day strings must be strictly zero-padded (`"09:30"`, not `"9:30"`)

---

## Duration formats

Task durations can be expressed as:

1) Integer (uses `simulation.config.time_unit`):

```json
{ "duration": 30 }
```

2) ISO 8601 duration:

```json
{ "duration": "PT30M" }
```

3) Shorthand duration:

```json
{ "duration": "30m" }
{ "duration": "1h" }
{ "duration": "1d" }
{ "duration": "10s" }
{ "duration": "1w" }
{ "duration": "1M" }
```

Notes:

- Integer durations require `simulation.config.time_unit` to interpret units (if missing, a consumer may default to minutes).
- Month/year durations (e.g., `"1M"`, `"P1M"`, `"P1Y"`) are **calendar-based** and require an ISO 8601 start timestamp to compute an exact number of minutes. If your simulation uses time-of-day starts (`"HH:MM"`) without calendar dates, prefer durations expressed in seconds/minutes/hours/days/weeks.

---

## Dependencies

### Simple form (implicit AND)

```json
{ "depends_on": ["task_a", "task_b"] }
```

The task waits for **all** dependencies to complete.

### Explicit operators

```json
{
    "depends_on": {
        "all": ["prep_complete", "equipment_ready"],
        "any": ["manager_approval", "auto_approval"]
    }
}
```

Semantics:

- Wait for (ALL of `all`) AND (ANY of `any`)

Validation expectations:

- Dependency references must point to existing task IDs.
- Circular dependencies should be detected and rejected.
- Dependency timing must be respected (a task cannot start before the required dependency condition is met).

---

## Multi-day simulations

WorkSpec v2.0 supports multi-day scheduling via:

```json
{ "start": { "day": 2, "time": "09:30" } }
```

This is a day offset (1 = first day, 2 = second day, etc.), not a calendar date.
