---
title: "Problems and diagnostics"
description: "Reference the generic WorkSpec Problem shape, scopes, provenance, pointers, and metric identifiers."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 150
---

# Problems and diagnostics

A Problem is a structured diagnostic from a WorkSpec document, source, runtime, or Constraint layer.

## Problem fields

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | string | Usually | Documentation URI derived from `metric_id`. |
| `title` | string | Usually | Short diagnostic title. |
| `severity` | string | Yes | `error`, `warning`, or `info`. |
| `detail` | string | Yes | Specific failure description. |
| `instance` | string | Usually | JSON Pointer or source-related location. |
| `metric_id` | string | Yes | Stable machine-facing diagnostic identifier. |
| `scope` | string | Yes for built-ins | `document`, `source`, `runtime`, or `constraint`. |
| `provenance` | object | Yes for built-ins | Layer and source that produced the Problem. |
| `context` | object | Yes for built-ins | Structured values relevant to the diagnostic. |
| `suggestions` | string array | Yes for built-ins | Possible corrective actions. |
| `doc_uri` | string | No | Documentation for the diagnostic. |

## Example

```json
{
  "type": "https://universalautomation.wiki/workspec/errors/task.integrity.invalid_duration",
  "title": "Invalid Task Duration",
  "severity": "error",
  "detail": "Task 'sterilize' has an invalid duration.",
  "instance": "/simulation/process/tasks/0/duration",
  "metric_id": "task.integrity.invalid_duration",
  "scope": "document",
  "provenance": {
    "layer": "document",
    "source": "start.workspec.json"
  },
  "context": { "task_id": "sterilize" },
  "suggestions": ["Use a positive duration such as '15m'."]
}
```

## Instance pointers

Document Problems use RFC 6901-style JSON Pointers. The root pointer is `/`.

Pointer segments escape `~` as `~0` and `/` as `~1`. Do not parse human-readable `detail` text to find a field.

## Scope and provenance

The `scope` tells you which evidence can support the diagnostic. The `provenance` identifies the producing layer and source.

A `document` Problem concerns `start.workspec.json`. A `runtime` Problem concerns resolved execution or history.

A `source` Problem concerns executable source compilation or analysis. A `constraint` Problem concerns Constraint execution infrastructure.

## Metric ID stability

Use `metric_id` for automation. Treat titles, details, context fields, and suggestions as explanatory data that can evolve.

Constraint violations are domain results, not generic Problems. Constraint documentation owns their return shape and reporting conversion.

CLI documentation owns output envelopes, exit codes, and warning policies.

