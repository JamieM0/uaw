---
title: "Playback model APIs"
description: "Resolve pure playback state from authored WorkSpec tasks and interactions."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 100
---

# Playback model APIs

The playback helpers resolve authored tasks and interactions without a renderer.

## Create a reusable model

`createPlaybackModel(documentValue)` normalizes the input for repeated playback queries.

```js
const {
  createPlaybackModel,
  getObjectStateAtTime
} = require("workspec");

const model = createPlaybackModel(startingState);
const state = getObjectStateAtTime(model, "worker_1", 550);
```

## Query helpers

| Function | Return value |
|---|---|
| `resolveWorldStateAtTime(documentOrModel, time)` | Resolved objects grouped by ID and type |
| `getObjectAtTime(documentOrModel, objectId, time)` | Resolved object or `null` |
| `getObjectStateAtTime(documentOrModel, objectId, time)` | `properties.state` or `undefined` |
| `getObjectLocationAtTime(documentOrModel, objectId, time)` | Location ID or `null` |

The helper converts `time` with `Number(time)`. Pass a numeric minute value for predictable playback queries.

## Playback boundary

These pure helpers resolve authored playback data. They do not accept an authoritative `WorkSpecRun`.

Use [`runtime.snapshotRunAt()`](/docs/api/snapshots/) when Changes or Generator execution produced the state.

`resolveObjectStateAtTime()` is a compatibility helper. Do not use it in new integrations.
