# WorkSpec v2.0 Interaction System

Interactions define how tasks affect objects.

---

## Interaction forms

An interaction is an item in `task.interactions[]`.

WorkSpec v2.0 supports three forms:

1) Property changes (`target_id` + `property_changes`)
2) Create (`action: "create"` + `object`)
3) Delete (`action: "delete"` + `target_id`)

---

## Property change interactions

Example:

```json
{
    "target_id": "flour",
    "property_changes": {
        "quantity": { "delta": -2.5 }
    }
}
```

### `target_id`

`target_id` references an object id in the simulation state.

### `property_changes`

`property_changes` is a dictionary of property name → operator object.

Properties can refer to:

- Common type properties (e.g., `quantity`, `state`)
- Custom properties in the object `properties` bag
- Top-level object fields that are explicitly supported by a consumer (for example, `location`)

---

## Change operators

| Operator | Shape | Meaning |
|---|---|---|
| `from`/`to` | `{ "from": A, "to": B }` | Validated transition |
| `delta` | `{ "delta": N }` | Add/subtract numeric amount |
| `set` | `{ "set": V }` | Set to absolute value |
| `multiply` | `{ "multiply": N }` | Multiply numeric amount |
| `append` | `{ "append": V }` | Append to array |
| `remove` | `{ "remove": V }` | Remove from array |
| `increment` | `{ "increment": true }` | +1 shorthand |
| `decrement` | `{ "decrement": true }` | -1 shorthand |

### Examples

Set:

```json
{ "target_id": "machine", "property_changes": { "state": { "set": "clean" } } }
```

Delta:

```json
{ "target_id": "flour", "property_changes": { "quantity": { "delta": -1 } } }
```

From/to:

```json
{ "target_id": "oven", "property_changes": { "state": { "from": "off", "to": "preheating" } } }
```

Multiply:

```json
{ "target_id": "price_index", "property_changes": { "value": { "multiply": 1.1 } } }
```

Append/remove:

```json
{ "target_id": "batch", "property_changes": { "tags": { "append": "processed" } } }
{ "target_id": "batch", "property_changes": { "tags": { "remove": "raw" } } }
```

Increment/decrement:

```json
{ "target_id": "counter", "property_changes": { "count": { "increment": true } } }
{ "target_id": "counter", "property_changes": { "count": { "decrement": true } } }
```

Validation rules:

- Cannot combine `from`/`to` with `delta`/`set`/`multiply`/`append`/`remove`/`increment`/`decrement` on the same property.
- `from` requires `to` (and vice-versa).
- `delta` and `multiply` require numeric values.
- `increment`/`decrement` are only valid for numeric properties.

---

## Temporary changes

If `temporary: true`, changes revert after the task completes.

```json
{
    "target_id": "industrial_mixer",
    "property_changes": {
        "state": { "from": "available", "to": "in_use" }
    },
    "temporary": true
}
```

Notes:

- `temporary` applies to property-change interactions.
- `temporary` is not meaningful for `action: "create"` and `action: "delete"` interactions.

---

## Create interactions

Create a new object during a task:

```json
{
    "action": "create",
    "object": {
        "id": "batch_001",
        "type": "product",
        "name": "Bread Batch #001",
        "location": "cooling_rack",
        "properties": {
            "quantity": 12,
            "unit": "loaves"
        }
    }
}
```

Rules:

- Created objects must conform to the object model (required `id`, `type`, `name`).
- After creation, the object becomes available for subsequent tasks to reference.

---

## Delete interactions

Delete an existing object during a task:

```json
{
    "action": "delete",
    "target_id": "expired_batch_001"
}
```

Rules:

- After deletion, references to the deleted object are invalid.

---

## Disallowed legacy fields (v2.0)

These field names are not part of WorkSpec v2.0 and must not be used:

- `object_id` (use `target_id`)
- `revert_after` (use `temporary`)
