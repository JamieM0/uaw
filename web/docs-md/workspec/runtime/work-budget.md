---
title: "Work-unit budget and bounded execution"
description: "Reference maxEvents, work accounting, and execution limits."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# Work-unit budget and bounded execution

The runtime limits execution with a work-unit budget named `maxEvents`. The API retains this name even though the counter covers more than events.

## Limits

| Configuration | Applied behavior |
|---|---|
| Omitted | Uses `10,000` work units |
| Positive integer up to `1,000,000` | Uses the supplied value |
| Non-positive or non-integer | Uses `10,000` and reports an error |
| Greater than `1,000,000` | Uses `1,000,000` and reports a warning |

Invalid values report `runtime.configuration.max_events_invalid`. Clamped values report `runtime.configuration.max_events_clamped`.

## Counted work

Work units include:

- task starts and completions;
- Generator callbacks and writes;
- Changes interactions;
- reservation evaluation;
- active-task guards;
- dynamic collection work.

The counter prevents large same-time workloads and long minute-driven runs from bypassing the limit.

## Exhaustion behavior

The runtime stops before a step would exceed the budget. It restores the state from before that step.

The run then reports:

- `runtime.execution.event_limit`;
- `complete: false`;
- the applied `maxEvents`;
- `processedWorkUnits`;
- the safe `resolvedThrough` boundary.

Snapshots and Constraints reject later times.

## Non-returning callbacks

The work budget counts callbacks that return. It cannot pre-empt synchronous JavaScript that never returns.

Hosts that execute untrusted source need worker or process isolation with a wall-clock timeout. See [trusted code and execution security](../sources/security.md).
