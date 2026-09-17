---
title: "Compatibility-only fields and syntax"
description: "Reference accepted historical forms that are not preferred WorkSpec 2.2 authoring."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "compatibility"
order: 830
---

# Compatibility-only fields and syntax

The forms on this page exist for historical input. Do not use them in new WorkSpec 2.2 projects.

## Structured references

The runtime accepts structured references through a compatibility normalizer.

```json
{ "object": "shipment", "property": "temperature" }
```

```json
{ "task": "inspect", "field": "end" }
```

```json
{ "location": "room_a", "field": "name" }
```

Use canonical compact forms instead: `@shipment.temperature`, `@inspect.end`, and `@room_a.name`.

The structured clock form `{ "clock": "now" }` maps to canonical `@now`. The wrapper `{ "literal": value }` remains accepted.

Malformed objects that use only structured-reference keys produce a reference Problem. Ordinary objects with unrelated keys remain object literals.

## Flat simulation fields

Historical implementations can inspect `simulation.objects`, `simulation.tasks`, `simulation.layout`, and `simulation.recipes` as fallbacks.

Use `simulation.world.objects`, `simulation.process.tasks`, and `simulation.world.layout` in canonical 2.2 documents.

A document with simulation fields at the document root is non-canonical and fails current validation.

## Inline task behavior

WorkSpec 2.0 and 2.1 can use task `interactions`. Historical aliases include `object_id` and `revert_after`.

WorkSpec 2.2 rejects inline `interactions`, `equipment_interactions`, `consumes`, and `produces`. Put effects in `changes.workspec.js`.

## Recipes

Historical `process.recipes` data remains visible to older document checks. Those checks depend on inline interaction behavior.

Current 2.2 execution can change quantities through Changes or a Generator. Model recipe compliance as an explicit domain Constraint when required.

## Digital-space structures

Runtime indexing recognizes historical `digital_space`, display, screen, connection, and data-flow entities. Current 2.2 validation evidence does not establish them as recommended canonical authoring.

Do not depend on these structures as a stable 2.2 language promise without a newer explicit surface contract.

