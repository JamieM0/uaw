---
title: "Task status and failure propagation"
description: "Reference runtime task states and their transition causes."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# Task status and failure propagation

Every static task and runtime task instance begins as `pending`. Runtime events move tasks through a constrained lifecycle.

## Status meanings

| Status | Meaning |
|---|---|
| `pending` | The runtime has not accepted the task start |
| `active` | The task started and has not terminated |
| `completed` | The task reached its end and completion effects succeeded |
| `failed` | A start or completion operation failed |
| `skipped` | The `when` condition was false at the scheduled start |
| `blocked` | A dependency, requirement, invariant, timing rule, performer, or reservation prevented the start |
| `interrupted` | An active task's `while` condition failed |
| `cancelled` | A declared runtime cancellation rule cancelled pending work |

`completed`, `failed`, `skipped`, `blocked`, `interrupted`, and `cancelled` are terminal states.

## Allowed transitions

The runtime permits these transitions:

- `pending` to `active`, `failed`, `skipped`, `blocked`, or `cancelled`;
- `active` to `completed`, `failed`, or `interrupted`.

An invalid transition reports `task.lifecycle.transition.invalid`.

## Failure propagation

A failed start Change prevents activation. A failed completion Change produces `failed`, not `completed`.

Dependencies require completed predecessor work. If a dependency cannot satisfy the scheduled start, the dependent task becomes `blocked`.

An active task interruption releases its reservations and restores its temporary effects. Tasks can use authored continuation relationships after interruption.

## Finite horizons

A horizon can leave future tasks `pending` and crossing tasks `active`. Those statuses do not indicate a runtime failure.

See [requested horizons](horizons.md) before interpreting status in a partial run.

