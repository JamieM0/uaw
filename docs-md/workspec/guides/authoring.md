# WorkSpec 2.2 Authoring Guide

WorkSpec 2.2 separates **what the world is** from **what happens**, **what must
remain true**, and **optional computed behaviour**. A project is four files;
playback resolves them into one observable history.

## The mental model

```text
Starting State    what exists initially
Changes           explicit things that happen
Constraints       things that must remain true
Generator         optional code that decides/simulates what happens
Simulation        the resolved observable history you play back
```

Starting State, Changes, and Constraints are the main authoring surfaces. The
Generator is optional and advanced: a project with only Starting State and
Changes is complete. The simulation is produced by the runtime, never authored
by hand.

New to WorkSpec? Complete the [WorkSpec 2.2 Quickstart](/docs/workspec/guides/quickstart)
and the guided tutorial available from **Start Tutorial** in
[WorkSpec Studio](/playground) first.

## Starting State: what exists initially

`start.workspec.json` is declarative JSON: locations, objects, people,
equipment, stocks, the planned task schedule, capacities, and dependencies. It
contains no executable effects. Tasks may pin an exact `start` time or derive
their timing from `depends_on`.

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": {
      "title": "Morning Bake",
      "description": "Mix and bake one batch of dough.",
      "domain": "Food Production"
    },
    "config": { "time_unit": "minutes", "start_time": "07:00" },
    "world": {
      "layout": { "locations": [{ "id": "bakery", "name": "Bakery" }] },
      "objects": [
        { "id": "baker", "type": "actor", "name": "Baker", "location": "bakery", "properties": { "state": "available" } },
        { "id": "flour", "type": "resource", "name": "Flour", "location": "bakery", "properties": { "quantity": 10, "unit": "kg" } },
        { "id": "dough", "type": "product", "name": "Dough", "location": "bakery", "properties": { "state": "absent", "quantity": 0 } }
      ]
    },
    "process": {
      "tasks": [
        { "id": "mix_dough", "actor_id": "baker", "start": "07:00", "duration": "20m", "location": "bakery" },
        { "id": "bake_batch", "actor_id": "baker", "duration": "45m", "location": "bakery", "depends_on": ["mix_dough"] }
      ]
    }
  }
}
```

## Changes: explicit things that happen

`changes.workspec.js` registers authored effects for tasks. Inside handlers,
`set`, `change`, and `move` write observable state. A temporary write reverts
when its task ends.

```javascript
WorkSpec.task("mix_dough", task => {
  task.onStart(() => set("baker", "state", "working", { temporary: true }));
  task.onComplete(() => {
    change("flour", "quantity", -2);
    change("dough", "quantity", 1);
    set("dough", "state", "mixed");
  });
});
```

## Constraints: things that must remain true

`constraints.workspec.js` inspects the resolved history—not Changes or Generator
source—through the constraint context. A constraint returns `null` when
satisfied, or a structured violation with a time and affected objects so Studio
can show the evidence and jump to it.

```javascript
module.exports = {
  "flow.flour_never_negative": ctx => {
    for (const time of ctx.times()) {
      const quantity = ctx.getAt(time, "flour", "quantity");
      if (quantity < 0) return {
        time,
        objects: ["flour"],
        property: "quantity",
        observed: quantity,
        expected: { min: 0 },
        message: "Flour stock can never go negative."
      };
    }
    return null;
  }
};
```

## Generator: optional simulated behaviour

`generator.workspec.js` is optional computational logic. `onStart` runs once
when execution starts; `onUpdate` runs once per whole simulation minute.
Randomness comes from the seeded `random()` helper, so the same sources and seed
produce the same history. Generator writes enter the same observable history as
Changes.

```javascript
WorkSpec.onUpdate(({ get, set }) => {
  if (get("oven", "state") === "heating") {
    set("oven", "temperature_c", get("oven", "temperature_c") + 4);
  }
});
```

## Simulation: the resolved observable history

Playback resolves Starting State + Changes (+ Generator) into a deterministic
movie of the world. Scrubbing to a time shows exactly what is true at that
moment: object states, quantities, locations, and active work. Studio's Simulate,
Physical, and Problems views inspect this same resolved history.

```text
workspec validate start.workspec.json --json

workspec snapshot start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --time 08:30 --seed 17 --json

workspec constraints start.workspec.json \
  --changes changes.workspec.js \
  --generator generator.workspec.js \
  --constraints constraints.workspec.js \
  --time 08:30 --seed 17 --json --yes
```

## Older WorkSpec documents

WorkSpec 2.0 and 2.1 placed executable effects in task `interactions`. That
syntax remains documented for historical documents, but it is not the WorkSpec
2.2 authoring model and must not be placed in 2.2 Starting State.

## Where to go next

- [WorkSpec Studio Guide](/docs/playground/playground-guide)
- [WorkSpec 2.2 Quickstart](/docs/workspec/guides/quickstart)
- [WorkSpec 2.2 cheatsheet](/docs/workspec/cheatsheet)
- [AI authoring guide](/docs/workspec/guides/ai-generation)
- [Types, properties, and errors reference](/docs/workspec/reference/types)
