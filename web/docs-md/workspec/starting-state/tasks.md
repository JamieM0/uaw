---
title: "Tasks"
description: "Reference authored static task declarations and canonical WorkSpec 2.2 task fields."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 380
---

# Tasks

`simulation.process.tasks` declares planned static work.

## Core fields

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `id` | string | Yes | Unique plain task ID. |
| `actor_id` | value expression | Yes | Performer ID or deterministic selection. |
| `duration` | duration | Yes | Positive planned duration. |
| `start` | time | Usually | Explicit start; dependencies can derive it. |
| `depends_on` | array or object | No | Required predecessor tasks. |
| `location` | string | No | Planned task location. |

## Runtime control fields

| Field | Type | Purpose |
|---|---|---|
| `when` | condition | Skips the task when false. |
| `requires` | condition | Blocks the task when false. |
| `while` | condition | Must remain true while the task is active. |
| `progress` | compact reference | Captures progress when a task terminates. |
| `continues` | object | Links recovery work to an interrupted source task. |
| `timing` | array | Adds relative offset or non-overlap constraints. |
| `reservations` | array | Claims exclusive or capacity-controlled resources. |

Tasks can also contain descriptive fields such as `description`, `priority`, and `tags`.

## Example

```json
{
  "id": "sterilize_load",
  "actor_id": "autoclave_1",
  "start": "09:00",
  "duration": "30m",
  "location": "sterile_zone",
  "when": { ">": ["@load.quantity", 0] },
  "reservations": [
    { "resource": "autoclave_1", "mode": "exclusive" }
  ]
}
```

## Executable behavior

Do not put `interactions`, `consumes`, `produces`, or `equipment_interactions` on a WorkSpec 2.2 task.

Author predetermined effects in Changes. The [executable source conventions](../sources/authoring.md) describe shared file rules.
