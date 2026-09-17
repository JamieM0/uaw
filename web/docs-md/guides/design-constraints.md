---
title: "Design useful Constraints"
description: "Create a small set of domain invariants that tests resolved evidence without copying implementation."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
related:
  - /docs/workspec/constraints/overview/
  - /docs/workspec/constraints/context/
---

# Design useful Constraints

Use Constraints to express domain truth that structural validation cannot decide.

## Begin with plain-language invariants

Write each invariant before you write JavaScript. Use a statement that a domain owner can accept or reject.

Good invariants include:

- Inventory never becomes negative.
- Only a qualified chemist performs synthesis.
- Released output conserves the declared material balance.
- Maintenance never overlaps customer service on the same machine.

Avoid statements about handler names, source lines, or implementation literals. Constraints inspect resolved evidence, not Changes or Generator source.

## Choose evidence and time

For each invariant, identify the minimum evidence that proves or disproves it.

| Invariant type | Useful evidence |
|---|---|
| Final balance | `get()` at the selected time |
| Safety throughout a run | `times()` with `getAt()` |
| Assignment policy | task runtime or reservation data from `stateAt()` |
| Ordering | task status and timing from historical snapshots |

The [Constraint context reference](/docs/workspec/constraints/context/) defines the available read-only queries.

## Return useful evidence

A violation must help a reader act. Include a stable Constraint ID and a precise message. Add the relevant time, object, property, observed value, and expected value when available.

Use `error` for broken domain truth that must fail the run review. Use `warning` for a risky or inferred policy. Use `info` for an observation that does not make the world invalid.

See [Constraint violations](/docs/workspec/constraints/violations/) for accepted return shapes.

## Keep the set small

Prefer independent, high-value rules over a large mirror of the implementation. Start with safety, conservation, qualification, ordering, and capacity.

One healthy run does not establish completeness. Challenge the model with plausible semantic mutations:

1. Reduce critical stock.
2. Remove or reverse an ordering relationship.
3. Assign work to an unqualified performer.
4. Reduce equipment capacity.
5. Change a material-consumption effect while preserving output.

A useful Constraint passes healthy models and rejects the damaged world for the intended reason.

## Review the boundary

Do not use a Constraint to validate JSON shape, compile source, control execution, or prescribe a Changes implementation. The [Constraint boundary](/docs/workspec/constraints/boundaries/) explains where those concerns belong.
