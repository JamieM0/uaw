# WorkSpec v2.0 Changelog

This page tracks WorkSpec v2.0 changes and the breaking changes relative to legacy v1.0 documents.

---

## 2.0 (Final Draft)

Last updated in the v2.0 specification: `2026-02-03`.

### Breaking changes

- Added required `simulation.schema_version` (Major.Minor format, v2.0 is `"2.0"`).
- Restructured document into `simulation.world` and `simulation.process`.
- Updated meta fields:
  - `meta.title` (required)
  - `meta.description` (required)
  - `meta.domain` (required)
  - removed `meta.article_title`
- Standardized object shape with top-level fields (`id`, `type`, `name`, `emoji`, `location`, `properties`).
- Added namespaced IDs (`{type}:{identifier}`) with namespace/type validation.
- Removed type aliases (`material`, `ingredient`, `tool`).
- Added `service` object type (performer).
- Added custom type definitions (`simulation.type_definitions` with `extends`).
- Expanded task model:
  - `depends_on` supports `{all, any}`
  - `duration` supports integer, ISO 8601, and shorthand
  - `start` supports `{day,time}` for multi-day simulations
- Expanded interaction model:
  - `target_id` replaces legacy `object_id`
  - `temporary` replaces legacy `revert_after`
  - new operators: `append`, `remove`, `increment`, `decrement`
  - new actions: `create`, `delete`
- Validation and errors use RFC 7807 Problem Details format with WorkSpec extensions.

### Migration

See [/docs/workspec/guides/migration](/docs/workspec/guides/migration).
