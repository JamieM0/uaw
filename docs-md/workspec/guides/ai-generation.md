# AI Authoring Guide for WorkSpec 2.2

This guide is for AI systems, and humans using AI, that generate WorkSpec 2.2
projects. The [Authoring Guide](/docs/workspec/guides/authoring) remains the
canonical conceptual reference.

## Output contract

Generate separate project sources:

- `start.workspec.json`: declarative Starting State with schema version `2.2`;
- `changes.workspec.js`: known, explicit task effects;
- `constraints.workspec.js`: rules over the resolved simulation;
- `generator.workspec.js`: optional computed or simulated behaviour only.

Do not put task `interactions`, executable effects, recipes, or state libraries
inside 2.2 Starting State. Do not invent a Generator when Changes are enough.

## Starting State requirements

Include `$schema`, `simulation.schema_version`, complete `meta`, `world`, and
`process`. Use stable snake_case IDs. Keep object properties under `properties`,
while `location` remains a top-level object field.

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": { "title": "...", "description": "...", "domain": "..." },
    "config": { "time_unit": "minutes", "start_time": "08:00" },
    "world": { "layout": { "locations": [] }, "objects": [] },
    "process": { "tasks": [] }
  }
}
```

## Author explicit effects in Changes

```javascript
WorkSpec.task("mix_dough", task => {
  task.onStart(() => set("mixer", "state", "running", { temporary: true }));
  task.onComplete(() => {
    change("flour", "quantity", -2);
    set("dough", "state", "mixed");
  });
});
```

The available helpers are `set`, `change`, `move`, `create`, and `remove`.

## Generate useful Constraint evidence

A failing Constraint should return a clear message plus the failure `time`,
affected `objects`, `property`, `observed`, and `expected` values whenever those
fields apply. Return `null` when the rule is satisfied.

Constraints read resolved state through `times()`, `get()`, `getAt()`, `state()`,
and `stateAt()`. They do not read or rewrite authoring source.

## Validate generated projects

1. Validate Starting State with the canonical validator.
2. Run a snapshot with Changes and, if present, Generator.
3. Run Constraints against the same resolved history.
4. Reject output with source/runtime errors or unintended violations.

Use strict times such as `"09:30"`, self-describing durations such as `"20m"`,
valid performer and object references, and seeded `random()` instead of
`Math.random()` in Generator code.
