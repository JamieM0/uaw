# Architecture Overview

This page is a map of the Universal Automation Wiki (UAW) docs and the major systems in this repo.

## Start Here

- **WorkSpec (canonical schema + guides):** [Quickstart](/docs/workspec/guides/quickstart), [Specification v2.0](/docs/workspec/specification/v2.0/)
- **Simulation Playground (build + validate simulations):** [Playground Guide](/docs/playground/playground-guide)
- **Developer tooling (generators + doc build):** [Docs Translator](/docs/routines/docs-translator)

## Where Docs Live

- **Source:** `docs-md/` (Markdown)
- **Generated site:** `web/docs/` (HTML)
- **Generator:** `routines/docs/docs-translator.py`

## Simulation Playground (High Level)

The playground is a browser-based editor for simulation JSON. It renders timelines/layouts and runs a client-side validation engine driven by a metrics catalog.

**Guides**
- [Space Editor Guide](/docs/playground/space-editor-guide)
- [Display Editor Guide](/docs/playground/display-editor-guide)
- [Smart Actions](/docs/playground/smart-actions)
- [Save & Load](/docs/playground/save-load)
- [Multi-Day Simulations](/docs/playground/multi-day-simulations)

**Simulation & Validation**
- [Simulation & Validation System](/docs/simulations/validation)
- [Validation Rules Reference](/docs/simulations/validation-rules-reference)
- [Metric & Constraint ID Standardization](/docs/simulations/constraints)
- [Metrics Editor](/docs/simulations/metrics-editor)
- [Actor Movement](/docs/simulations/actor-movement)
- [Universal Object Model (Simulation)](/docs/simulations/universal-object-model)

## WorkSpec (Canonical Model)

WorkSpec is the canonical specification for how work is described and exchanged across tools.

- [WorkSpec Cheatsheet](/docs/workspec/cheatsheet)
- [WorkSpec Reference: Types](/docs/workspec/reference/types)
- [WorkSpec Specification v2.0: Schema](/docs/workspec/specification/v2.0/schema)
- [WorkSpec Specification v2.0: Objects](/docs/workspec/specification/v2.0/objects)

## Content Generation Routines (High Level)

The `routines/` scripts form a pipeline that can generate UAW pages for a topic (metadata → trees → timelines → challenges → adoption → implementations → ROI → future tech → specs → assembly).

**Core pipeline docs**
- [Flow Maker](/docs/routines/flow-maker)
- [Generate Metadata](/docs/routines/generate-metadata)
- [Hallucinate Tree](/docs/routines/hallucinate-tree)
- [Generate Automation Timeline](/docs/routines/generate-automation-timeline)
- [Generate Automation Challenges](/docs/routines/generate-automation-challenges)
- [Automation Adoption](/docs/routines/automation-adoption)
- [Current Implementations](/docs/routines/current-implementations)
- [Return Analysis](/docs/routines/return-analysis)
- [Future Technology](/docs/routines/future-technology)
- [Specifications Industrial](/docs/routines/specifications-industrial)
- [Assemble](/docs/routines/assemble)

## Standards

- [Automation Status Taxonomy](/docs/standards/automation-status)
