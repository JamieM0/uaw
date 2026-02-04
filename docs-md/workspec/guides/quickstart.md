# WorkSpec v2.0 Quickstart (5 minutes)

Create a minimal valid WorkSpec v2.0 document, validate it, and iterate.

---

## Step 1: Start from the minimal skeleton

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0",
        "meta": {
            "title": "Hello WorkSpec",
            "description": "A minimal example simulation",
            "domain": "Example"
        },
        "config": {
            "time_unit": "minutes",
            "start_time": "09:00",
            "end_time": "12:00",
            "currency": "USD",
            "locale": "en-US"
        },
        "world": {
            "layout": {
                "locations": [
                    { "id": "work_area", "name": "Work Area" }
                ]
            },
            "objects": [
                { "id": "worker", "type": "actor", "name": "Worker", "location": "work_area", "properties": { "state": "available" } },
                { "id": "tool", "type": "equipment", "name": "Tool", "location": "work_area", "properties": { "state": "ready" } },
                { "id": "input", "type": "resource", "name": "Input", "location": "work_area", "properties": { "quantity": 10, "unit": "units" } },
                { "id": "output", "type": "product", "name": "Output", "location": "work_area", "properties": { "quantity": 0, "unit": "units" } }
            ]
        },
        "process": {
            "tasks": [
                {
                    "id": "do_work",
                    "actor_id": "worker",
                    "start": "09:00",
                    "duration": 30,
                    "location": "work_area",
                    "interactions": [
                        { "target_id": "input", "property_changes": { "quantity": { "delta": -2 } } },
                        { "target_id": "output", "property_changes": { "quantity": { "delta": 1 } } },
                        { "target_id": "tool", "property_changes": { "state": { "from": "ready", "to": "in_use" } }, "temporary": true }
                    ]
                }
            ]
        }
    }
}
```

---

## Step 2: Learn the three core concepts

1) **World vs process**
- Static things in `simulation.world` (layout + objects)
- Dynamic things in `simulation.process` (tasks + recipes)

2) **Objects**
- Define entities once under `simulation.world.objects`
- Keep type-specific fields in `properties`

3) **Interactions**
- Tasks change objects via `interactions`
- Use `target_id` (not legacy `object_id`)

---

## Next steps

- Object model: [/docs/workspec/specification/v2.0/objects](/docs/workspec/specification/v2.0/objects)
- Task model: [/docs/workspec/specification/v2.0/tasks](/docs/workspec/specification/v2.0/tasks)
- Interaction system: [/docs/workspec/specification/v2.0/interactions](/docs/workspec/specification/v2.0/interactions)
- Cheatsheet: [/docs/workspec/cheatsheet](/docs/workspec/cheatsheet)
