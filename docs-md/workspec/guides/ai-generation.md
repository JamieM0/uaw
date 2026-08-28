# AI Authoring Guide for WorkSpec 2.1

This guide is for AI systems and humans generating WorkSpec 2.1 documents.

---

## Output contract (recommended)

When generating WorkSpec:

1. Output **valid JSON only**.
2. Always include:
   - `$schema: "https://universalautomation.wiki/workspec/v2.1.schema.json"`
   - `simulation.schema_version: "2.1"`
   - `simulation.meta.title`, `simulation.meta.description`, `simulation.meta.domain`
   - `simulation.world.objects[]`
   - `simulation.process.tasks[]`
3. Use strict, predictable IDs:
   - snake_case
   - no spaces
   - max 250 chars
4. Put all type-specific object data in `properties`.
5. Use `target_id` in interactions (never legacy `object_id`).
6. Always generate compact references: `"@entity.member"`, `"@current.member"`, or `"@now"`.
7. Use symbolic comparisons (`==`, `!=`, `<`, `<=`, `>`, `>=`) with strict types.
8. Use `@@` when a literal ValueExpression string must begin with `@`.
9. Never generate dotted property names, nested reference paths, or structured selector references.
10. When runtime cardinality is unknown, define a live collection and `process.work_definitions`; never enumerate representative placeholder tasks.
11. Quantify unknown populations with `all_members`, `any_members`, `no_members`, or `count_members`, each with an explicit local alias.
12. Use `select_member` with a declared deterministic policy. For `lowest` or `highest`, add `tie_break: "stable_id"` when equal ranked values are possible.
13. Interrupt active work through `while` before assigning a separate continuation. Never mutate the active interval's actor.
14. Use `+`, `-`, `*`, `/`, `min`, or `max` when a numeric relation belongs in the model; do not copy a derived literal.
15. Never claim WorkSpec globally optimizes a schedule or assignment.
16. Do not invent continuous physical evolution, unbounded external arrival, stochastic/Monte Carlo behavior, or external transaction/IAM/device guarantees; these are frozen 2.1 limitations.

---

## Common failure modes to avoid

### Missing schema version

Bad:

```json
{ "simulation": { "meta": {} } }
```

Good:

```json
{ "simulation": { "schema_version": "2.1", "meta": { "title": "...", "description": "...", "domain": "..." }, "config": {}, "world": { "objects": [] }, "process": { "tasks": [] } } }
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

- Prefer **short tasks** with explicit dependencies when they are genuinely distinct authored work. Do not fake interruption by pre-segmenting one continuous task into arbitrary time slices.
- Use `depends_on` operators (`all`/`any`) to express real gating conditions.
- Prefer explicit `state` transitions with `from`/`to` when modeling equipment or actor states.
- When modeling consumption/production, use `quantity.delta` interactions.
- Use `when` for optional execution, `requires` for mandatory start permission, and `while` for an invariant that can interrupt active work at modeled event boundaries.
- For real interruption, declare observational `progress`, branch recovery with `@task.status`, and time it from `@task.actual_end`. Use `continues` only when a new task interval continues an interrupted task; never reactivate the original.
- Do not infer progress from duration or elapsed time. Do not invent percentages, zero starts, monotonicity, thresholds, rollback, or retained reservations.
- An interrupted task keeps committed permanent effects, skips normal completion effects, restores temporary effects, and releases reservations. Recovery acquires its own reservations.
- Permanent effects default to completion; write `at: "start"` when an effect must happen at task start.
- Use task `timing` to validate relative windows and `reservations` for exclusive or capacity use.
- References are compact strings such as `"@shipment.state"`, `"@inspect.end"`, and `"@now"`. Resolve only direct members; never invent a nested path.
- A normal ValueExpression string such as `"approved"` is literal. To author the literal string `"@shipment.state"`, write `"@@shipment.state"`.
- Property names must not contain `.` and must not shadow built-in referenceable fields. Prefer names such as `sensor_temperature` and `quality_result_final`.
- A local collection alias such as `@candidate.load` or `@file.valid` is valid only inside the collection predicate, selection, or runtime work template that declares it. `@current` always remains the current performer.
- For streaming populations, set `open: true` and declare a finite `closes_at` boundary.
- Selection does not wait for a resource or try alternate schedules. If the resolved actor/resource conflicts at start, validation/runtime reports it.

---

## Validation-first generation

Before finalizing output, ensure:

- All referenced `actor_id`s exist and are performer types.
- All `target_id`s exist (or are created before use).
- All time strings are strict (`"09:30"`, not `"9:30"`).
- Duration strings are valid (integer, ISO 8601, or shorthand).

Current language: [/docs/workspec/specification/v2.1/](/docs/workspec/specification/v2.1/)
Error code catalog: [/docs/workspec/reference/errors](/docs/workspec/reference/errors)
