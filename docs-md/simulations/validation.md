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

## Economic Validation

The UAW system includes comprehensive economic validation to ensure simulations are financially realistic and profitable. This is critical for business decision-making and investment analysis.

### Profitability Analysis

The **Negative Profitability** metric (`economic.profitability.negative_margin`) performs a complete economic analysis:

**Calculation Formula:**
- **Total Revenue** = Sum of (revenue_per_unit × quantity produced) for final products
- **Total Costs** = Labor Costs + Resource Costs
- **Labor Costs** = Sum of (actor cost_per_hour × task duration in hours)
- **Resource Costs** = Sum of (resource cost_per_unit × quantity consumed)
- **Profit** = Total Revenue - Total Costs

### Economic Properties Setup

#### Actor Labor Costs
Actors require a `cost_per_hour` property for labor cost calculation:

```json
{
  "id": "baker",
  "type": "actor",
  "name": "Professional Baker",
  "properties": {
    "cost_per_hour": 25.00
  }
}
```

#### Resource Costs
Resources and materials need `cost_per_unit` for consumption costs:

```json
{
  "id": "flour",
  "type": "resource",
  "name": "All-Purpose Flour",
  "properties": {
    "cost_per_unit": 0.50,
    "quantity": 100
  }
}
```

#### Product Revenue
Products need `revenue_per_unit` to generate revenue:

```json
{
  "id": "baked_bread",
  "type": "product",
  "name": "Freshly Baked Bread",
  "properties": {
    "revenue_per_unit": 5.50,
    "quantity": 0
  }
}
```

### Complete Economic Example

```json
{
  "simulation": {
    "objects": [
      {
        "id": "baker",
        "type": "actor",
        "properties": { "cost_per_hour": 20.00 }
      },
      {
        "id": "flour",
        "type": "resource",
        "properties": {
          "cost_per_unit": 0.50,
          "quantity": 10
        }
      },
      {
        "id": "baked_bread",
        "type": "product",
        "properties": {
          "revenue_per_unit": 8.00,
          "quantity": 0
        }
      }
    ],
    "tasks": [
      {
        "id": "bake_bread",
        "actor_id": "baker",
        "start": "09:00",
        "duration": 60,
        "consumes": { "flour": 2 },
        "produces": { "baked_bread": 4 }
      }
    ]
  }
}
```

**Economic Analysis:**
- Revenue: 4 units × $8.00 = **$32.00**
- Labor Cost: 1 hour × $20.00 = **$20.00**
- Material Cost: 2 units × $0.50 = **$1.00**
- **Profit: $32.00 - $21.00 = $11.00** ✓

### Configuring Final Products

The profitability metric only counts revenue from products listed in the `final_product_ids` parameter. By default, this is `["baked_bread"]` but can be customized in the metrics catalog for your specific simulation domain.

### New-Style Economic Interactions

The system also supports the new Universal Object Model interaction syntax for economic modeling:

```json
{
  "id": "production_task",
  "actor_id": "worker",
  "interactions": [
    {
      "object_id": "raw_material",
      "property_changes": {
        "quantity": { "delta": -5 }
      }
    },
    {
      "object_id": "finished_product",
      "property_changes": {
        "quantity": { "delta": 2 }
      }
    }
  ]
}
```

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