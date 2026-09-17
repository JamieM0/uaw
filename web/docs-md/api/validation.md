---
title: "Validation APIs"
description: "Validate a WorkSpec Starting State document or a project with executable sources."
section: "api"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Validation APIs

The stable validation API separates document validation from project validation.

## `validate(documentValue)`

`validate()` checks facts that the Starting State document makes decidable.

| Parameter | Type | Required | Constraint | Example |
|---|---|---:|---|---|
| `documentValue` | `unknown` | Yes | Must contain a canonical `simulation` root for WorkSpec 2 | `startingState` |

The function returns `WorkSpecValidationResult` with `ok` and `problems`.

```js
const { validate } = require("workspec");
const result = validate(startingState);

console.log(result.ok);       // true when no error Problem exists
console.log(result.problems); // [] for a valid minimal document
```

## `validateProject(documentValue, options)`

`validateProject()` composes document, source, runtime, and optional Constraint validation.

| Option | Type | Required | Default | Purpose |
|---|---|---:|---|---|
| `changesSource` | `string` | No | `""` | Changes JavaScript source |
| `generatorSource` | `string` | No | `""` | Generator JavaScript source |
| `constraintsSource` | `string` | No | `""` | Constraint JavaScript source |
| `seed` | `number` | No | `1` | Deterministic Generator seed |
| `until` | `number` | No | Natural end | Finite requested horizon in minutes |
| `maxEvents` | `number` | No | `10000` | Runtime work-unit budget |

The result includes `ok`, `problems`, `document`, `changesAnalysis`, `run`, `state`, `history`, `usage`, `violations`, `time`, `horizon`, and `seed`.

Use [`runtime.runProject()`](/docs/api/runtime/) when validation orchestration is not the desired operation.

