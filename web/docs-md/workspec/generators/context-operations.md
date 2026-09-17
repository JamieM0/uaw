---
title: "Generator context and operations"
description: "Reference Generator time, state reads, randomness, and mutation operations."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Generator context and operations

Each Generator callback receives a frozen context for its logical time.

## Context members

| Member | Contract |
|---|---|
| `time` | Current elapsed minute |
| `delta` | `0` at start, then `1` at each update |
| `state` | Snapshot of current objects and locations |
| `random()` | Next deterministic value from `0` up to, but not including, `1` |
| `get(targetId, property)` | Cloned top-level or `properties` value |
| `set(targetId, property, value)` | Replace one value |
| `change(targetId, property, amount)` | Add a numeric delta |
| `move(targetId, locationId)` | Set `location` |
| `create(object)` | Create one validated runtime object |
| `remove(targetId)` | Remove one live object |

`state` contains cloned values. Mutating the clone does not mutate the world. Use a Generator operation to record a write.

## Read current state

```js
WorkSpec.onUpdate(({ get, change }) => {
  if (get("reservoir", "level") > 0) {
    change("reservoir", "level", -1);
  }
});
```

`get` reads objects or locations. It first checks a top-level field, then checks `properties`. It returns `undefined` for an unknown target or property.

A successful `get` marks the target as used for runtime usage accounting.

## Apply mutations

Generator writes use the same runtime validation and transaction machinery as task effects. Runtime-created objects must meet ID, type, property, location, and State Library contracts.

Generator operations cannot create task instances directly. `create` creates world objects only.

## Same-time conflicts

Generator writes win conflicts with Changes at the same logical time. The runtime reports `generator.changes.conflict` as a warning.

Multiple Generator callbacks contribute writes to one Generator transaction. Invalid or conflicting writes can cause Generator writes for that time to fail.

