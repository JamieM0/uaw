---
title: "Requested horizons and resolved-through time"
description: "Reference finite execution prefixes and safe inspection boundaries."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# Requested horizons and resolved-through time

A finite `until` value asks the runtime to resolve the project through time T. It does not require all work to finish by T.

## Finite execution prefix

When a run reaches its requested horizon:

- later work remains `pending`;
- work that crosses the horizon remains `active`;
- a dependency waiting only for future completion remains unresolved future work;
- the runtime does not invent contention for work that it never attempted.

The run reports the request as `requestedHorizon`. It reports the safe inspection boundary as `resolvedThrough`.

## Completion flag

`run.complete` reports whether the evaluator completed its requested execution range without exhausting the work budget.

It does not report whether all tasks finished. A finite, fully resolved prefix can have `complete: true` and active tasks.

## Partial runs

Budget exhaustion stops the current logical step transactionally. The runtime restores state to the last complete step.

It then sets `complete: false`, records the safe boundary in `resolvedThrough`, and reports `runtime.execution.event_limit`.

## Inspection boundary

`snapshotRunAt` throws a range error for a time after `resolvedThrough`. Constraint execution returns `runtime.execution.unresolved_time` instead of calling Constraint checks.

CLI commands can translate the same condition into a structured Problem and a `null` state.

Never treat the requested horizon as resolved evidence without checking `resolvedThrough`.

## Time values

Runtime inspection accepts finite elapsed minutes, `HH:MM`, strict ISO date-time strings, and `{ day, time }` values.

An invalid snapshot time causes `snapshot.time.invalid` in convenience execution paths. Direct `snapshotRunAt` calls throw a type error.

