---
title: "Snapshot APIs"
description: "Inspect an existing authoritative run or create a one-call project snapshot."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# Snapshot APIs

The snapshot APIs return observable state at a time covered by an authoritative run.

## `runtime.snapshotRunAt(run, time)`

Use `snapshotRunAt()` to inspect an existing run without another project execution.

| Parameter | Type | Required | Constraint | Example |
|---|---|---:|---|---|
| `run` | `WorkSpecRun` | Yes | Must be an authoritative run | `run` |
| `time` | `WorkSpecTime` | Yes | Must not exceed `run.resolvedThrough` | `"09:42"` |

The function returns `WorkSpecSnapshot`. It throws `TypeError` for an invalid run or time.

It throws `RangeError` when the requested time exceeds the resolved boundary or has no state.

```js
const run = runtime.runProject(startingState, changesSource, "", { until: 600 });
const snapshot = runtime.snapshotRunAt(run, "09:42");
```

## `runtime.snapshotProjectAt(documentValue, changesSource, generatorSource, time, options)`

Use `snapshotProjectAt()` as a convenience call when you do not need to retain the run.

The current declaration requires the first four parameters. Pass empty strings for omitted executable sources.

`options` accepts runtime options such as `seed` and `maxEvents`. The function runs the project through `time` and returns a snapshot.

For several snapshots, call `runProject()` once and reuse `snapshotRunAt()`.

See [snapshots and resolved state](/docs/workspec/runtime/snapshots/) for snapshot semantics.
