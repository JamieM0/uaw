---
title: "4. Constraints"
description: "Check a domain rule against resolved WorkSpec state without changing execution."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# 4. Constraints

You will require every repaired pump to reach dispatch.

## Create the Constraint source

Create `constraints.workspec.js`:

```js
// @ts-check
/// <reference types="workspec/workspec-constraints" />

WorkSpec.constraint("repair.reaches_dispatch", (context) => {
  const state = context.get("pump", "state");
  const location = context.get("pump", "location");

  if (state !== "repaired" || location === "dispatch") {
    return null;
  }

  return {
    severity: "error",
    objects: ["pump"],
    property: "location",
    observed: location,
    expected: "dispatch",
    message: "A repaired pump must reach dispatch."
  };
});
```

This rule reads the selected resolved state. It does not inspect the Changes source.

## Run the Constraint

> **Warning:** Review `constraints.workspec.js` before you execute it. The file contains ordinary JavaScript.

Run the project and check the rule at `08:30`:

```console
npx workspec constraints start.workspec.json \
  --changes changes.workspec.js \
  --constraints constraints.workspec.js \
  --time 08:30 \
  --yes
```

Expected output:

```text
Runtime constraints at 510 (resolved through 510): 0 violations (0 errors), 0 validation problems
```

## See a useful failure

Temporarily change the final `move` target in `changes.workspec.js` from `dispatch` to `workshop`. Run the Constraint command again.

The command reports one error violation and exits with status `1`. Restore `dispatch` after you inspect the result.

> **Checkpoint:** Document validation accepts both location choices. The Constraint expresses the project-specific rule.

Use [Constraints overview](/docs/workspec/constraints/overview/) for the model. Use [Constraint violations](/docs/workspec/constraints/violations/) for the return contract.

## Next step

[Inspect and debug](/docs/learn/inspect-state/) the project with Problems and snapshots.
