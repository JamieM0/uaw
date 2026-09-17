---
title: "Task start and completion Changes"
description: "Reference the timing and lifetime of Changes effects."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Task start and completion Changes

Changes attach predetermined effects to task activation or successful completion.

## Start Changes

`onStart` effects run only after the task passes its start checks. Those checks include dependencies, guards, performer selection, and reservations.

```js
WorkSpec.task("wash_vessel").onStart(() => {
  set("vessel", "state", "washing", { temporary: true });
});
```

If a start Change fails, the task becomes `failed`. The task does not become active.

## Completion Changes

`onComplete` effects run at the task's resolved end. The runtime restores temporary values before it applies completion effects.

```js
WorkSpec.task("wash_vessel").onComplete(() => {
  set("vessel", "state", "clean");
});
```

If a completion Change fails, the task becomes `failed`. The runtime does not report an unqualified successful completion.

## Temporary effects

Pass `{ temporary: true }` to `set`, `change`, or `move` in a start handler. The runtime captures the previous value and restores it when the task ends or becomes interrupted.

Temporary `create` and `remove` operations are not supported. Temporary completion operations are also invalid.

Overlapping temporary writes to the same property fail with `interaction.temporary.overlap`.

## Same-time order

At one logical time, the runtime follows this relevant order:

1. Restore temporary values for finishing tasks.
2. Apply completion Changes.
3. Run Generator callbacks.
4. Evaluate task-start conditions.
5. Apply accepted start Changes.

Generator writes win same-target conflicts at that time. The runtime emits `generator.changes.conflict` as a warning.

For the full order, see the [runtime execution model](../runtime/execution-model.md).

