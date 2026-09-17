---
title: "Actors and performers"
description: "Reference performer-capable types, fixed assignments, selection expressions, and runtime binding."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 400
---

# Actors and performers

An actor is an object type. A performer is the object selected to perform one task.

## Performer-capable types

Built-in `actor`, `equipment`, and `service` objects can perform tasks. A custom type can inherit this capability.

A type trait with `can_be_actor_id: true` can also make a custom type performer-capable.

## Fixed performer

Set `actor_id` to an object ID for a fixed assignment.

```json
{ "actor_id": "operator_1" }
```

In WorkSpec 2.2, earlier execution can create a literal performer. Runtime state determines whether the object is live and eligible.

## Referenced performer

`actor_id` can use a compact reference that resolves to an object ID string.

```json
{ "actor_id": "@batch.assigned_operator" }
```

## Selected performer

Use `select_member` to choose one deterministic member from an object collection.

```json
{
  "actor_id": {
    "select_member": {
      "collection": "available_workers",
      "as": "candidate",
      "policy": "first_by_id"
    }
  }
}
```

The selected collection must contain objects. Selection happens after the task's `when` guard passes.

## Assignment evidence

The runtime records the selected performer and assignment history. Authored `actor_id` is an expression, not guaranteed resolved evidence.
