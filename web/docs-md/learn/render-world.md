---
title: "6. Render the world"
description: "Render a resolved WorkSpec 2.2 world as deterministic standalone SVG."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# 6. Render the world

You will render the repair-depot world at two resolved times.

## Render active work

Render the world while inspection is active:

```console
npx workspec render start.workspec.json \
  --changes changes.workspec.js \
  --time 08:05 \
  --out repair-0805.svg
```

The success line ends with the absolute output path:

```text
✓ Rendered 08:05 to /ABSOLUTE/PATH/repair-0805.svg
```

Open `repair-0805.svg`. The pump remains at intake with the semantic state `under_inspection`.

## Render the final result

Render the world after repair completes:

```console
npx workspec render start.workspec.json \
  --changes changes.workspec.js \
  --time 08:30 \
  --out repair-0830.svg
```

The pump appears at dispatch with the semantic state `repaired`.

## Compare state and presentation

The runtime owns object state and location. The renderer chooses dimensions, labels, and visual placement within the authored locations.

Rendering a project is a convenient independent run-and-render operation. Application integrations can render a snapshot from an existing authoritative run.

> **Checkpoint:** If the SVG shows the wrong semantic state, inspect the snapshot first. Do not treat presentation as a second source of truth.

See the [rendering model](/docs/workspec/rendering/overview/) and [SVG renderer](/docs/workspec/rendering/svg/) for exact behavior and options.

## Next step

[Model collections and dynamic work](/docs/learn/collections-and-dynamic-work/) before you add Generator logic.
