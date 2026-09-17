---
title: "8. Generator logic"
description: "Add deterministic causal behavior that indirectly triggers declared dynamic work."
section: "learn"
type: "tutorial"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 80
---

# 8. Generator logic

You will create a second pump during execution. Its collection membership will trigger the existing work definition.

## Create the Generator source

Create `generator.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-generator" />

WorkSpec.onUpdate(({ time, create }) => {
  if (time !== 483) {
    return;
  }

  create({
    id: "pump_b",
    type: "product",
    name: "Pump B",
    location: "intake",
    properties: { quantity: 1, state: "awaiting_inspection" }
  });
});
```

The runtime expresses `08:03` as elapsed minute `483`. Generator callbacks receive elapsed minutes in `time`.

## Validate the generated run

Run project validation through `08:05`:

```console
npx workspec validate dynamic-start.workspec.json \
  --generator generator.workspec.js \
  --time 08:05
```

Expected final line:

```text
✓ No problems found
```

## Inspect the indirect result

Run a snapshot with the same horizon:

```console
npx workspec snapshot dynamic-start.workspec.json \
  --generator generator.workspec.js \
  --time 08:05 \
  --json
```

The snapshot contains `pump_a` and `pump_b`. It also contains one `inspect_arrival` task instance for each pump.

The runtime follows this path:

1. The Generator creates `pump_b` as a world object.
2. `pump_b` matches the declared `waiting_pumps` collection.
3. The runtime evaluates the `inspect_arrival` work definition.
4. The runtime creates a task instance correlated with `pump_b`.

> **Checkpoint:** `create` creates a world object only. The declared work definition creates the task instance.

## Keep the run deterministic

Use the Generator context's `random()` function when behavior needs random values. Do not use `Math.random()`.

Supply `--seed` to reproduce seeded Generator behavior. The default seed is `1`.

Read [Generator and dynamic work](/docs/workspec/generators/dynamic-work-relationship/) for the ownership boundary. Read [Generator execution order](/docs/workspec/generators/execution-order/) for same-time behavior.

## Next step

[Complete the capstone project](/docs/learn/capstone/) with all four project files.
