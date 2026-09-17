---
title: "SVG renderer"
description: "Reference deterministic SVG rendering from WorkSpec snapshots and projects."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# SVG renderer

The package exports two functions for deterministic standalone SVG output.

## Render an existing snapshot

```js
const svg = renderSnapshotToSvg(startingState, snapshot, {
  title: "Line state",
  timeLabel: "09:30"
});
```

`renderSnapshotToSvg` requires a snapshot with an `objects` map. It returns one SVG string and never advances state.

## Resolve and render a project

```js
const result = renderProjectToSvg(startingState, "09:30", {
  changesSource,
  generatorSource,
  seed: 7,
  maxEvents: 20_000
});
```

The result contains:

| Field | Value |
|---|---|
| `svg` | Standalone SVG string |
| `snapshot` | Resolved snapshot at the requested time |
| `run` | Authoritative run used for the snapshot |
| `time` | Parsed elapsed minute |
| `seed` | Applied seed |

## Options

| Option | Type | Default or behavior |
|---|---|---|
| `changesSource` | string | Empty source |
| `generatorSource` | string | Empty source |
| `seed` | number | `1` |
| `maxEvents` | number | Runtime default |
| `title` | string | Project title or `WorkSpec world state` |
| `timeLabel` | string | Requested time for project rendering; absent for snapshot rendering |
| `padding` | number | `28`, minimum `0` |
| `width` | number | Calculated width, minimum `360` |
| `height` | number | Calculated height, minimum `220` |
| `defaultLocationWidth` | number | Layout-derived value, minimum `80` |
| `defaultLocationHeight` | number | Layout-derived value, minimum `60` |
| `locationGap` | number | `24`, minimum `10` |
| `assetResolver` | function | No asset data |

## Output contract

The renderer sorts locations and objects by ID. It escapes text and attribute values. The SVG includes `data-location-id`, `data-object-id`, and applicable `data-asset-id` attributes.

The same document, snapshot, and options produce the same SVG string.

