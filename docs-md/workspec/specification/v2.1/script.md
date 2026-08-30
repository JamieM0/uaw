# WorkSpec 2.1 Script

WorkSpec 2.1 separates declarative process data from executable behaviour:

- **Define** describes the world, tasks, timing, dependencies, and other declarative facts.
- **Script** is normal JavaScript that registers task behaviour.

Behaviour belongs in Script. Do not add `interactions` or `methods` to Define, and do not recreate a declarative interaction system inside JavaScript objects.

## Task handlers

`WorkSpec.task(id)` refers to a task whose ID is declared in Define. It returns a reusable task handle. A handler registered on that handle runs for the corresponding task phase.

For one handler, prefer the direct chained form:

```js
WorkSpec.task("clean_equipment").onComplete(() => {
    set("mixer", "state", "clean");
});
```

For several handlers that belong together, prefer the grouped form. The callback receives the same handle returned by `WorkSpec.task(id)`; it is convenience syntax, not a separate task system.

```js
WorkSpec.task("mix_dough", task => {
    task.onStart(() => {
        set("baker", "state", "working", { temporary: true });
        set("mixer", "state", "in_use", { temporary: true });
    });

    task.onComplete(() => {
        change("flour", "quantity", -3);
        change("mixed_dough", "quantity", 1);
        set("mixer", "state", "dirty");
    });
});
```

Store the task handle when reuse across separate sections genuinely improves readability:

```js
const mixDough = WorkSpec.task("mix_dough");

mixDough.onStart(() => {
    set("mixer", "state", "in_use", { temporary: true });
});

mixDough.onComplete(() => {
    set("mixer", "state", "dirty");
});
```

All three forms use the same task-handle API.

## Runtime helpers

These WorkSpec Script helpers are automatically available while a task handler runs:

```js
set(targetId, property, value, options)
change(targetId, property, amount, options)
move(targetId, locationId, options)
create(object)
remove(targetId)
```

They always resolve against the currently executing WorkSpec handler. `{ temporary: true }` makes a start effect last only for the task's active interval.

Handlers do not need a callback parameter. Accept context only when the handler uses context information:

```js
WorkSpec.task("mix_dough").onStart(context => {
    console.log(context.taskId, context.phase);
    set("mixer", "state", "in_use");
});
```

Existing destructured helper callbacks remain compatible, but ambient helpers are the canonical 2.1 style.

## Normal JavaScript

Script is executable JavaScript, not a declarative language. Arbitrary JavaScript remains valid inside handlers. Use ordinary functions when behaviour is genuinely reusable:

```js
function consumeIngredient(id, amount) {
    change(id, "quantity", -amount);
}

WorkSpec.task("mix_dough").onComplete(() => {
    consumeIngredient("flour", 3);
    consumeIngredient("water", 2);
});
```

Keep behaviour for one task together where practical. Keep simple effects simple rather than wrapping one-line changes in unnecessary abstractions. When logic becomes complex, prefer clear executable JavaScript over objects that imitate the removed `interactions` model.

Studio statically indexes literal task IDs and the three standard authoring forms for navigation and diagnostics. Dynamic constructs are valid JavaScript, but when Studio cannot safely resolve one it leaves resolution to the authoritative runtime instead of guessing.
