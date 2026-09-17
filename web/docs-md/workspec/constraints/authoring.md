---
title: "Authoring Constraints"
description: "Register synchronous domain checks in constraints.workspec.js."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/sources/authoring/
---

# Authoring Constraints

Write Constraints in `constraints.workspec.js`. Register checks with `WorkSpec.constraint` or export supported CommonJS shapes.

## Registration form

```js
WorkSpec.constraint("quality.temperature", (context) => {
  return context.get("tank", "temperature") <= 80
    ? null
    : { message: "Tank temperature exceeds 80." };
});
```

The ID must be a non-empty string. The check must be a function.

## CommonJS export forms

The runtime accepts these forms:

- one check function;
- an array of check functions or check objects;
- an object that maps IDs to checks;
- `{ constraints: [...] }`;
- objects with `check` or `run` functions and an optional `id`.

The runtime also unwraps `module.exports.default` before it evaluates these forms.

```js
module.exports = {
  "inventory.non_negative": ({ get }) =>
    get("stock", "quantity") >= 0
      ? null
      : { message: "Inventory cannot be negative." }
};
```

An exported function without an ID uses its declared constraint ID, function name, or a generated `runtime.constraint.N` ID.

## Synchronous checks

Constraint checks must return synchronously. A returned promise causes `constraint.execution.failed`.

A thrown error also causes `constraint.execution.failed`. A source compilation error causes `constraint.compile.failed` and prevents checks from running.

## Checked JavaScript

```js
// @ts-check
/// <reference types="workspec/workspec-constraints" />
```

The package publishes the declaration as `workspec/workspec-constraints.d.ts`. See [executable source files](../sources/authoring.md) for shared trust and authoring rules.
