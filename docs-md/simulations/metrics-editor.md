# The Metrics Editor

The Metrics Editor is a powerful, advanced mode within the Simulation Playground that allows you to create, edit, and test your own custom validation metrics. It transforms the playground into a full development environment for extending the UAW's validation capabilities.

## Accessing the Metrics Editor

You can switch to the Metrics Editor by clicking the "Open Metrics Editor" button in the playground's header. This will change the layout to reveal the two core components of the editor.

## Metrics Editor Layout

When you enter Metrics Editor mode, the interface is rearranged:

1.  **Left Panel:** This panel contains tabs for viewing the **JSON Editor**, the **Simulation Render**, and the **Space Editor**, allowing you to see the simulation you are testing against.
2.  **Right Panel (Metrics Editor):** This panel is the main workspace for editing metrics and contains two tabs:
    *   **`metrics-catalog-custom.json`:** A JSON editor for defining the metadata of your custom metrics.
    *   **`simulation-validator-custom.js`:** A JavaScript editor for writing the implementation logic for your custom metrics.

All content in the Metrics Editor is saved to your browser's `localStorage`, so your custom work persists between sessions.

## Defining a Custom Metric

Metrics are defined as JSON objects in the `metrics-catalog-custom.json` file. Each metric definition must include the following fields:

| Field           | Type   | Description                                                                 |
| --------------- | ------ | --------------------------------------------------------------------------- |
| `id`            | string | A unique identifier for the metric (e.g., `custom.quality.check_oven_temp`).|
| `name`          | string | A human-readable name for the metric (e.g., "Oven Temperature Check").      |
| `emoji`         | string | An emoji to visually represent the metric.                                  |
| `category`      | string | The category the metric belongs to (e.g., "Quality Assurance").             |
| `severity`      | string | The severity of a failure: `error`, `warning`, or `suggestion`.             |
| `source`        | string | Must be set to `"custom"`.                                                  |
| `function`      | string | The name of the JavaScript function that implements the validation logic.   |
| `description`   | string | A detailed description of what the metric validates.                        |
| `params`        | object | (Optional) An object defining default parameters for the metric.            |

### Example Metric Definition

```json
{
  "id": "custom.equipment.check_mixer_usage",
  "name": "Check Mixer Usage",
  "emoji": "🌀",
  "category": "Equipment Utilization",
  "severity": "warning",
  "source": "custom",
  "function": "validateMixerUsage",
  "description": "Checks if the mixer is used in any task that doesn't involve mixing.",
  "validation_type": "computational"
}
```

## Writing a Custom Validation Function

The logic for your custom metric is written in the `simulation-validator-custom.js` file. The function name must match the `function` field in your metric's catalog definition.

### The Validation Context

Each validation function is executed within a specific context, giving you access to the simulation data and helper methods:

*   `this.simulation`: The full, parsed `simulation` object from the JSON editor.
*   `this.addResult(resultObject)`: A method to report the result of your validation. The `resultObject` should have `metricId`, `status` ('success', 'warning', 'error'), and a `message`.
*   `metric.params`: An object containing any parameters passed to the metric from its definition in the catalog.

### Example Validation Function

This function corresponds to the example metric definition above.

```javascript
/**
 * Checks if the mixer is used in any task that doesn't involve mixing.
 */
function validateMixerUsage(metric) {
    const simulation = this.simulation;
    const tasks = simulation.tasks || [];
    let foundIncorrectUsage = false;

    for (const task of tasks) {
        const usesMixer = (task.interactions || []).some(
            interaction => interaction.object_id === 'mixer'
        );

        if (usesMixer && !task.id.toLowerCase().includes('mix')) {
            foundIncorrectUsage = true;
            this.addResult({
                metricId: metric.id,
                status: 'warning',
                message: `Task '${task.id}' uses the mixer but does not seem to be a mixing task.`
            });
            break; // Report first instance and stop
        }
    }

    if (!foundIncorrectUsage) {
        this.addResult({
            metricId: metric.id,
            status: 'success',
            message: 'All mixer usages appear to be in appropriate tasks.'
        });
    }
}
```
