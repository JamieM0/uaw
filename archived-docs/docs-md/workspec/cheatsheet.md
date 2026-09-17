# WorkSpec 2 Cheatsheet

Use this after the [WorkSpec 2 Authoring Guide](/docs/workspec/guides/authoring).

## Mental model

```text
Starting State    what exists initially
Changes           explicit things that happen
Constraints       things that must remain true
Generator         optional computational behaviour
Simulation        the resolved observable history
```

## Project files

| File | Contains |
| --- | --- |
| `start.workspec.json` | Declarative `world` and `process` data |
| `changes.workspec.js` | Task-linked `set`, `change`, `move`, `create`, and `remove` calls |
| `constraints.workspec.js` | Rules over resolved history and their violation evidence |
| `generator.workspec.js` | Optional `onStart` and per-minute `onUpdate` behaviour |

## Minimal Starting State

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": { "title": "Pack a kit", "description": "One small change", "domain": "Training" },
    "config": { "time_unit": "minutes", "start_time": "09:00" },
    "world": {
      "layout": { "locations": [{ "id": "bench", "name": "Bench" }] },
      "objects": [
        { "id": "parts", "type": "resource", "name": "Parts", "location": "bench", "properties": { "quantity": 2 } },
        { "id": "kits", "type": "product", "name": "Kits", "location": "bench", "properties": { "quantity": 0 } }
      ]
    },
    "process": {
      "tasks": [{ "id": "pack", "start": "09:00", "duration": "10m", "location": "bench" }]
    }
  }
}
```

## Explicit Change

```javascript
WorkSpec.task("pack").onComplete(() => {
  change("parts", "quantity", -1);
  change("kits", "quantity", 1);
});
```

Use `{ temporary: true }` for a write that should revert when its task ends.

## Constraint

```javascript
module.exports = {
  "inventory.non_negative": ctx => {
    for (const time of ctx.times()) {
      const quantity = ctx.getAt(time, "parts", "quantity");
      if (quantity < 0) return {
        time,
        objects: ["parts"],
        property: "quantity",
        observed: quantity,
        expected: { min: 0 },
        message: "Parts must never become negative."
      };
    }
    return null;
  }
};
```

Useful context calls: `times()`, `get()`, `getAt()`, `state()`, and `stateAt()`.

## Optional Generator

```javascript
WorkSpec.onUpdate(({ get, set }) => {
  set("sensor", "reading", get("sensor", "reading") + 1);
});
```

Use a Generator only for computed or simulated behaviour. Put known task effects
in Changes.

## Studio flow

```text
edit sources → Validate WorkSpec → Simulate → scrub time → inspect Problems
```

Selecting a runtime Constraint violation in **Problems** moves playback to its
evidence time and highlights an affected object when that surface is available.

## Historical syntax

Task `interactions` belong to WorkSpec 2.0/2.1 documents. They are not valid in
WorkSpec 2 Starting State.
