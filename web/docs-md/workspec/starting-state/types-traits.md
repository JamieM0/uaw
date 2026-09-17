---
title: "Type definitions and traits"
description: "Reference custom object types, inheritance, declared properties, and performer traits."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 340
---

# Type definitions and traits

Type definitions extend built-in object types with reusable property contracts and traits.

## Type definitions

`simulation.type_definitions` is an object keyed by custom type ID. Each definition requires `extends`.

```json
{
  "type_definitions": {
    "autoclave": {
      "extends": "equipment",
      "traits": ["automated_performer"],
      "additional_properties": {
        "temperature": { "type": "number" }
      }
    }
  }
}
```

The inheritance chain must resolve to a built-in type. Custom objects inherit the base type's required properties.

## Declared properties

`additional_properties` declares type expectations for custom properties. Runtime-created objects must satisfy these declared types.

Supported property contracts depend on runtime validation. Keep initial and runtime-created values consistent with the declaration.

## Type traits

`simulation.type_traits` is an object keyed by trait ID. A type definition lists trait IDs in `traits`.

A trait with `can_be_actor_id: true` makes a matching custom type eligible as a performer. Built-in actors, equipment, and services are performers without this trait.

```json
{
  "type_traits": {
    "automated_performer": {
      "can_be_actor_id": true
    }
  }
}
```

## Reserved type names

Do not use a type name that starts with `_`. Do not use `timeline_actors`, `any`, or `unknown`.

