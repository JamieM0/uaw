# AI Authoring Guide for WorkSpec v2.0

This guide is for AI systems (and humans using AI) generating WorkSpec v2.0 documents.

---

## Output contract (recommended)

When generating WorkSpec:

1. Output **valid JSON only**.
2. Always include:
   - `$schema: "https://universalautomation.wiki/workspec/v2.0.schema.json"`
   - `simulation.schema_version: "2.0"`
   - `simulation.meta.title`, `simulation.meta.description`, `simulation.meta.domain`
   - `simulation.world.objects[]`
   - `simulation.process.tasks[]`
3. Use strict, predictable IDs:
   - snake_case
   - no spaces
   - max 250 chars
4. Put all type-specific object data in `properties`.
5. Use `target_id` in interactions (never legacy `object_id`).

---

## Common failure modes to avoid

### Missing schema version

Bad:

```json
{ "simulation": { "meta": {} } }
```

Good:

```json
{ "simulation": { "schema_version": "2.0", "meta": { "title": "...", "description": "...", "domain": "..." }, "config": {}, "world": { "objects": [] }, "process": { "tasks": [] } } }
```

### Incorrect structure (v1.0 shape)

Bad:

```json
{ "simulation": { "objects": [], "tasks": [] } }
```

Good:

```json
{ "simulation": { "world": { "objects": [] }, "process": { "tasks": [] } } }
```

### Legacy interaction fields

Bad:

```json
{ "object_id": "mixer", "property_changes": { "state": { "to": "dirty" } } }
```

Good:

```json
{ "target_id": "mixer", "property_changes": { "state": { "to": "dirty" } } }
```

---

## Modeling tips

- Prefer **short tasks** with explicit dependencies over overly long tasks.
- Use `depends_on` operators (`all`/`any`) to express real gating conditions.
- Prefer explicit `state` transitions with `from`/`to` when modeling equipment or actor states.
- When modeling consumption/production, use `quantity.delta` interactions.

---

## Validation-first generation

Before finalizing output, ensure:

- All referenced `actor_id`s exist and are performer types.
- All `target_id`s exist (or are created before use).
- All time strings are strict (`"09:30"`, not `"9:30"`).
- Duration strings are valid (integer, ISO 8601, or shorthand).

Error format details: [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation)  
Error code catalog: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
