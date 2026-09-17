---
title: "Project execution"
description: "Create one authoritative WorkSpec run with the supported runtime API."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Project execution

`runtime.runProject()` creates the authoritative run consumed by snapshots, Constraints, and rendering.

## Signature

```ts
runtime.runProject(
  documentValue,
  changesSource?,
  generatorSource?,
  options?
): WorkSpecRun
```

## Parameters

| Parameter | Type | Required | Default | Purpose |
|---|---|---:|---|---|
| `documentValue` | `unknown` | Yes | None | Starting State document |
| `changesSource` | `string` | No | `""` | Changes source text |
| `generatorSource` | `string` | No | `""` | Generator source text |
| `options.seed` | `number` | No | `1` | Generator seed |
| `options.until` | `number` | No | Natural end | Requested horizon in minutes |
| `options.maxEvents` | `number` | No | `10000` | Work-unit budget |

```js
const { runtime } = require("workspec");

const run = runtime.runProject(startingState, changesSource, generatorSource, {
  seed: 17,
  until: 600,
  maxEvents: 20000
});

console.log(run.resolvedThrough);
```

The return value contains Problems, history, resolved boundaries, seed, budget accounting, and runtime state.

The call executes trusted source in-process. See [trusted code and execution security](/docs/workspec/sources/security/).

The [execution model](/docs/workspec/runtime/execution-model/) owns event ordering and language behavior. This page owns only the embedding contract.

