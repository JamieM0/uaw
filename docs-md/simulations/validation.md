# UAW Simulation & Validation System

This document outlines the architecture and standards for the Universal Automation Wiki's simulation and validation engine. This system is designed to be robust, extensible, and community-driven, providing trustworthy, business-ready analysis of automation processes.

## Core Concepts

The system is built on three pillars: a standardized **Simulation Schema**, a central **Metrics Catalog**, and a client-side **Validation Engine**.

### 1. The Simulation Schema

All simulations must adhere to a strict schema. The key distinction is between `equipment` (persistent objects with states) and `resources` (consumable items).

-   **`equipment`**: An array of objects that exist throughout the simulation. Each has an `id`, `name`, `emoji`, and a starting `state` (e.g., "clean", "available").
-   **`resources`**: An array of consumable items. Each has an `id`, `unit`, and `starting_stock`.
-   **`tasks`**: The core of the simulation. Tasks interact with the world via two primary mechanisms:
    -   `consumes` / `produces`: For depleting and creating `resources`.
    -   `equipment_interactions`: An array describing how the task uses and changes the `state` of `equipment`.

**Example Task Interaction:**

```json
{
  "id": "mix_dough 🔸 🥄",
  "consumes": { "flour": 1, "water": 0.7 },
  "produces": { "mixed_dough": 1 },
  "equipment_interactions": [
    { "id": "mixer", "from_state": "clean", "to_state": "dirty" }
  ]
}
```

### 2. The Metrics Catalog

The single source of truth for all validation is `/assets/static/metrics-catalog.json`. This file contains a list of **Metric Definition Objects**, each describing a single, atomic check.

Each metric has a `validation_type` which can be:
*   **`computational`**: A deterministic check run by a JavaScript function in the browser. These are fast and objective.
*   **`llm`**: (Future) A qualitative check that sends a formatted prompt to a local LLM for nuanced, "realism" assessments.

### 3. The Validation Engine

The file `/web/assets/js/simulation-validator.js` contains the runtime for all `computational` metrics. It is a JavaScript class that:
1.  Loads the simulation JSON.
2.  Iterates through the `metrics-catalog.json`.
3.  Executes the JavaScript function specified by each metric.
4.  Collects and returns a structured list of results (`success`, `error`, `warning`, `info`).

## How Validation Works

The process is fully automated in the Simulation Playground:

1.  **Edit & Render:** As you edit the JSON, the simulation is rendered.
2.  **Run Checks:** The Validation Engine runs all computational checks from the catalog against the current JSON.
3.  **Display Results:** The results are grouped by category (Structural Integrity, Resource Flow, Scheduling, Optimization) and displayed with color-coding based on severity.

### Business Readiness Score

While not a direct metric, the playground can calculate a "Business Readiness" score based on the validation results. This provides a high-level indicator of the simulation's quality, weighted by the severity of the issues found.

## Contributing New Metrics

The power of this system comes from its extensibility. To add a new validation check:

1.  **Propose the Metric:** Open a "Metric/Constraint Proposal" issue on GitHub. Describe the logic, provide examples of passing/failing cases, and suggest a JSON definition.
2.  **Discuss & Refine:** The community and maintainers will discuss the proposal.
3.  **Implement via Pull Request:** Once approved, a contributor can open a PR that includes:
    *   The new Metric Definition Object added to `metrics-catalog.json`.
    *   If computational, the new corresponding function added to `simulation-validator.js`.

This workflow allows us to systematically build a comprehensive library of validation checks.

---
*This system deprecates the legacy files `constraint_config.json` and `maintenance_rules.json`. Their logic has been migrated into the more modular and extensible Metrics Catalog.*