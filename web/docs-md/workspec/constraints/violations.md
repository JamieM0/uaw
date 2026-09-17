---
title: "Constraint violations"
description: "Reference supported Constraint return shapes and normalized violations."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Constraint violations

A Constraint returns no finding or one or more violation descriptions. The runtime normalizes each description into a stable violation shape.

## Supported return shapes

| Return value | Result |
|---|---|
| `null`, `undefined`, `true`, or `false` | No violation |
| Object | One violation |
| Array | One violation per array entry |
| `{ violations: [...] }` | One violation per nested entry |
| Other value | One violation whose message is the string value |

Boolean `false` does not create a violation. Return a violation object when a rule fails.

## Violation fields

| Field | Type | Default or behavior |
|---|---|---|
| `constraint_id` | string | Registered Constraint ID |
| `constraintId` | string | Accepted alias for `constraint_id` |
| `severity` | `error`, `warning`, or `info` | `error` |
| `time` | WorkSpec time | Selected Constraint time |
| `objects` | string array | Empty array |
| `object` | string | Converted to a one-item `objects` array |
| `property` | string | Omitted |
| `observed` | any JSON value | Omitted |
| `expected` | any JSON value | Omitted |
| `message` | string | Generated from the Constraint ID |
| `detail` | string | Used as the message when `message` is absent |

```js
return {
  severity: "warning",
  time: context.time,
  objects: ["tank"],
  property: "temperature",
  observed: 84,
  expected: { max: 80 },
  message: "Tank temperature exceeds the operating limit."
};
```

## Violations and Problems

Violations describe domain evidence. Problems describe validation, source, execution, or Constraint failures.

The Constraint runner returns `{ time, violations, problems }`. See [Problems and diagnostics](../problems.md) for the generic Problem contract.

