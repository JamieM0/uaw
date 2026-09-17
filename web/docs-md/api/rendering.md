---
title: "Rendering APIs"
description: "Render a resolved WorkSpec snapshot or project as deterministic standalone SVG."
section: "api"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 70
---

# Rendering APIs

The rendering API creates presentation-only SVG from resolved WorkSpec state.

## `renderSnapshotToSvg(documentValue, snapshot, options)`

This function renders an existing `WorkSpecSnapshot` and returns an SVG string.

| Parameter | Type | Required | Purpose |
|---|---|---:|---|
| `documentValue` | `unknown` | Yes | Supplies layout, metadata, and State Libraries. |
| `snapshot` | `WorkSpecSnapshot` | Yes | Supplies resolved observable state. |
| `options` | `WorkSpecRenderOptions` | No | Controls labels, dimensions, spacing, and asset resolution. |

The function throws `TypeError` when `snapshot.objects` is absent.

## `renderProjectToSvg(documentValue, time, options)`

This function runs the project through `time`, takes a snapshot, and returns `WorkSpecRenderResult`.

The result contains `svg`, `snapshot`, `run`, numeric `time`, and `seed`.

## Rendering options

| Option | Type | Default | Purpose |
|---|---|---:|---|
| `changesSource` | `string` | `""` | Changes source for project rendering |
| `generatorSource` | `string` | `""` | Generator source for project rendering |
| `seed` | `number` | `1` | Generator seed |
| `maxEvents` | `number` | `10000` | Work-unit budget |
| `title` | `string` | Document title | Accessible SVG title |
| `timeLabel` | `string` | Requested time | Text appended to the title |
| `padding` | `number` | `28` | Outer layout padding |
| `width`, `height` | `number` | Derived | SVG dimensions |
| `defaultLocationWidth` | `number` | Derived | Width for locations without dimensions |
| `defaultLocationHeight` | `number` | Derived | Height for locations without dimensions |
| `locationGap` | `number` | `24` | Gap in automatic location layout |
| `assetResolver` | function | None | Maps an asset ID and object to an image URL |

See the [SVG renderer reference](/docs/workspec/rendering/svg/) for layout and fallback behavior.

