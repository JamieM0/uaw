---
title: "Conditions and boolean logic"
description: "Reference WorkSpec comparisons, boolean operators, member quantifiers, and condition evaluation."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 140
---

# Conditions and boolean logic

A condition is a boolean literal or an object with exactly one condition operator.

## Comparisons

Comparison operators take exactly two value expressions.

| Operator | Meaning |
|---|---|
| `==` | Equal values with equal types |
| `!=` | Unequal values or equal types |
| `<`, `<=`, `>`, `>=` | Ordered numbers, instants, or durations of the same type |
| `contains` | Array membership or string containment |

```json
{ ">=": ["@tank.temperature", 121] }
```

## Boolean operators

`all` and `any` require a non-empty array of conditions. `not` accepts one condition.

```json
{
  "all": [
    { "==": ["@sterilizer.state", "ready"] },
    { ">": ["@water.quantity", 0] }
  ]
}
```

Evaluation short-circuits. `all` stops at the first false condition, and `any` stops at the first true condition.

## Member quantifiers

Collection quantifiers evaluate a predicate against collection members.

| Operator | Result |
|---|---|
| `all_members` | Every member satisfies the predicate. |
| `any_members` | At least one member satisfies the predicate. |
| `no_members` | No member satisfies the predicate. |

Each quantifier uses `collection`, `as`, and `satisfy`.

## Held conditions

`held_for` tests whether a condition remains true for a duration within available run history.

```json
{
  "held_for": {
    "condition": { ">=": ["@chamber.temperature", 121] },
    "duration": "15m"
  }
}
```

The requested interval cannot extend before the available simulation history.

## Condition locations

Tasks use `when`, `requires`, and `while`. Collections use `where`.

Collection selection uses `where`, and member quantifiers use `satisfy`. Compiled Changes can attach `when` to an effect.

