---
title: "Constraint context and history queries"
description: "Reference read-only state and history access for WorkSpec Constraints."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Constraint context and history queries

Each Constraint receives an immutable query context over one authoritative run.

## Context members

| Member | Return value |
|---|---|
| `time` | Selected query time in elapsed minutes |
| `state()` | Snapshot at `time` |
| `stateAt(time)` | Snapshot at another resolved time |
| `get(targetId, property)` | Property value at `time` |
| `getAt(time, targetId, property)` | Property value at another resolved time |
| `times()` | Sorted resolved history times plus the selected time |

Time arguments accept finite elapsed minutes, `HH:MM`, strict ISO date-time strings, or `{ day, time }` values.

## Snapshot shape

`state()` and `stateAt()` return a frozen observable snapshot. It contains objects, locations, task status, runtime task data, reservations, collections, task instances, usage, and related resolved fields.

The query layer removes the snapshot's `problems` field from Constraint-visible state. Use the run result to inspect Problems.

## Property lookup

`get` and `getAt` search objects and locations. They first read a top-level field. If no top-level field exists, they read from `properties`.

An unknown target or property returns `undefined`.

## Historical queries

Historical queries select the last history point at or before the requested time. They do not execute the project again.

```js
WorkSpec.constraint("pressure.never_high", (context) => {
  for (const time of context.times()) {
    const pressure = context.getAt(time, "vessel", "pressure");
    if (pressure > 2.5) {
      return { time, observed: pressure, expected: { max: 2.5 } };
    }
  }
  return null;
});
```

Queries after `run.resolvedThrough` fail. Resolve the run through a later horizon before checking later evidence.

