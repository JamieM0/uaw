---
title: "Constraints overview"
description: "Understand domain invariants over resolved WorkSpec state and history."
section: "workspec"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# Constraints overview

Constraints inspect one completed authoritative run and report domain violations. They do not change execution.

Document validation answers whether the Starting State follows WorkSpec structure and semantics. Constraints answer project-specific questions about the resolved world.

Examples include:

- inventory must not become negative;
- a measured temperature must stay within a process limit;
- a required outcome must exist by a chosen time.

## Evidence contract

A Constraint receives a read-only context. It can inspect the selected snapshot or query earlier times from the same run.

Constraint reads never rerun Changes or Generator callbacks. They also do not change runtime usage accounting.

```js
WorkSpec.constraint("inventory.non_negative", (context) => {
  const quantity = context.get("stock", "quantity");
  if (quantity >= 0) return null;

  return {
    severity: "error",
    objects: ["stock"],
    property: "quantity",
    observed: quantity,
    expected: { min: 0 },
    message: "Inventory cannot be negative."
  };
});
```

## Boundaries

Constraints do not validate JavaScript syntax, WorkSpec document shape, or runtime implementation details. Other validation layers report those problems.

Constraint violations are domain findings. They use a dedicated return contract that the runtime normalizes. Generic [Problems and diagnostics](../problems.md) describe source and runtime failures.

## Related pages

- [Authoring Constraints](authoring.md)
- [Constraint context and history queries](context.md)
- [Constraint violations](violations.md)
- [What belongs in a Constraint](boundaries.md)

