---
title: "Requested time was not resolved"
description: "Diagnose requested horizons that exceed the run's safe resolved-through boundary."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
related:
  - /docs/workspec/runtime/horizons/
  - /docs/workspec/runtime/work-budget/
---

# Requested time was not resolved

This symptom means the requested inspection time is later than the run's safe resolved-through boundary.

## Identify the boundary

Read these run fields:

| Field | Diagnostic use |
|---|---|
| `requestedHorizon` | Time that execution attempted to cover |
| `resolvedThrough` | Latest time safe for inspection |
| `complete` | Whether the requested range completed within the work budget |
| `processedWorkUnits` | Work consumed before completion or stop |
| `maxEvents` | Applied work-unit budget |

Do not use `requestedHorizon` as proof that state exists at that time.

## Symptom: a snapshot returns no state

The CLI returns `state: null` when execution did not reach the requested snapshot time. It also returns a structured unresolved-time Problem.

Choose a time at or before `resolvedThrough`, or correct the cause that stopped execution.

## Symptom: Constraints do not execute

Constraint checks do not run against unresolved time. This protects them from treating partial state as final evidence.

Resolve through a safe later boundary before you run the checks. Do not change the Constraint to ignore the missing evidence.

## Cause: the work budget was exhausted

Look for `runtime.execution.event_limit`. The runtime stops the current logical step transactionally and retains the last complete boundary.

Inspect whether the project creates excessive same-time work, minute updates, dynamic instances, reservations, or Changes interactions.

Increase `maxEvents` only after you understand the workload. The limit defaults to `10000` and accepts at most `1000000`.

## Cause: the request used the wrong time form

Check the parsed time in the command result. WorkSpec accepts finite elapsed minutes, `HH:MM`, strict ISO date-time with an offset, or a day/time object where supported.

An invalid time is a different error from unresolved time. See [time, dates, durations, and offsets](/docs/workspec/language/time-durations/).

## Corrective action

Use [requested horizons and resolved-through time](/docs/workspec/runtime/horizons/) for the normative boundary. Use [work-unit budget](/docs/workspec/runtime/work-budget/) for counted work and limit behavior.
