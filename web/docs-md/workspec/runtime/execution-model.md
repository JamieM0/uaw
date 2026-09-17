---
title: "Execution model and authoritative run"
description: "Reference WorkSpec 2.2 event ordering and the authoritative run contract."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# Execution model and authoritative run

`runtime.runProject` produces the authoritative resolved run for one project execution. Snapshots, Constraints, and rendering must inspect that run.

## Run inputs

```js
const run = runtime.runProject(
  startingState,
  changesSource,
  generatorSource,
  { seed: 17, until: 600, maxEvents: 20_000 }
);
```

| Input | Contract |
|---|---|
| `startingState` | WorkSpec document value |
| `changesSource` | Changes source string or empty string |
| `generatorSource` | Generator source string or empty string |
| `seed` | Generator seed; default is `1` |
| `until` | Optional finite elapsed-minute horizon |
| `maxEvents` | Optional work-unit budget |

## Event order

At each logical time, the runtime follows this order:

1. Finish active tasks and apply completion Changes.
2. Apply Generator writes for that time.
3. Evaluate active-task invariants.
4. Create instances from declared work definitions.
5. Evaluate dependencies and start guards.
6. Select performers and evaluate reservations.
7. Apply accepted start Changes and activate tasks.
8. Record one post-event history point.

Completion Changes therefore precede Generator logic. Start Changes follow Generator logic and all start checks.

## Run result

The run contains internal execution state and these observable fields:

| Field | Meaning |
|---|---|
| `problems` | Source and runtime Problems |
| `history` | Ordered authoritative state points |
| `seed` | Applied deterministic seed |
| `requestedHorizon` | Finite requested horizon or `null` |
| `resolvedThrough` | Latest safe inspection time |
| `complete` | `false` only when the work budget stopped execution |
| `maxEvents` | Applied work-unit limit |
| `processedWorkUnits` | Consumed work units |

`complete` does not mean that every task reached a terminal status. A finite horizon can leave tasks pending or active in a complete execution prefix.

## Consumers

Use `snapshotRunAt(run, time)` to inspect resolved state. Use `runConstraintsOnResult(run, source, options)` to check domain rules against the same evidence.

Do not call a convenience function again when several consumers must agree on one execution. See [why one authoritative run matters](/docs/concepts/authoritative-run/) for the rationale.
