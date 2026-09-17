---
title: "Collections"
description: "Reference dynamic object and location collections, predicates, aliases, and open collection boundaries."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 370
---

# Collections

A collection selects objects or locations from resolved state.

## Collection declaration

`simulation.collections` is an object keyed by a plain collection ID.

```json
{
  "collections": {
    "available_workers": {
      "from": "objects",
      "as": "worker",
      "where": { "==": ["@worker.state", "available"] }
    }
  }
}
```

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `from` | string | Yes | `objects` or `locations` |
| `as` | string | Yes | Plain alias other than `current` |
| `where` | condition | No | Evaluated with the member alias |
| `open` | boolean | No | Allows membership from later-created entities. |
| `closes_at` | time | If `open` is `true` | Valid task-start time form. |

## Membership

The runtime evaluates membership against resolved state. It sorts source entity IDs before applying a predicate.

A closed collection takes its effective membership at the applicable runtime boundary. An open collection can accept later entities until `closes_at`.

## Collection consumers

Conditions use `all_members`, `any_members`, and `no_members`. Value expressions use `count_members` and `select_member`.

Work definitions use `for_each` to create task instances when matching members appear.

## Alias scope

The `as` alias exists inside that collection's predicate. A consumer can declare its own alias for selection or instantiation.

Use `@alias.member` to reference the bound member.

