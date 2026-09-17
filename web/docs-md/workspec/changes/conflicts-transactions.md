---
title: "Same-time writes, conflicts, and transactions"
description: "Understand deterministic combination and rejection of concurrent Changes writes."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# Same-time writes, conflicts, and transactions

The runtime prepares simultaneous Changes against one state snapshot. It then groups writes by object and property.

## Compatible writes

Multiple numeric `change` operations to the same object property combine. The runtime applies the sum to the prior numeric value.

```js
WorkSpec.task("receive_a").onComplete(() => change("stock", "quantity", 2));
WorkSpec.task("receive_b").onComplete(() => change("stock", "quantity", 3));
```

If both tasks complete together, the quantity increases by `5`.

## Conflicting writes

Other simultaneous writes to the same property conflict. A property write also conflicts with a simultaneous create or remove for that object.

The runtime rejects each conflicting write group. It emits `interaction.write.conflict` and marks the contributing tasks as failed.

This rule prevents source order from deciding an ambiguous world state.

## Generator precedence

Generator writes have explicit precedence over Changes at the same logical time.

- A Generator write replaces a conflicting completion Change.
- A conflicting start Change is suppressed.
- The runtime emits `generator.changes.conflict` with the target, property, and time.

The warning is non-blocking. Non-conflicting Changes at that time still apply.

## Temporary-write conflicts

The runtime rejects overlapping temporary writes to the same property. It reports `interaction.temporary.overlap`.

## Transaction boundary

Conflict handling groups writes by target property or lifecycle identity. It does not make every handler a whole-project transaction.

If one task produces any failed write, the runtime rejects that task's prepared writes for the phase. Other non-conflicting tasks can still succeed.

