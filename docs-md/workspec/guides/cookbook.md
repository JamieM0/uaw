# WorkSpec 2.2 Cookbook

Common authoring patterns for the frozen WorkSpec 2.2 model. See the
[Authoring Guide](/docs/workspec/guides/authoring) for the concepts behind them.

## Consume a resource and produce a product

Starting State schedules the task; Changes owns its effects.

```javascript
WorkSpec.task("make_item").onComplete(() => {
  change("input", "quantity", -2);
  change("output", "quantity", 1);
});
```

## Change equipment only while a task runs

```javascript
WorkSpec.task("use_machine").onStart(() => {
  set("machine", "state", "in_use", { temporary: true });
});
```

The temporary write reverts when the task completes.

## Order tasks with a dependency

```json
{
  "id": "ship_order",
  "actor_id": "worker",
  "duration": "10m",
  "depends_on": ["approve_order"]
}
```

Omit `start` when a task should begin as soon as its dependency completes.

## Move an object

```javascript
WorkSpec.task("deliver_order").onComplete(() => {
  move("parcel", "dispatch_bay");
});
```

## Create and remove objects

```javascript
WorkSpec.task("open_case").onComplete(() => {
  create({ id: "case_001", type: "product", name: "Case 001", properties: { state: "open" } });
});

WorkSpec.task("close_case").onComplete(() => {
  remove("case_001");
});
```

## Check a quantity throughout the run

```javascript
module.exports = {
  "inventory.non_negative": ctx => {
    for (const time of ctx.times()) {
      const quantity = ctx.getAt(time, "input", "quantity");
      if (quantity < 0) return {
        time,
        objects: ["input"],
        property: "quantity",
        observed: quantity,
        expected: { min: 0 },
        message: "Input stock must not be negative."
      };
    }
    return null;
  }
};
```

## Add optional computed behaviour

```javascript
WorkSpec.onUpdate(({ get, set }) => {
  if (get("oven", "state") === "heating") {
    set("oven", "temperature_c", get("oven", "temperature_c") + 4);
  }
});
```

Use Generator for simulated computation. Use Changes when the effect is a known
part of a task.

## Historical pattern warning

WorkSpec 2.0/2.1 placed these effects in task `interactions`. Do not copy that
syntax into 2.2 Starting State.
