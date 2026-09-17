---
title: "Visual layout"
description: "Reference location bounds, automatic object placement, and unplaced objects."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Visual layout

The SVG renderer combines authored location geometry with deterministic presentation-only object placement.

## Location sources

The renderer first uses `simulation.world.layout.locations`. If that array is absent or empty, it uses snapshot locations.

For each location, snapshot values can augment authored values. The renderer sorts the resulting locations by ID.

## Location bounds

The renderer reads width and height from `shape`. It falls back to `coordinates`, then to calculated defaults.

It reads `x` from `shape.x`, then `coordinates.x`. It reads vertical position from `shape.y`, then `coordinates.z`.

Locations without coordinates enter a four-column automatic grid. `world.layout.meta.pixels_per_unit` influences default dimensions and defaults to `20`.

## Object placement

Objects use their resolved `location` field. The renderer sorts object IDs and places members in a calculated grid inside each location.

Placement uses margins, gaps, and a maximum glyph size. It does not write positions back to the snapshot.

## Unplaced objects

The renderer treats an unmatched object `location` as unplaced. It lists the object in the `__unplaced__` SVG group.

The unplaced section preserves visibility without inventing a semantic location.

## Layout options

Callers can set output width, height, padding, default location dimensions, and location gap. Invalid numeric values fall back to renderer defaults.

These options change only the presentation. They do not alter locations, object membership, or the authoritative run.
