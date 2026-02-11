# Migration Guide: WorkSpec v1.0 → v2.0

WorkSpec v2.0 introduces breaking changes. This guide documents the required transformations.

---

## 1) Add schema versioning

Add:

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0"
    }
}
```

Documents without `simulation.schema_version` are treated as legacy and should be migrated.

---

## 2) Restructure into `world` and `process`

### v1.0 (legacy shape)

```json
{
    "simulation": {
        "meta": {},
        "config": {},
        "layout": {},
        "objects": [],
        "tasks": [],
        "production_recipes": {}
    }
}
```

### v2.0 (required shape)

```json
{
    "simulation": {
        "schema_version": "2.0",
        "meta": {},
        "config": {},
        "world": {
            "layout": {},
            "objects": []
        },
        "process": {
            "tasks": [],
            "recipes": {}
        }
    }
}
```

Mapping:

- `simulation.layout` → `simulation.world.layout`
- `simulation.objects` → `simulation.world.objects`
- `simulation.tasks` → `simulation.process.tasks`
- `simulation.production_recipes` → `simulation.process.recipes` (if compatible with v2 recipe schema; otherwise remove/adjust)

---

## 3) Update `meta` fields

### Rename fields

- `meta.article_title` → `meta.title`

### Required in v2.0

- `meta.title`
- `meta.description`
- `meta.domain`

If your legacy document used `industry`, rename it to `domain`.

---

## 4) Update interactions

### Replace consumes/produces

v1.0:

```json
{ "consumes": { "flour": 2 } }
```

v2.0:

```json
{
    "interactions": [
        { "target_id": "flour", "property_changes": { "quantity": { "delta": -2 } } }
    ]
}
```

v1.0:

```json
{ "produces": { "bread": 1 } }
```

v2.0:

```json
{
    "interactions": [
        { "target_id": "bread", "property_changes": { "quantity": { "delta": 1 } } }
    ]
}
```

### Replace equipment_interactions

v1.0:

```json
{
    "equipment_interactions": [
        { "id": "mixer", "from_state": "clean", "to_state": "dirty" }
    ]
}
```

v2.0:

```json
{
    "interactions": [
        {
            "target_id": "mixer",
            "property_changes": {
                "state": { "from": "clean", "to": "dirty" }
            }
        }
    ]
}
```

### Rename fields

- `object_id` → `target_id`
- `revert_after: true` → `temporary: true`

---

## 5) Task ID emojis

Legacy documents sometimes embedded emojis in task IDs. In v2.0:

- Use a plain snake_case `id`
- Put the emoji in the `emoji` field

---

## 6) Type aliases

v2.0 rejects legacy type aliases:

- `material` → use `resource`
- `ingredient` → use `resource`
- `tool` → use `equipment`

---

## 7) Document verification

After migration, verify:

- v2.0 structure exists (`world` + `process`)
- all object IDs and task IDs are valid
- interactions use `target_id`
- times are strict (`HH:MM` is zero-padded)

See:

- v2.0 validation: [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation)
- error code reference: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
