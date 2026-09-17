---
title: "Make runs reproducible"
description: "Capture versions, source, seed, horizon, budget, and evidence for repeatable WorkSpec runs."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
related:
  - /docs/workspec/runtime/execution-model/
  - /docs/workspec/generators/determinism/
---

# Make runs reproducible

A reproducible run identifies both the authored project and the runtime controls that resolved it.

## Pin independent versions

Record the npm package version and the WorkSpec language version separately. The package version selects an implementation release. The language version selects the document contract.

Pin the package version in the application's lockfile. Keep the canonical `simulation.schema_version` and `$schema` declaration in each complete Starting State document.

See [versions and compatibility](/docs/workspec/versioning-compatibility/) for the distinction.

## Capture every source

Retain the exact Starting State, Changes, Generator, and Constraint source. A file hash or source-control revision provides a compact identity for the source set.

Asset bytes do not affect runtime state, but they affect rendered output. Capture the asset set when visual reproducibility matters.

## Fix run controls

Record these values:

| Control | Why it matters |
|---|---|
| `seed` | Repeats Generator `random()` results. |
| requested horizon | Defines the requested execution prefix. |
| `maxEvents` | Defines the available work-unit budget. |
| inspection time | Identifies the snapshot or Constraint query. |

Use the Generator `random()` helper. `Math.random()` is not part of deterministic Generator execution.

## Preserve resolved evidence

Store the run metadata with the result:

- `seed`;
- `requestedHorizon`;
- `resolvedThrough`;
- `complete`;
- `maxEvents`;
- `processedWorkUnits`;
- Problems and Constraint violations.

Do not record only the requested horizon. A budget-limited run can resolve less time than requested.

## Reuse one run

For an embedded application, create one authoritative run. Derive snapshots, Constraint results, and renders from that object.

Re-running the project for each consumer creates separate executions. It also weakens the claim that every result describes the same history.

The [authoritative execution reference](/docs/workspec/runtime/execution-model/) defines the supported reuse pattern.

## Verify a replay

Repeat the run with the captured source and controls. Compare resolved metadata, Problems, snapshots at selected times, and Constraint results.

A matching final object count is not sufficient evidence. Intermediate history, task assignments, and violations can differ while final totals match.
