---
title: "JavaScript API index"
description: "Generated support classification for every export reachable from the WorkSpec package entrypoint."
section: "api"
type: "reference"
level: "all"
workspec_version: "2.2"
status: "canonical"
order: 140
generated_sections:
  - top_level_exports
  - runtime_exports
---

# JavaScript API index

The documentation build generates this page from `_data/api-surface.json`. Reachability does not imply public support.

## Stable top-level exports

| Export | Owner |
|---|---|
| `validate`, `validateProject` | [Validation APIs](/docs/api/validation/) |
| `migrate` | [Migration API](/docs/api/migration/) |
| `renderSnapshotToSvg`, `renderProjectToSvg` | [Rendering APIs](/docs/api/rendering/) |
| `assetIdFromFilename`, `resolveStateVisualAssetId` | [State visual helpers](/docs/api/state-visuals/) |
| `runCustomValidation`, `runCustomValidationInProcess` | [Custom validation APIs](/docs/api/custom-validation/) |
| `createPlaybackModel`, `resolveWorldStateAtTime` | [Playback model APIs](/docs/api/playback/) |
| `getObjectAtTime`, `getObjectStateAtTime`, `getObjectLocationAtTime` | [Playback model APIs](/docs/api/playback/) |
| `runtime` | [Project execution](/docs/api/runtime/) |

## Compatibility top-level exports

| Export | Guidance |
|---|---|
| `resolveObjectStateAtTime` | Use the playback model helpers for new integrations. |

## Internal top-level exports

The following reachable symbols have no public stability promise:

- `getStateLibrary`
- `calculateLocationObjectSlots`
- `parseDurationToMinutes`
- `parseTaskStart`
- `parseStrictTimeStringToMinutes`
- `SUPPORTED_SCHEMA_VERSIONS`
- `WORKSPEC_NAMESPACE`
- `WORKSPEC_V2_SCHEMA_URL`

## Stable runtime exports

| Export | Owner |
|---|---|
| `runtime.runProject` | [Project execution](/docs/api/runtime/) |
| `runtime.snapshotRunAt`, `runtime.snapshotProjectAt` | [Snapshot APIs](/docs/api/snapshots/) |
| `runtime.runConstraintsOnResult` | [Constraint execution APIs](/docs/api/constraints/) |
| `runtime.serialiseState` | [Types and data structures](/docs/api/types/) |

## Experimental runtime exports

| Export | Owner |
|---|---|
| `runtime.analyzeChanges` | [Tooling and analysis APIs](/docs/api/tooling/) |

## Internal runtime exports

The runtime namespace also exposes implementation helpers. They have no public stability promise.

- `runConstraints`
- `parseDurationToMinutes`, `parseTaskStart`, `parseOffset`
- `formatCompactReference`, `normalizeValueExpression`, `isValueReference`
- `evaluateValue`, `evaluateCondition`
- `buildIndex`, `resolveTimings`, `replay`, `snapshotAt`
- `validate`, `validateSource`
- `compileChanges`, `compileGenerator`, `applyChanges`
- `seededRandom`
- `OBJECT_FIELDS`, `TASK_FIELDS`, `LOCATION_FIELDS`

See [API stability and support policy](/docs/api/stability/) before selecting an integration point.
