---
title: "State visual helpers"
description: "Create asset IDs and resolve State Library visuals with supported JavaScript helpers."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 90
---

# State visual helpers

Two stable helpers connect project asset filenames to State Library appearance mappings.

## `assetIdFromFilename(filename)`

The function removes the last extension, converts text to lowercase, and replaces non-alphanumeric groups with underscores.

The function removes leading and trailing underscores. It limits the result to 250 characters.

```js
const { assetIdFromFilename } = require("workspec");

console.log(assetIdFromFilename("Worker Idle.PNG"));
// worker_idle
```

Non-string input returns an empty string.

## `resolveStateVisualAssetId(documentValue, object, state)`

The function returns the asset ID for an object's State Library, appearance, and semantic state.

| Parameter | Type | Required | Default |
|---|---|---:|---|
| `documentValue` | `unknown` | Yes | None |
| `object` | object | Yes | None |
| `state` | `unknown` | No | `object.properties.state` |

The function returns `null` when the library, appearance, state, or mapping does not exist.

See [state visuals and assets](/docs/workspec/rendering/state-visuals/) for the language-level mapping contract.
