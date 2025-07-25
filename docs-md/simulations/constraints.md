# UAW Metric & Constraint ID Standardization

To ensure the system remains organized and scalable, all metric IDs will follow a three-level `TOP.MIDDLE.SPECIFIC` structure. This creates a clear, predictable, and self-documenting namespace.

## Structure Overview

| Level    | Description                                                                 | Examples                                                                                  |
|----------|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| **TOP**      | The highest-level domain the metric belongs to.<br>_What part of the simulation is this about?_ | `schema`, `actor`, `equipment`, `resource`, `task`, `temporal`, `economic`, `optimization` |
| **MIDDLE**   | A sub-category specifying the type of check.<br>_What property is being checked?_ | `integrity`, `scheduling`, `utilization`, `state`, `capacity`, `flow`, `definition`, `dependency`, `profitability`, `efficiency` |
| **SPECIFIC** | A concise, snake_case name for the specific rule.<br>_What is the exact problem?_ | `missing_root`, `overlap`, `exceeded`, `negative_stock`, `unreachable`, `negative_margin`  |

---

## Detailed Level Breakdown

### Top Level

- **schema**: Rules about the structural correctness of the JSON itself.
- **actor**: Rules concerning the actors (people, machines).
- **equipment**: Rules for non-consumable tools and objects.
- **resource**: Rules for consumable materials and abstract states.
- **task**: Rules about the definition and integrity of individual tasks.
- **temporal**: Rules concerning time, order, and dependencies between tasks.
- **economic**: Rules for financial viability (costs, revenue, profitability).
- **optimization**: Suggestions for improvement that are not strictly errors.

### Middle Level

- **integrity**: Checks for structural soundness and completeness.
- **scheduling**: Checks for timing, overlaps, and assignments.
- **utilization**: Analyzes how effectively actors/equipment are used.
- **state**: Validates the logical transitions of equipment states (e.g., `clean -> dirty`).
- **capacity**: Checks if equipment usage exceeds its defined capacity.
- **flow**: Tracks the consumption and production of resources over time.
- **definition**: Validates that defined items (e.g., resources) are used correctly.
- **dependency**: Checks the logical links between tasks.
- **profitability**: Analyzes financial outcomes.
- **efficiency**: Identifies opportunities for improvement (e.g., reducing idle time).