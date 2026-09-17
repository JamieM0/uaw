---
title: "Objects and properties"
description: "Reference canonical world objects, built-in types, required properties, and placement fields."
section: "workspec"
type: "reference"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 330
---

# Objects and properties

Objects declare the entities that exist at the start of a run.

## Object fields

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `id` | string | Yes | Unique plain or type-namespaced object ID. |
| `type` | string | Yes | Built-in or declared custom type. |
| `name` | string | Yes | Human-readable name. |
| `properties` | object | By type | Initial domain and runtime properties. |
| `location` | string | No | ID of a declared location. |
| `state_library` | string | No | ID of a declared State Library. |
| `appearance` | string | No | Appearance within the selected State Library. |
| `emoji` | string | No | Presentation hint. |

## Built-in types

Built-in object types are `actor`, `equipment`, `resource`, `product`, `service`, `display`, `screen_element`, and `digital_object`.

The aliases `material`, `ingredient`, and `tool` are not canonical types. Use `resource` or `equipment` as appropriate.

## Required properties

Quantifiable types require a finite, non-negative `properties.quantity`. These types are `resource`, `product`, and `digital_object`.

Stateful types require a non-empty string `properties.state`. Stateful built-ins exclude `resource` and `product`.

Custom types inherit these requirements from their built-in base type.

## Example

```json
{
  "id": "resource:sterile_wrap",
  "type": "resource",
  "name": "Sterile wrap",
  "location": "prep_room",
  "properties": {
    "quantity": 50,
    "unit": "sheet"
  }
}
```

The namespace `resource` matches the object type. The `prep_room` location must exist when the layout declares locations.

## Runtime boundary

Starting State describes the initial object. Changes and a Generator can change, create, move, or remove objects during a run.

