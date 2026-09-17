---
title: "Rendering model"
description: "Understand rendering as a presentation of resolved WorkSpec state."
section: "workspec"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# Rendering model

WorkSpec rendering presents resolved state. It does not run an independent simulation or own world truth.

The renderer consumes a Starting State document for presentation metadata and a resolved snapshot for observable state. It uses locations, live objects, semantic state, and State Library mappings.

## Two rendering paths

Use `renderSnapshotToSvg` when you already have a snapshot from an authoritative run.

Use `renderProjectToSvg` for one independent run-and-render operation. This convenience function runs the project through the requested time and renders that snapshot.

When several outputs must agree, create one run and pass its snapshots to each consumer.

## Presentation boundary

The renderer can decide SVG dimensions, object placement within a location, fallback glyphs, and labels. These decisions do not change WorkSpec state.

Object `location` and `properties.state` remain semantic world facts. Asset IDs map those facts to visuals without storing asset bytes in WorkSpec.

## Product boundary

These pages document standalone rendering semantics and library contracts. WorkSpec Studio owns its visualizer controls and project workflow.

## Related pages

- [SVG renderer](svg.md)
- [State visuals and assets](state-visuals.md)
- [Visual layout](layout.md)
- [Snapshots and resolved state](../runtime/snapshots.md)

