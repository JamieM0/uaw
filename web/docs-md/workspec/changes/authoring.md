---
title: "Authoring Changes"
description: "Register WorkSpec 2.2 task handlers and use the Changes source contract."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/sources/authoring/
  - /docs/workspec/changes/lifecycle/
---

# Authoring Changes

Use `WorkSpec.task(taskId)` to get a reusable handle for one Starting State task. Register start and completion handlers on that handle.

## Canonical forms

```js
WorkSpec.task("heat_tank").onStart(() => {
  set("tank", "state", "heating", { temporary: true });
});
```

```js
const heatTank = WorkSpec.task("heat_tank");

heatTank.onComplete(() => {
  set("tank", "temperature", 80);
});
```

```js
WorkSpec.task("heat_tank", (task) => {
  task.onStart(() => set("tank", "state", "heating", { temporary: true }));
  task.onComplete(() => set("tank", "state", "ready"));
});
```

Repeated calls with the same task ID return the same handle. Each handle keeps all registered handlers in source order.

## `WorkSpec.task` contract

| Input | Requirement |
|---|---|
| `taskId` | Non-empty string that names a declared task |
| `configure` | Optional synchronous function that receives the task handle |
| Return value | Frozen task handle with `onStart` and `onComplete` |

The runtime reports `changes.task.unknown` when a handler names no declared Starting State task.

## Handler context

Each handler receives a frozen context with these members:

| Member | Value |
|---|---|
| `taskId` | Registered task ID |
| `phase` | `start` or `completion` |
| `set`, `change`, `move`, `create`, `remove` | Effect operations |

The same operations are ambient inside the active handler. An ambient operation throws if code calls it outside a handler.

Handlers can also use the context operations directly. Destructured context operations remain supported for existing source.

```js
WorkSpec.task("heat_tank").onComplete(({ set }) => {
  set("tank", "state", "ready");
});
```

Ambient operations are the canonical WorkSpec 2.2 authoring style.

The context has no time or world-state reader. This restriction keeps Changes predetermined.

## Checked JavaScript

```js
// @ts-check
/// <reference types="workspec/workspec-changes" />
```

The package publishes the declaration as `workspec/workspec-changes.d.ts`. Shared source conventions live in [executable source files](../sources/authoring.md).

## Synchronous execution

Use synchronous handlers. Changes compilation invokes each handler to capture operations. It does not await returned promises.
