---
title: "Snapshots and resolved state"
description: "Reference observations of resolved state from an authoritative WorkSpec run."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Snapshots and resolved state

A snapshot is the observable state at one time in an authoritative run. It selects the last history point at or before that time.

## Inspect an existing run

```js
const run = runtime.runProject(start, changes, generator, {
  seed: 4,
  until: 600
});

const snapshot = runtime.snapshotRunAt(run, 570);
```

`snapshotRunAt` requires an authoritative run. It never reruns Changes or Generator source.

## Snapshot fields

| Field | Contents |
|---|---|
| `objects` | Live world objects by ID |
| `locations` | Locations by ID |
| `task_statuses` | Task status by ID |
| `task_runtime` | Runtime task records by ID |
| `active_tasks` | Active task timing records by ID |
| `reservations` | Current resolved reservation claims |
| `collections` | Current member IDs by collection ID |
| `collection_boundaries` | Open state and close time by collection ID |
| `work_definitions` | Authored work-definition values |
| `task_instances` | Runtime-created task-instance records |
| `usage` | Sorted IDs used through the snapshot time |
| `problems` | Problems attached to the run |

The snapshot contains cloned JSON-compatible values. Mutating it does not mutate the run.

## Convenience execution

`snapshotProjectAt(start, changes, generator, time, options)` runs the project through the requested time and returns a snapshot.

Use this convenience function for one independent inspection. Use `runProject` plus `snapshotRunAt` when Constraints, rendering, or multiple snapshots must share one execution.

## Latest state

`serialiseState(run)` serializes the run's current state. It uses the last history time for collection evaluation.

## Errors

The requested time must not exceed `run.resolvedThrough`. The run must also contain a history state at that time.
