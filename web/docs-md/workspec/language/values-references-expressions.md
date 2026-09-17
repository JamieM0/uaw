---
title: "Values, references, and expressions"
description: "Reference literals, compact references, arithmetic, collection expressions, and allowed expression locations."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 130
---

# Values, references, and expressions

A value expression produces a literal value, referenced value, or derived value.

## Literals

JSON strings, numbers, booleans, arrays, objects, and `null` can be literal values.

A string beginning with `@` starts a compact reference. Add a second `@` to author a literal string that begins with `@`.

```json
{
  "literal_email": "@@operator",
  "resolved_literal": "@operator"
}
```

The resolved value of `"@@operator"` is the literal string `"@operator"`.

## Compact references

Use `@entity.member` for an object, location, task, or bound collection member.

```json
"@shipment.temperature"
```

A compact reference contains exactly one dot. Nested property paths are not supported.

Use `@now` for the current logical time. Do not add a member to `@now`.

## Entity members

Object and location references can read built-in fields or direct properties. Task references can read supported task fields.

Task fields include `start`, `end`, `duration`, `actor_id`, `status`, `actual_end`, and `progress` when available.

## Arithmetic

Arithmetic expressions contain one operator key.

```json
{ "+": ["@stock.quantity", 5] }
```

Supported operators are `+`, `-`, `*`, `/`, `min`, and `max`. Operands must resolve to finite numbers.

## Count collection members

Use `count_members` to count members that match an optional predicate.

```json
{
  "count_members": {
    "collection": "available_workers",
    "as": "worker",
    "where": { "==": ["@worker.state", "available"] }
  }
}
```

## Select a collection member

Use `select_member` when an expression must return one deterministic member ID.

```json
{
  "select_member": {
    "collection": "available_workers",
    "as": "worker",
    "policy": "lowest",
    "by": "@worker.queue_length",
    "tie_break": "stable_id"
  }
}
```

Policies are `first_by_id`, `lowest`, and `highest`. The last two require `by`.

Declare `tie_break: "stable_id"` when equal ranking values are possible.

## Expression locations

Canonical expression consumers include task guards, performer selection, reservations, collections, timing references, and work-definition templates.

Changes and Generator operations also evaluate expressions after source compilation. A consumer can impose a narrower type or reference requirement.

## Compatibility references

Structured references remain accepted for compatibility. Do not use them for new authoring.

See [compatibility-only fields and syntax](../compatibility/legacy-syntax.md) for their exact forms.

