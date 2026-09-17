---
title: "Identifiers and naming"
description: "Reference canonical WorkSpec identifier grammar, namespaces, reserved names, and uniqueness rules."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 110
---

# Identifiers and naming

WorkSpec identifiers use lowercase snake case and remain stable across project sources.

## Plain identifiers

A plain identifier starts with a lowercase ASCII letter. Later characters can contain lowercase letters, digits, and underscores.

```text
^[a-z][a-z0-9_]{0,249}$
```

Task, collection, work-definition, State Library, appearance, and day-type IDs use plain identifiers. Task IDs cannot use namespaces.

## Object identifiers

Object IDs can use the plain form or a type namespace.

```text
worker_1
actor:worker_1
```

A namespaced object ID uses `type:id`. The namespace must exactly match the object's `type` value.

## Reserved names

Object types cannot start with `_`. WorkSpec reserves `timeline_actors`, `any`, and `unknown` as type names.

Runtime expression binding reserves the exact entity ID `current`. Collection aliases also cannot use `current`.

## Uniqueness

Object IDs and task IDs must be unique in their own declarations. Runtime validation also rejects IDs shared across referenceable entity kinds.

Work-definition IDs must be unique. Runtime task instances receive deterministic generated IDs and do not reuse authored task IDs.

## Property names

Referenceable property names cannot contain a dot. The compact expression grammar reserves the dot between an entity and its member.
