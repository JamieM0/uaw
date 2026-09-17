---
title: "Custom validation APIs"
description: "Run supported custom validators with subprocess isolation or in the current process."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 110
---

# Custom validation APIs

The custom-validation API loads a JavaScript validator file and returns normalized Problems.

## Options

| Option | Type | Required | Constraint | Aliases |
|---|---|---:|---|---|
| `customValidatorPath` | `string` | Yes | Existing `.js` or `.cjs` file inside the current working directory | `path`, `customPath` |
| `customCatalogPath` | `string` | No | Existing `.json` file inside the current working directory | `catalogPath` |

The API rejects paths that contain traversal segments. Resolved paths must remain inside the current working directory.

## `runCustomValidation(documentValue, options)`

This asynchronous function runs the validator in a subprocess. The worker has a 5-second execution timeout and bounded output.

```js
const { runCustomValidation } = require("workspec");

const problems = await runCustomValidation(startingState, {
  customValidatorPath: "./validators/project.js"
});
```

The Promise resolves to `WorkSpecProblem[]`. Setup, worker, timeout, and invalid-output failures reject the Promise.

## `runCustomValidationInProcess(documentValue, options)`

This asynchronous function runs the same validation contract in the caller's process. Await its `WorkSpecProblem[]` result.

> **Note:** Package `1.2.4` declares a direct array return for this function. The implementation returns a Promise.

> **Warning:** Run only trusted validator source with `runCustomValidationInProcess()`. A non-returning callback can block the host process.

Use the subprocess API when the caller needs the package's custom-validation isolation boundary.

See [Problems and diagnostics](/docs/workspec/problems/) for normalized result fields.
