---
title: "Starting State field index"
description: "Find the owning reference page for each canonical WorkSpec 2.2 Starting State field group."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 490
generated_sections:
  - field_table
---

# Starting State field index

This generated reference maps canonical Starting State fields to one owning page.

The source inventory is `_data/workspec-language-surface.json`. Compatibility-only entries do not appear as canonical alternatives in this index.

## Root and metadata

| Field | Owner |
|---|---|
| `$schema` | [Root, metadata, and configuration](./root-meta-config.md) |
| `simulation` | [Starting State overview](./overview.md) |
| `simulation.schema_version` | [Root, metadata, and configuration](./root-meta-config.md) |
| `simulation.meta` and its fields | [Root, metadata, and configuration](./root-meta-config.md) |
| `simulation.config` and its fields | [Root, metadata, and configuration](./root-meta-config.md) |

## World

| Field | Owner |
|---|---|
| `simulation.world` | [Starting State overview](./overview.md) |
| `simulation.world.objects` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].id` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].type` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].name` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].properties` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].location` | [Objects and properties](./objects.md) |
| `simulation.world.objects[].state_library` | [State Libraries and appearance](./state-libraries.md) |
| `simulation.world.objects[].appearance` | [State Libraries and appearance](./state-libraries.md) |
| `simulation.world.objects[].emoji` | [Objects and properties](./objects.md) |
| `simulation.world.layout` | [Locations and layout](./locations-layout.md) |
| `simulation.world.layout.locations` and location fields | [Locations and layout](./locations-layout.md) |

## Types and visuals

| Field | Owner |
|---|---|
| `simulation.type_definitions` | [Type definitions and traits](./types-traits.md) |
| `simulation.type_definitions.*.extends` | [Type definitions and traits](./types-traits.md) |
| `simulation.type_definitions.*.traits` | [Type definitions and traits](./types-traits.md) |
| `simulation.type_definitions.*.additional_properties` | [Type definitions and traits](./types-traits.md) |
| `simulation.type_traits` | [Type definitions and traits](./types-traits.md) |
| `simulation.type_traits.*.can_be_actor_id` | [Type definitions and traits](./types-traits.md) |
| `simulation.state_libraries` and its fields | [State Libraries and appearance](./state-libraries.md) |

## Collections

| Field | Owner |
|---|---|
| `simulation.collections` | [Collections](./collections.md) |
| `simulation.collections.*.from` | [Collections](./collections.md) |
| `simulation.collections.*.as` | [Collections](./collections.md) |
| `simulation.collections.*.where` | [Collections](./collections.md) |
| `simulation.collections.*.open` | [Collections](./collections.md) |
| `simulation.collections.*.closes_at` | [Collections](./collections.md) |

## Process and tasks

| Field | Owner |
|---|---|
| `simulation.process` | [Starting State overview](./overview.md) |
| `simulation.process.tasks` | [Tasks](./tasks.md) |
| `tasks[].id`, `duration`, `location`, and descriptive fields | [Tasks](./tasks.md) |
| `tasks[].actor_id` | [Actors and performers](./actors-performers.md) |
| `tasks[].start` and `depends_on` | [Scheduling and dependencies](./scheduling.md) |
| `tasks[].timing` | [Scheduling and dependencies](./scheduling.md) |
| `tasks[].when`, `requires`, and `while` | [Conditions and boolean logic](../language/conditions.md) |
| `tasks[].progress` and `continues` | [Tasks](./tasks.md) |
| `tasks[].reservations` | [Reservations](./reservations.md) |

## Work definitions

| Field | Owner |
|---|---|
| `simulation.process.work_definitions` | [Work definitions](./work-definitions.md) |
| `work_definitions[].id` | [Work definitions](./work-definitions.md) |
| `work_definitions[].instantiate` and its fields | [Work definitions](./work-definitions.md) |
| `work_definitions[].task` | [Work definitions](./work-definitions.md) |

## Multi-period declarations

| Field | Owner |
|---|---|
| `simulation.simulation_config` | [Calendars and multi-period models](./multi-period.md) |
| `simulation.day_types` | [Calendars and multi-period models](./multi-period.md) |
| `simulation.calendar` | [Calendars and multi-period models](./multi-period.md) |

