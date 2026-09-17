---
title: "7. Collections and dynamic work"
description: "Declare a collection and work definition that create runtime task instances in WorkSpec 2.2."
section: "learn"
type: "tutorial"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 70
---

# 7. Collections and dynamic work

You will declare inspection work for each pump that enters a collection.

This lesson does not use a Generator. It first establishes who owns dynamic work.

## Create a dynamic-work Starting State

Create `dynamic-start.workspec.json`:

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": {
      "title": "Dynamic pump inspection",
      "description": "Create inspection work for waiting pumps.",
      "domain": "maintenance"
    },
    "config": {
      "time_unit": "minutes",
      "start_time": "08:00",
      "end_time": "08:10"
    },
    "world": {
      "layout": {
        "locations": [
          { "id": "intake", "name": "Intake" },
          { "id": "workshop", "name": "Workshop" }
        ]
      },
      "objects": [
        {
          "id": "inspector",
          "type": "actor",
          "name": "Inspector",
          "location": "workshop",
          "properties": { "state": "available" }
        },
        {
          "id": "pump_a",
          "type": "product",
          "name": "Pump A",
          "location": "intake",
          "properties": { "quantity": 1, "state": "awaiting_inspection" }
        }
      ]
    },
    "collections": {
      "waiting_pumps": {
        "from": "objects",
        "as": "item",
        "where": {
          "all": [
            { "==": ["@item.type", "product"] },
            { "==": ["@item.state", "awaiting_inspection"] }
          ]
        },
        "open": true,
        "closes_at": "08:10"
      }
    },
    "process": {
      "tasks": [],
      "work_definitions": [
        {
          "id": "inspect_arrival",
          "instantiate": {
            "for_each": "waiting_pumps",
            "as": "pump",
            "start": "on_appearance"
          },
          "task": {
            "actor_id": "inspector",
            "duration": "2m",
            "location": "workshop"
          }
        }
      ]
    }
  }
}
```

## Validate the declaration

Run document validation:

```console
npx workspec validate dynamic-start.workspec.json
```

Expected final line:

```text
✓ No problems found
```

## Inspect the runtime task instance

Run through `08:02`:

```console
npx workspec snapshot dynamic-start.workspec.json --time 08:02 --json
```

The `state.task_instances` object contains one entry. Its record includes these values:

```json
{
  "definition_id": "inspect_arrival",
  "correlation_id": "pump_a",
  "correlation_collection": "waiting_pumps",
  "status": "completed"
}
```

The runtime supplies the task-instance ID and timing. Starting State owns the reusable task template.

> **Checkpoint:** Work definitions declare dynamic work. No Generator API creates this task instance.

Use [collections](/docs/workspec/starting-state/collections/) and [work definitions](/docs/workspec/starting-state/work-definitions/) for exact syntax.

## Next step

[Add Generator logic](/docs/learn/generators/) that changes collection membership indirectly.
