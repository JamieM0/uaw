---
title: "1. World state"
description: "Build a WorkSpec 2.2 Starting State with objects, properties, and locations."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# 1. World state

You will begin a repair-depot project by declaring its initial world.

## Create the project directory

1. Create and enter a new directory.

   ```console
   mkdir repair-depot
   cd repair-depot
   ```

2. Install WorkSpec locally.

   ```console
   npm init --yes
   npm install workspec
   ```

## Declare the initial world

Create `start.workspec.json`:

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": {
      "title": "Repair depot",
      "description": "Inspect and repair one returned pump.",
      "domain": "maintenance"
    },
    "config": {
      "time_unit": "minutes",
      "start_time": "08:00",
      "end_time": "09:00"
    },
    "world": {
      "layout": {
        "locations": [
          {
            "id": "intake",
            "name": "Intake",
            "shape": { "type": "rect", "x": 20, "y": 20, "width": 180, "height": 140 }
          },
          {
            "id": "workshop",
            "name": "Workshop",
            "shape": { "type": "rect", "x": 230, "y": 20, "width": 180, "height": 140 }
          },
          {
            "id": "dispatch",
            "name": "Dispatch",
            "shape": { "type": "rect", "x": 440, "y": 20, "width": 180, "height": 140 }
          }
        ]
      },
      "objects": [
        {
          "id": "technician",
          "type": "actor",
          "name": "Repair technician",
          "location": "workshop",
          "properties": { "state": "available" }
        },
        {
          "id": "test_bench",
          "type": "equipment",
          "name": "Test bench",
          "location": "workshop",
          "properties": { "state": "ready" }
        },
        {
          "id": "pump",
          "type": "product",
          "name": "Returned pump",
          "location": "intake",
          "properties": { "quantity": 1, "state": "awaiting_inspection" }
        }
      ]
    },
    "process": {
      "tasks": []
    }
  }
}
```

## Validate the Starting State

Run document validation:

```console
npx workspec validate start.workspec.json
```

Expected final line:

```text
✓ No problems found
```

> **Checkpoint:** The file declares what exists at the initial time. It does not describe any state changes.

## Understand the model

Each object has a stable `id`, a `type`, a name, and type-specific properties. The `location` field places an object in a declared location.

The renderer can use location shapes, but those shapes do not change runtime behavior.

Use [objects and properties](/docs/workspec/starting-state/objects/) and [locations and layout](/docs/workspec/starting-state/locations-layout/) for exact field rules.

## Next step

[Add tasks and time](/docs/learn/tasks-and-time/) to the repair-depot project.
