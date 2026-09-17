---
title: "Constraint execution APIs"
description: "Run Constraint source against an existing authoritative WorkSpec run."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# Constraint execution APIs

`runtime.runConstraintsOnResult()` evaluates Constraint source without rerunning Changes or a Generator.

## Signature

```ts
runtime.runConstraintsOnResult(run, constraintsSource, options?): ConstraintResult
```

| Parameter | Type | Required | Default | Constraint |
|---|---|---:|---|---|
| `run` | `WorkSpecRun` | Yes | None | Must be an authoritative run |
| `constraintsSource` | `string` | Yes | None | Constraint JavaScript source |
| `options.time` | `WorkSpecTime` | No | Last resolved time | Must not exceed `run.resolvedThrough` |

The result contains `time`, `violations`, and `problems`.

```js
const run = runtime.runProject(startingState, changesSource, generatorSource, {
  until: 600
});
const result = runtime.runConstraintsOnResult(run, constraintsSource, {
  time: 600
});
```

An unresolved requested time produces `runtime.execution.unresolved_time`. Constraint callbacks do not run for that request.

Constraint JavaScript executes in-process and must be synchronous. Read the [security contract](/docs/workspec/sources/security/) before accepting external source.

See [Constraint violations](/docs/workspec/constraints/violations/) for violation fields and [Problems](/docs/workspec/problems/) for diagnostics.

