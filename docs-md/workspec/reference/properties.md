# WorkSpec 2.1 Standard Properties Reference

WorkSpec allows arbitrary custom properties under an object’s `properties` bag. This page documents commonly-used standard properties and their typical meaning.

---

## General conventions

- Type-specific properties live under `object.properties`.
- Some properties have conventional meaning for validators/simulators (not all consumers implement all semantics).
- `location` is a top-level object field (`object.location`) in WorkSpec 2.1.
- Property names must not contain `.`. Use names such as `sensor_temperature` and `quality_result_final`.
- A property must not reuse a referenceable built-in field name. Compact references always give the built-in field precedence.
- Reference a direct property with compact syntax such as `"@shipment.temperature"`; nested paths are not supported.

---

## Actor properties (common)

| Property | Type | Meaning |
|---|---|---|
| `role` | string | Job title/function |
| `skill_level` | enum | `beginner` \| `intermediate` \| `advanced` \| `expert` |
| `cost_per_hour` | number | Labor cost |
| `state` | string | Current state (available, busy, break, etc.) |
| `shift_start` | time string | Start of availability window |
| `shift_end` | time string | End of availability window |
| `overhead_rate` | number | Overhead percentage (0.0–1.0) |

---

## Equipment properties (common)

| Property | Type | Meaning |
|---|---|---|
| `state` | string | Current state (clean, dirty, in_use, maintenance, etc.) |
| `capacity` | number/integer | Throughput or concurrent capacity |
| `capacity_unit` | string | Unit for `capacity` |
| `cost_per_hour` | number | Operating cost |
| `depreciation_per_hour` | number | Depreciation rate |

---

## Resource properties (common)

| Property | Type | Meaning |
|---|---|---|
| `quantity` | number | Current stock |
| `unit` | string | Unit of measure |
| `cost_per_unit` | number | Cost per unit |
| `expiration_date` | ISO 8601 date | Optional shelf-life modeling |

---

## Product properties (common)

| Property | Type | Meaning |
|---|---|---|
| `quantity` | number | Current inventory |
| `unit` | string | Unit of measure |
| `cost_per_unit` | number | Cost per produced unit |
| `revenue_per_unit` | number | Revenue per sold unit |

---

## Service properties (standard)

| Property | Type | Meaning |
|---|---|---|
| `state` | enum | `running` \| `stopped` \| `error` |
| `interval` | duration | Execution interval |
| `last_run` | ISO 8601 date-time string | Last execution time |

---

## Digital object properties (common)

Digital objects vary; common properties include:

| Property | Type | Meaning |
|---|---|---|
| `state` | string | Operational state |
| `capacity` | number | Maximum capacity |
| `utilization` | number | 0.0–1.0 utilization |
| `ip_address` | string | Optional network address |
| `storage_gb` | number | Optional storage capacity |
| `cpu_cores` | integer | Optional compute cores |

---

## Economic properties (cross-cutting)

These properties may be used by validators and analysis tools:

| Property | Applies to | Type | Meaning |
|---|---|---|---|
| `cost_per_hour` | actors, equipment | number | Hourly labor/operating cost |
| `cost_per_unit` | resources, products | number | Per-unit cost |
| `revenue_per_unit` | products | number | Per-unit revenue |
| `fixed_cost` | any | number | One-time cost |

---

## Interaction-related properties

Some properties have conventional semantics for validators/simulators:

| Property | Typical operator | Notes |
|---|---|---|
| `quantity` | `delta` / `set` | For resources/products |
| `state` | `from/to` / `set` | For actors/equipment/services |
| `location` | `from/to` / `set` | Used by simulators that track locations |

See WorkSpec 2.1 interaction semantics: [/docs/workspec/specification/v2.1/](/docs/workspec/specification/v2.1/).

## Task interruption fields and references

| Field/reference | Type | Meaning |
|---|---|---|
| task `while` | Condition | Must be true before activation and at state-changing modeled event boundaries while active. |
| task `progress` | compact world reference | Observational value captured at completion or interruption. |
| task `continues.task` | task ID | Interrupted logical work continued by this separate task interval. |
| `@task.status` | enum | `pending`, `active`, `completed`, `skipped`, `blocked`, `interrupted`, or runtime-instance `cancelled`. |
| `@task.end` | instant | Planned end, unchanged by interruption. |
| `@task.actual_end` | instant | Successful completion or interruption time; unresolved before termination. |
| `@task.progress` | captured value | Stable termination capture; invalid if the task has no `progress` declaration. |

Progress has no implied percentage, monotonicity, zero start, or threshold. Runtime task references use compact syntax only.
