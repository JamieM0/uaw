---
title: "Time, dates, durations, and offsets"
description: "Reference canonical WorkSpec time values, duration values, multi-day times, and offsets."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 120
---

# Time, dates, durations, and offsets

WorkSpec resolves authored time values to logical minutes.

## Clock times

Use zero-padded `HH:MM` or `HH:MM:SS` values.

```json
{ "start": "09:30" }
```

The hour range is `00` through `23`. Seconds can produce fractional logical minutes.

## Date-time values

Use a strict RFC 3339 date-time with an explicit timezone.

```json
{ "start": "2026-09-16T09:30:00Z" }
```

Metadata fields `created_at` and `updated_at` use the same strict date-time form. `updated_at` cannot precede `created_at`.

## Multi-day times

Use a positive one-based day and a clock time.

```json
{ "start": { "day": 2, "time": "09:30" } }
```

Day `1` starts at logical minute zero. Day `2` adds 1,440 minutes.

## Durations

Durations accept three canonical forms.

| Form | Example | Meaning |
|---|---|---|
| positive integer | `30` | Uses `config.time_unit` |
| ISO 8601 | `"PT30M"` | 30 minutes |
| shorthand | `"30m"` | 30 minutes |

Shorthand units are `s`, `m`, `h`, `d`, `w`, `W`, and `M`. Uppercase `M` means 30 days.

ISO calendar units use fixed conversions. One month is 30 days, and one year is 365 days.

## Offsets

Offsets accept durations, zero, and negative duration strings. Relative timing constraints use `min_offset` and `max_offset`.

```json
{
  "relation": "offset",
  "event": "start",
  "relative_to": "@inspect.end",
  "min_offset": "5m",
  "max_offset": "30m"
}
```

`min_offset` cannot exceed `max_offset`.

