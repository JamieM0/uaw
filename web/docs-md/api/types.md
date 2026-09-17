---
title: "Types and data structures"
description: "Reference for the public TypeScript declarations returned by the WorkSpec JavaScript API."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 120
---

# Types and data structures

The package publishes TypeScript declarations from `index.d.ts`.

## `WorkSpecTime`

`WorkSpecTime` accepts numeric minutes, a time string, or a day/time object.

```ts
type WorkSpecTime =
  | number
  | string
  | Readonly<{ day: number; time: string }>;
```

## `WorkSpecProblem`

| Field | Type | Required |
|---|---|---:|
| `severity` | `"error" \| "warning" \| "info"` | Yes |
| `detail` | `string` | Yes |
| `metric_id` | `string` | Yes |
| `type`, `title`, `instance` | `string` | No |
| `scope` | known scope or `string` | No |
| `provenance`, `context` | read-only record | No |
| `suggestions` | read-only string array | No |

The [Problems reference](/docs/workspec/problems/) owns the semantic contract for these fields.

## `WorkSpecRun`

| Field | Type | Meaning |
|---|---|---|
| `problems` | `WorkSpecProblem[]` | Execution diagnostics |
| `history` | read-only record array | Resolved history entries |
| `resolvedThrough` | `number` | Last safe inspection time |
| `requestedHorizon` | `number \| null` | Requested finite horizon |
| `complete` | `boolean` | Completion state |
| `seed` | `number` | Effective Generator seed |
| `maxEvents` | `number` | Effective work-unit budget |
| `processedWorkUnits` | `number` | Consumed work units |

The interface permits additional runtime fields. Those fields are not stable unless another reference section documents them.

## `WorkSpecSnapshot`

The snapshot contains `objects`, `locations`, task status and runtime maps, active tasks, reservations, collections, work definitions, task instances, usage, and Problems.

Snapshot collections use read-only declaration types. Do not depend on object identity across calls.

## `runtime.serialiseState(run)`

`serialiseState()` converts the current runtime state into the public `WorkSpecSnapshot` shape.

| Parameter | Type | Required | Example |
|---|---|---:|---|
| `run` | `WorkSpecRun` | Yes | `run` |

Use [`runtime.snapshotRunAt()`](/docs/api/snapshots/) when you need state at a specified historical time.

## Other public interfaces

| Interface | Used by |
|---|---|
| `WorkSpecValidationResult` | `validate()` and validation orchestration |
| `WorkSpecProjectValidationOptions` | `validateProject()` |
| `WorkSpecRenderOptions` | Both rendering functions |
| `WorkSpecRenderResult` | `renderProjectToSvg()` |
| `WorkSpecRuntime` | The `runtime` namespace |
