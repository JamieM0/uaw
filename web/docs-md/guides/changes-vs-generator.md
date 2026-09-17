---
title: "Choose Changes or Generator"
description: "Choose predetermined task effects or causal simulation behavior without mixing their roles."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 20
related:
  - /docs/workspec/changes/boundaries/
  - /docs/workspec/generators/overview/
---

# Choose Changes or Generator

Choose the source from the information that determines the behavior.

## Use the decision test

Ask: **Can the author predetermine this exact effect and attach it to a task phase?**

- If yes, use Changes.
- If no, ask whether evolving state, time, or seeded randomness determines the behavior.
- If yes, use Generator logic.
- If neither applies, the behavior might belong in Starting State or a Constraint.

| Need | Owner |
|---|---|
| Set a machine to `busy` while a task runs | Changes |
| Consume a fixed quantity when a task completes | Changes |
| Update temperature each minute from current temperature | Generator |
| Create an arrival when a causal rule fires | Generator |
| Declare a task template for new collection members | Starting State work definition |
| Decide whether the resolved world is acceptable | Constraint |

## Preserve the Changes boundary

Changes are explicit, predetermined effects on a task timeline. A Changes handler does not read world state or current time.

Do not use Changes as a small simulation. If an effect needs a feedback loop, move that causal behavior to Generator logic.

The [Changes boundary reference](/docs/workspec/changes/boundaries/) owns this contract. The [Change operations reference](/docs/workspec/changes/operations/) owns exact operation behavior.

## Preserve the Generator boundary

Generator logic can read and change world state. It runs at defined points in the authoritative execution.

Generator logic does not own task creation. To create work from changing state, declare a collection and work definition. Generator logic can change membership, and the runtime can then instantiate declared work.

See [Generator and dynamic work](/docs/workspec/generators/dynamic-work-relationship/) for that indirect relationship.

## Check the choice

Use these review questions:

- Can a reader find every predetermined effect beside its task lifecycle?
- Does every causal rule use Generator state instead of hidden task effects?
- Do work definitions, rather than JavaScript calls, define dynamic task templates?
- Do Constraints describe domain truth instead of controlling execution?

If one behavior seems to need both sources, divide it by responsibility. Keep the known task effect in Changes. Keep the state-driven response in Generator logic.
