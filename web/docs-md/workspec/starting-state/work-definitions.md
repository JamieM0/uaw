---
title: "Work definitions"
description: "Reference reusable task templates that create runtime task instances from collection membership."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 420
---

# Work definitions

A work definition declares a reusable task template for matching collection members.

## Declaration

`simulation.process.work_definitions` is an array.

```json
{
  "id": "inspect_item",
  "instantiate": {
    "for_each": "items_to_inspect",
    "as": "item",
    "start": "on_appearance",
    "offset": "5m"
  },
  "task": {
    "actor_id": "inspector_1",
    "duration": "10m",
    "location": "inspection_room",
    "progress": "@item.inspected_percent"
  }
}
```

## Definition fields

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `id` | string | Yes | Unique plain work-definition ID. |
| `instantiate` | object | Yes | Describes collection-triggered instantiation. |
| `task` | object | Yes | Reusable task template. |

## Instantiation fields

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `for_each` | string | Yes | Existing collection ID. |
| `as` | string | Yes | Plain binding alias other than `current`. |
| `start` | string | No | If present, only `on_appearance`. |
| `offset` | offset | No | Delay from member appearance. |

## Task template

The template supports task duration, performer, guards, progress, timing, reservations, dependencies, and descriptive task fields.

Do not declare `id` or `start` in the template. The runtime supplies deterministic identity and appearance-based timing.

## Runtime boundary

The runtime creates a task instance for each eligible member. It records the definition ID, correlation ID, collection, binding, and instantiation time.

This page owns authored declarations. Runtime documentation owns task-instance status, assignment history, cancellation, and generated IDs.

A Generator can change collection membership indirectly. It does not provide a direct task-instantiation API.

