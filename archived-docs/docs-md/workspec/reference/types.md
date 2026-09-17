# WorkSpec v2.0 Type Reference

This page lists built-in types, reserved names, and the custom type definition mechanism.

---

## Built-in types

### Core types

| Type | Meaning | Traits |
|---|---|---|
| `actor` | Human worker | stateful, performer |
| `equipment` | Machine/tool | stateful, performer |
| `resource` | Consumable input | quantifiable |
| `product` | Output | quantifiable |
| `service` | Automated/background performer | stateful, performer |

### Digital types

| Type | Meaning | Traits |
|---|---|---|
| `display` | Digital screen | stateful |
| `screen_element` | UI component | stateful |
| `digital_object` | Virtual entity | stateful and/or quantifiable |

---

## Type traits (capabilities)

WorkSpec uses type traits to define capabilities:

| Trait | Meaning | Typical properties |
|---|---|---|
| performer | Can be used in `task.actor_id` | none required |
| stateful | Has discrete states | `state` |
| quantifiable | Has measurable quantity | `quantity` |

Built-in trait mappings:

- `actor`: stateful + performer
- `equipment`: stateful + performer
- `resource`: quantifiable
- `product`: quantifiable
- `service`: stateful + performer
- `display`: stateful
- `screen_element`: stateful
- `digital_object`: stateful + quantifiable

---

## Reserved type names

The following type names are reserved and must not be used:

- `timeline_actors`
- `_internal` (and any type starting with `_`)
- `any`
- `unknown`

---

## Removed aliases (v2.0)

The following are not valid in v2.0:

- `material` → use `resource`
- `ingredient` → use `resource`
- `tool` → use `equipment`

---

## Custom type definitions

Custom types are declared at:

- `simulation.type_definitions`

Example:

```json
{
    "type_definitions": {
        "vehicle": {
            "extends": "equipment",
            "description": "Motorized transport equipment",
            "additional_properties": {
                "speed": { "type": "number", "unit": "km/h" },
                "fuel_capacity": { "type": "number", "unit": "liters" }
            }
        }
    }
}
```

Rules:

- `extends` must reference a built-in type (or a chain that resolves to a built-in type).
- Objects with `type: "vehicle"` must have a `vehicle` definition.
- Additional property schemas can be used by validators for type checking.

