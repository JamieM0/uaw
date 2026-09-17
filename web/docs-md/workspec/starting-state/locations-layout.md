---
title: "Locations and layout"
description: "Reference physical locations, nesting, coordinates, shapes, and object placement."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 350
---

# Locations and layout

`simulation.world.layout` declares physical locations and optional presentation geometry.

## Locations

`world.layout.locations` is an array. Each referenceable location needs a stable `id`.

Common location fields include `id`, `name`, `parent_id`, `shape`, `coordinates`, `position`, `emoji`, and `properties`.

```json
{
  "world": {
    "layout": {
      "locations": [
        {
          "id": "sterile_zone",
          "name": "Sterile zone",
          "shape": "rectangle",
          "coordinates": { "x": 20, "y": 20, "width": 300, "height": 180 }
        }
      ]
    },
    "objects": []
  }
}
```

## Parentage

Use `parent_id` to place one location inside another location. Keep parent relationships acyclic and reference declared locations.

## Placement

An object's `location` references a location ID. A task can also declare a `location` for planned work.

When locations exist, the document validator checks object and task location references. Runtime movement validity is a separate history concern.

## Presentation boundary

Shapes, coordinates, positions, and emoji guide presentation. They do not change task scheduling or world-state semantics.

Renderers can assign presentation-only positions to objects without authored coordinates.

