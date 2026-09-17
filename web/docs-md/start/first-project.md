---
title: "Your first WorkSpec project"
description: "Create and run a small WorkSpec 2.2 project with Changes, a Constraint, a snapshot, and SVG rendering."
section: "start"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Your first WorkSpec project

You will model one parcel moving from a packing bench to a dispatch area.

The completed project validates its sources, inspects resolved state, runs a domain rule, and renders an SVG file.

## Prerequisites

Complete [Install and verify](/docs/start/install/) in an empty `parcel-workflow` directory.

## Create the Starting State

1. Create `start.workspec.json` with this WorkSpec 2.2 document:

   ```json
   {
     "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
     "simulation": {
       "schema_version": "2.2",
       "meta": {
         "title": "Parcel workflow",
         "description": "Pack one parcel and move it to dispatch.",
         "domain": "logistics"
       },
       "config": {
         "time_unit": "minutes",
         "start_time": "09:00",
         "end_time": "10:00"
       },
       "world": {
         "layout": {
           "locations": [
             {
               "id": "packing_bench",
               "name": "Packing bench",
               "shape": { "type": "rect", "x": 20, "y": 20, "width": 220, "height": 140 }
             },
             {
               "id": "dispatch_area",
               "name": "Dispatch area",
               "shape": { "type": "rect", "x": 280, "y": 20, "width": 220, "height": 140 }
             }
           ]
         },
         "objects": [
           {
             "id": "packer",
             "type": "actor",
             "name": "Packer",
             "location": "packing_bench",
             "properties": { "state": "available" }
           },
           {
             "id": "parcel",
             "type": "product",
             "name": "Parcel",
             "location": "packing_bench",
             "properties": { "quantity": 1, "state": "unpacked" }
           }
         ]
       },
       "process": {
         "tasks": [
           {
             "id": "pack_parcel",
             "actor_id": "packer",
             "start": "09:00",
             "duration": "10m",
             "location": "packing_bench"
           }
         ]
       }
     }
   }
   ```

2. Validate the document.

   ```console
   npx workspec validate start.workspec.json
   ```

   Expected final line:

   ```text
   ✓ No problems found
   ```

The Starting State declares facts and plans. It does not contain the task's effects.

## Add the task effects

1. Create `changes.workspec.js`:

   ```js
   /// <reference types="workspec/workspec-changes" />

   WorkSpec.task("pack_parcel", (task) => {
     task.onStart(() => {
       set("parcel", "state", "packing", { temporary: true });
     });

     task.onComplete(() => {
       set("parcel", "state", "packed");
       move("parcel", "dispatch_area");
     });
   });
   ```

2. Validate the project through the task's completion time.

   ```console
   npx workspec validate start.workspec.json \
     --time 09:10
   ```

   Expected final line:

   ```text
   ✓ No problems found
   ```

The [Changes reference](/docs/workspec/changes/overview/) owns the complete authoring and operation rules.

## Inspect a snapshot

To inspect resolved state at `09:10`, run:

```console
npx workspec snapshot start.workspec.json \
  --time 09:10 \
  --json
```

The JSON output contains these resolved values:

```json
{
  "state": "packed",
  "location": "dispatch_area",
  "task_status": "completed"
}
```

These three values appear within the larger snapshot envelope. Find them under `state.objects.parcel` and `state.task_statuses.pack_parcel`.

## Add a domain rule

1. Create `constraints.workspec.js`:

   ```js
   /// <reference types="workspec/workspec-constraints" />

   WorkSpec.constraint("parcel.ready_for_dispatch", (context) => {
     const state = context.get("parcel", "state");
     const location = context.get("parcel", "location");

     if (state === "packed" && location === "dispatch_area") {
       return null;
     }

     return {
       severity: "error",
       objects: ["parcel"],
       observed: { state, location },
       expected: { state: "packed", location: "dispatch_area" },
       message: "The packed parcel must be in the dispatch area."
     };
   });
   ```

2. Review the file before you execute it.

3. Run the Constraint against the resolved project.

   ```console
   npx workspec constraints start.workspec.json \
     --time 09:10 \
     --yes
   ```

   Expected output:

   ```text
   Runtime constraints at 550 (resolved through 550): 0 violations (0 errors), 0 validation problems
   ```

> **Warning:** Executable WorkSpec sources are JavaScript. Run `--yes` only after you review and trust the Constraint source.

## Render the world

To render the same project time as standalone SVG, run:

```console
npx workspec render start.workspec.json \
  --time 09:10 \
  --out parcel-world.svg
```

The success line ends with the absolute output path:

```text
✓ Rendered 09:10 to /ABSOLUTE/PATH/parcel-world.svg
```

Open `parcel-world.svg` in an SVG viewer. The parcel appears in the dispatch area.

## Result

Your project now separates declarations, predetermined effects, domain rules, resolved state, and presentation.

## Next step

[Review the project files](/docs/start/project-files/) before you begin the longer learning path.
