# Simulation in UAW

## Constraints and Metrics
### Structure
```jsonc
{
  "id": "resource.flow.negative_stock", // A unique, dot-notation ID. Simple and clear.
  "name": "Negative Stock Check",       // Short, human-readable name for the UI.
  "description": "Checks if any resource's stock level drops below zero at any point during the simulation.", // Detailed explanation.
  "category": "Resource Flow",          // Grouping for the UI (e.g., "Resource Flow", "Scheduling", "Economic", "Realism").
  "severity": "error",                  // "error", "warning", or "info". Controls UI presentation.
  "validation_type": "computational",   // The crucial field: "computational" or "llm".

  // --- Section for "computational" type ---
  "computation": {
    "engine": "javascript", // Specifies the execution environment (client-side JS for now).
    "function_name": "validateNegativeStock", // The JS function to call in the playground.
    "trigger": {
        "type": "on_simulation_change", // When to run this check.
        "selector": null // (Future) Could target specific parts of the JSON, for now, runs on the whole thing.
    }
  },

  // --- Section for "llm" type ---
  "llm_evaluation": {
      "model": "gemma3", // The model to use for this check (optional, overrides system default).
      "prompt_template": "Analyze the task '{task.id}' which consumes {task.consumes_list}. Does the amount of {resource.id} consumed ({resource.amount}) seem reasonable for producing {task.produces_list} in a {domain} context? Justify your 'Yes' or 'No' answer.", // The template for the LLM.
      "trigger": {
          "type": "on_manual_request", // LLM checks are likely manual to save resources.
          "selector": "tasks.*" // A selector indicating this check runs on every task.
      }
  }
}
```