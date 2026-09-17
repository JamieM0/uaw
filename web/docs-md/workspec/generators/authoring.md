---
title: "Authoring Generators"
description: "Register synchronous Generator lifecycle callbacks in WorkSpec 2.2."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/sources/authoring/
---

# Authoring Generators

Write optional causal logic in `generator.workspec.js`. Register one or more synchronous lifecycle callbacks.

## Direct registration

```js
WorkSpec.onStart((context) => {
  context.set("queue", "arrivals", 0);
});

WorkSpec.onUpdate((context) => {
  if (context.random() < 0.1) {
    context.change("queue", "arrivals", 1);
  }
});
```

`WorkSpec.onStart` and `WorkSpec.onUpdate` require functions. You can register multiple callbacks for each lifecycle stage.

## Object registration

```js
WorkSpec.generator({
  onStart: ({ set }) => set("room", "temperature", 20),
  onUpdate: ({ get, set }) => {
    set("room", "temperature", get("room", "temperature") + 0.1);
  }
});
```

`WorkSpec.generator` accepts an object with optional `onStart` and `onUpdate` functions.

## Callback contract

Callbacks must return synchronously. Generator compilation uses ordinary JavaScript source evaluation.

The runtime catches thrown callback errors and reports `generator.execution.failed`. A source evaluation failure reports `generator.compile.failed`.

The shared in-process runtime cannot stop a callback that never returns. Read the [trusted-code contract](../sources/security.md) before executing third-party source.

## Checked JavaScript

```js
// @ts-check
/// <reference types="workspec/workspec-generator" />
```

The package publishes the declaration as `workspec/workspec-generator.d.ts`. Shared conventions live in [executable source files](../sources/authoring.md).

