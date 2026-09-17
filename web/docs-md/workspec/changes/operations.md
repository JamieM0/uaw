---
title: "Change operations"
description: "Reference set, change, move, create, and remove in Changes handlers."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Change operations

Changes handlers expose five operations. Each operation records a predetermined effect for the active task phase.

## Operation table

| Operation | Signature | Effect |
|---|---|---|
| `set` | `set(targetId, property, value, options?)` | Replaces one property value |
| `change` | `change(targetId, property, amount, options?)` | Adds a numeric delta |
| `move` | `move(targetId, locationId, options?)` | Sets the target's `location` |
| `create` | `create(object)` | Creates one object |
| `remove` | `remove(targetId)` | Removes one live object |

`set`, `change`, and `move` accept `{ temporary: true }` in start handlers. `create` and `remove` do not accept temporary effects.

## Set and change properties

```js
WorkSpec.task("fill_bin").onComplete(() => {
  set("bin", "state", "full");
  change("bin", "quantity", 12);
});
```

`move` is a `set` operation for the top-level `location` field. Other named properties use the object's `properties` map.

`change` requires a numeric current value and a numeric amount. Simultaneous `change` operations to the same property combine.

## Create an object

```js
WorkSpec.task("make_batch").onComplete(() => {
  create({
    id: "batch_17",
    type: "product",
    name: "Batch 17",
    location: "cooling_rack",
    properties: { state: "cooling" }
  });
});
```

The new object must satisfy runtime identity, type, property, location, and State Library contracts. Invalid objects do not partially enter live state.

## Remove an object

```js
WorkSpec.task("discard_filter").onComplete(() => {
  remove("used_filter");
});
```

Later writes to the removed object fail with `object.lifecycle.target_not_live`.

## Error behavior

Effects in one same-time write group are transactional. A conflict rejects the group and can fail its task. See [same-time writes and transactions](conflicts-transactions.md).

