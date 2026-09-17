---
title: "Tasks do not start or finish as expected"
description: "Diagnose pending, blocked, skipped, failed, interrupted, and unexpectedly active tasks."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/runtime/task-status/
  - /docs/workspec/starting-state/scheduling/
---

# Tasks do not start or finish as expected

Inspect the task status, runtime record, and Problems at the requested time before you change its schedule.

## Symptom: a task remains pending

First compare the requested time with `run.resolvedThrough`. A finite horizon can leave later tasks pending without an error.

If the run covers the expected start, check the task's resolved timing and dependency completion. A task that belongs to dynamic work might not exist until its collection member appears.

See [scheduling and dependencies](/docs/workspec/starting-state/scheduling/) and [runtime task instances](/docs/workspec/runtime/task-instances/).

## Symptom: a task is blocked

A blocked task did not satisfy a start requirement. Inspect runtime Problems and these inputs:

- predecessor status;
- `when` and `requires` conditions;
- performer candidates;
- reservation availability;
- timing rules;
- referenced values.

Do not infer the cause from `blocked` alone. Use the Problem's `metric_id` and context.

## Symptom: a task is skipped

The `when` condition evaluated to false at the scheduled start. Inspect the referenced state at that time.

Boolean expressions can short-circuit. A branch that does not execute cannot supply usage evidence.

See [conditions and boolean logic](/docs/workspec/language/conditions/) for evaluation rules.

## Symptom: a task starts with the wrong performer

Inspect `selected_actor_id`, `assignment_history`, and resolved reservations. Then check the performer expression and candidate state at the start time.

Performer selection occurs after dependencies and guards pass. See [actors and performers](/docs/workspec/starting-state/actors-performers/).

## Symptom: a task fails at start or completion

A Change operation can fail transactionally. A failed start Change prevents activation. A failed completion Change produces `failed`, not `completed`.

Inspect same-time writes, target existence, numeric operations, and create/remove conflicts. See [same-time writes and transactions](/docs/workspec/changes/conflicts-transactions/).

## Symptom: an active task never completes

Check whether the requested horizon falls before its end. If the run resolved beyond the end, inspect active `while` conditions and runtime Problems.

A failed active invariant produces `interrupted`. The [task status reference](/docs/workspec/runtime/task-status/) defines every terminal state and dependency consequence.
