---
title: "9. Capstone project"
description: "Build and verify a complete WorkSpec 2.2 project with dynamic work and one authoritative run."
section: "learn"
type: "tutorial"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 90
---

# 9. Capstone project

You will combine Starting State, Changes, a Constraint, and Generator logic in one inspection-depot project.

## Create the Starting State

Create `start.workspec.json`:

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": {
      "title": "Inspection depot",
      "description": "Open a depot and inspect pumps that arrive before closing.",
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
          {
            "id": "intake",
            "name": "Intake",
            "shape": { "type": "rect", "x": 20, "y": 20, "width": 200, "height": 140 }
          },
          {
            "id": "workshop",
            "name": "Workshop",
            "shape": { "type": "rect", "x": 260, "y": 20, "width": 200, "height": 140 }
          }
        ]
      },
      "objects": [
        {
          "id": "manager",
          "type": "actor",
          "name": "Depot manager",
          "location": "workshop",
          "properties": { "state": "available" }
        },
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
      "tasks": [
        {
          "id": "open_depot",
          "actor_id": "manager",
          "start": "08:00",
          "duration": "1m",
          "location": "workshop"
        }
      ],
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

## Create the Changes source

Create `changes.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-changes" />

WorkSpec.task("open_depot", (task) => {
  task.onStart(() => {
    set("manager", "state", "opening", { temporary: true });
  });

  task.onComplete(() => {
    set("manager", "state", "available");
  });
});
```

## Create the Generator source

Create `generator.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-generator" />

WorkSpec.onUpdate(({ time, create }) => {
  if (time === 483) {
    create({
      id: "pump_b",
      type: "product",
      name: "Pump B",
      location: "intake",
      properties: { quantity: 1, state: "awaiting_inspection" }
    });
  }
});
```

The Generator changes the world. The collection and work definition remain the only task-instantiation path.

## Create the Constraint source

Create `constraints.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-constraints" />

WorkSpec.constraint("inspection.all_arrivals_complete", (context) => {
  const instances = Object.values(context.state().task_instances);
  const incomplete = instances.filter((instance) => instance.status !== "completed");

  if (instances.length === 2 && incomplete.length === 0) {
    return null;
  }

  return {
    severity: "error",
    observed: {
      instance_count: instances.length,
      incomplete: incomplete.map((instance) => instance.id)
    },
    expected: { instance_count: 2, incomplete: [] },
    message: "Both pump inspection instances must complete."
  };
});
```

## Validate the complete project

> **Warning:** Review every executable source before you run it. WorkSpec project sources contain ordinary JavaScript.

Run project validation with the Constraint:

```console
npx workspec validate start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --constraints constraints.workspec.js \
  --time 08:05 \
  --seed 7 \
  --json \
  --yes
```

The result has an empty `problems` array. Its `run` object records seed `7` and a resolved-through time of `485`.

## Inspect the resolved state

Run a snapshot with the same project inputs:

```console
npx workspec snapshot start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --time 08:05 \
  --seed 7 \
  --json
```

Check these results:

- `state.objects` contains `pump_a` and `pump_b`.
- `state.task_statuses.open_depot` is `completed`.
- `state.task_instances` contains two completed inspection instances.
- `run.resolved_through` is `485`.

## Run the domain rule

Run the Constraint directly:

```console
npx workspec constraints start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --constraints constraints.workspec.js \
  --time 08:05 \
  --seed 7 \
  --yes
```

Expected output:

```text
Runtime constraints at 485 (resolved through 485): 0 violations (0 errors), 0 validation problems
```

## Render the result

Render the resolved world:

```console
npx workspec render start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --time 08:05 \
  --seed 7 \
  --out inspection-depot.svg
```

The SVG shows both pumps at intake. The snapshot remains the source of truth for their task-instance records.

## Result

You now have a canonical WorkSpec 2.2 project that uses every authored source type.

Continue with the [WorkSpec reference](/docs/workspec/overview/) for exact contracts. Use [Choose your path](/docs/start/where-next/) for task-focused sections.
