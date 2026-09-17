---
title: "JavaScript API overview"
description: "Embed WorkSpec validation, execution, snapshots, Constraints, rendering, and migration in Node.js applications."
section: "api"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# JavaScript API overview

The `workspec` package provides a CommonJS API for applications that need direct access to WorkSpec results.

## Choose the API or CLI

Use the JavaScript API when your application must retain a run, inspect several snapshots, or pass results directly to another component.

Use the CLI when you need a process boundary, shell workflow, or command exit code.

```js
const workspec = require("workspec");

const validation = workspec.validate(startingState);
if (!validation.ok) {
  console.error(validation.problems);
}
```

## Supported API groups

| Goal | API |
|---|---|
| Validate a document or project | `validate()`, `validateProject()` |
| Execute a project | `runtime.runProject()` |
| Inspect resolved state | `runtime.snapshotRunAt()`, `runtime.snapshotProjectAt()` |
| Evaluate Constraints | `runtime.runConstraintsOnResult()` |
| Render SVG | `renderSnapshotToSvg()`, `renderProjectToSvg()` |
| Migrate historical input | `migrate()` |
| Run custom validation | `runCustomValidation()`, `runCustomValidationInProcess()` |

The package also exposes state-visual and playback helpers. Read the [API stability policy](/docs/api/stability/) before using a reachable symbol.

## Execution boundary

API calls can execute project JavaScript in the caller's process. Read the [trusted code and execution security contract](/docs/workspec/sources/security/) before accepting external source.
