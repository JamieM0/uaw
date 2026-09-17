---
title: "Scheduling and dependencies"
description: "Reference task starts, dependencies, relative timing, and scheduling inputs."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 390
---

# Scheduling and dependencies

Scheduling combines explicit starts, planned durations, dependencies, guards, and timing constraints.

## Explicit and derived starts

A task can declare `start` with a clock, date-time, or day/time value. A task with dependencies can omit `start`.

The runtime derives an omitted start from predecessor timing. An explicit start cannot contradict its dependency timing bound.

## Dependencies

An array requires all listed predecessors.

```json
{ "depends_on": ["wash", "inspect"] }
```

Use explicit `all` and `any` groups for combined dependency logic.

```json
{
  "depends_on": {
    "all": ["prepare"],
    "any": ["manual_release", "automatic_release"]
  }
}
```

Dependencies must reference declared authored tasks. A task cannot depend on itself, and the dependency graph cannot contain a cycle.

## Relative timing

The `timing` array accepts `offset` and `not_overlap` constraints.

An offset constraint anchors `start` or `completion` to `@task.start`, `@task.end`, or canonical `@task.actual_end`.

```json
{
  "relation": "offset",
  "event": "start",
  "relative_to": "@inspect.actual_end",
  "min_offset": "5m"
}
```

A `not_overlap` constraint names another authored task under `with.task`.

## Runtime resolution

Guards, selected performers, reservations, interruptions, and actual completion can change runtime outcomes. Planned timing alone does not prove executed overlap.
