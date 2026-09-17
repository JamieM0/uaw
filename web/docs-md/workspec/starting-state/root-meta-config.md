---
title: "Root, metadata, and configuration"
description: "Reference the WorkSpec 2.2 root, schema declaration, metadata, and global configuration fields."
section: "workspec"
type: "reference"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 320
---

# Root, metadata, and configuration

The document root contains an optional `$schema` URI and one required `simulation` object.

## Root fields

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `$schema` | string | No | When present, its version suffix must match `schema_version`. |
| `simulation` | object | Yes | Contains the WorkSpec model. |

Do not put simulation fields at the document root. A flat root is a non-canonical compatibility input and fails current validation.

## Language version

Every simulation requires `simulation.schema_version` in `Major.Minor` syntax. Use `"2.2"` for new projects.

The validator accepts `2.0`, `2.1`, and `2.2`. See [historical WorkSpec versions](../compatibility/historical-versions.md) before using an older value.

## Metadata

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `meta.title` | string | Yes | Non-empty project title. |
| `meta.description` | string | Yes | Non-empty project description. |
| `meta.domain` | string | Yes | Non-empty domain name. |
| `meta.created_at` | string | No | Strict RFC 3339 date-time with timezone. |
| `meta.updated_at` | string | No | Must not precede `created_at`. |

The legacy `meta.article_title` field is not allowed. Use `meta.title`.

## Configuration

`simulation.config` is optional in WorkSpec 2.2. Omitted `time_unit` defaults to `minutes`.

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `config.time_unit` | string | No | `seconds`, `minutes`, or `hours` |
| `config.start_time` | string | No | Clock time or strict date-time |
| `config.end_time` | string | No | Clock time or strict date-time |
| `config.currency` | string | No | Three uppercase letters |
| `config.locale` | string | No | BCP 47-style locale tag |
| `config.timezone` | string | No | IANA timezone identifier |

The runtime uses `time_unit` to interpret numeric task durations and offsets.
