---
title: "3. Changes"
description: "Attach predetermined start and completion effects to known WorkSpec tasks."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# 3. Changes

You will attach predetermined effects to the repair-depot tasks.

## Create the Changes source

Create `changes.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-changes" />

WorkSpec.task("inspect_pump", (task) => {
  task.onStart(() => {
    set("pump", "state", "under_inspection", { temporary: true });
  });

  task.onComplete(() => {
    set("pump", "state", "inspection_complete");
    move("pump", "workshop");
  });
});

WorkSpec.task("repair_pump", (task) => {
  task.onStart(() => {
    set("pump", "state", "under_repair", { temporary: true });
  });

  task.onComplete(() => {
    set("pump", "state", "repaired");
    move("pump", "dispatch");
  });
});
```

The temporary state lasts only while its task is active. The runtime restores the earlier value before it applies completion effects.

## Validate the project sources

Run project validation through the final completion:

```console
npx workspec validate start.workspec.json \
  --changes changes.workspec.js \
  --time 08:30
```

Expected final line:

```text
✓ No problems found
```

## Observe a temporary effect

Inspect the world while inspection is active:

```console
npx workspec snapshot start.workspec.json \
  --changes changes.workspec.js \
  --time 08:05 \
  --json
```

The value at `state.objects.pump.properties.state` is:

```text
under_inspection
```

## Observe completion effects

Inspect the final state:

```console
npx workspec snapshot start.workspec.json \
  --changes changes.workspec.js \
  --time 08:30 \
  --json
```

The pump has state `repaired` and location `dispatch`.

> **Checkpoint:** This Changes source never reads current state. You know each effect from the task and its lifecycle phase.

Use [Authoring Changes](/docs/workspec/changes/authoring/) and [Change operations](/docs/workspec/changes/operations/) for exact behavior.

## Next step

[Add a Constraint](/docs/learn/constraints/) to check a domain rule against the resolved result.
