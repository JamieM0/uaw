# WorkSpec v2.0 Cookbook (Common Patterns)

This cookbook shows common patterns for modeling work activities with WorkSpec v2.0.

---

## Pattern: Consume a resource and produce a product

```json
{
    "id": "make_item",
    "actor_id": "worker",
    "start": "09:00",
    "duration": "30m",
    "interactions": [
        { "target_id": "input", "property_changes": { "quantity": { "delta": -2 } } },
        { "target_id": "output", "property_changes": { "quantity": { "delta": 1 } } }
    ]
}
```

---

## Pattern: Equipment state transition

```json
{
    "id": "use_machine",
    "actor_id": "operator",
    "start": "10:00",
    "duration": 15,
    "interactions": [
        {
            "target_id": "machine",
            "property_changes": {
                "state": { "from": "available", "to": "in_use" }
            },
            "temporary": true
        }
    ]
}
```

---

## Pattern: OR-dependency (`depends_on.any`)

```json
{
    "id": "ship_order",
    "actor_id": "worker",
    "start": "11:00",
    "duration": 10,
    "depends_on": { "any": ["auto_approval", "manager_approval"] }
}
```

---

## Pattern: Multi-day start

```json
{
    "id": "day_2_task",
    "actor_id": "worker",
    "start": { "day": 2, "time": "09:30" },
    "duration": "1h"
}
```

---

## Pattern: Create and delete objects (lifecycle)

Create:

```json
{
    "action": "create",
    "object": { "id": "batch_001", "type": "product", "name": "Batch #001" }
}
```

Delete:

```json
{
    "action": "delete",
    "target_id": "batch_001"
}
```

---

## Pattern: Recipe compliance warnings

Define a recipe:

```json
{
    "process": {
        "recipes": {
            "bread_loaf": {
                "inputs": { "flour": 0.5, "water": 0.3, "yeast": 0.01 }
            }
        }
    }
}
```

If a task produces `bread_loaf` but does not consume all required inputs in the same task, recipe validation may produce a **warning**.

---

## Pattern: Use a `service` performer

```json
{
    "id": "service:timer",
    "type": "service",
    "name": "Timer Service",
    "properties": { "state": "running", "interval": "5m" }
}
```

```json
{
    "id": "proof_dough",
    "actor_id": "service:timer",
    "start": "06:35",
    "duration": "1h"
}
```

