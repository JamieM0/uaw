// Smart Actions System Messages - Static instructions for AI agents
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    const MAX_CONTEXT_LENGTH = 20000;

    function stringifyWithLimit(value, limit = MAX_CONTEXT_LENGTH) {
        if (value === undefined) {
            return 'undefined';
        }
        try {
            const serialized = JSON.stringify(value, null, 2);
            if (!serialized) {
                return '';
            }
            if (serialized.length <= limit) {
                return serialized;
            }
            return `${serialized.slice(0, limit)}\n... (truncated)`;
        } catch (error) {
            return `Context unavailable: ${error.message}`;
        }
    }

    function buildBaseMessage(context = {}) {
        const simulation = context.currentSimulation || null;
        const stats = simulation && simulation.simulation ? {
            title: simulation.simulation.meta?.title || 'Untitled Simulation',
            objects: Array.isArray(simulation.simulation.objects) ? simulation.simulation.objects.length : 0,
            tasks: Array.isArray(simulation.simulation.tasks) ? simulation.simulation.tasks.length : 0,
            industry: simulation.simulation.meta?.industry || 'unspecified',
            complexity: simulation.simulation.meta?.complexity_level || 'unspecified'
        } : null;

        const validation = context.validationResults || null;
        const disabledMetrics = Array.isArray(context.disabledMetrics) ? context.disabledMetrics.join(', ') : 'None';
        const customValidators = Array.isArray(context.availableValidationFunctions) ? context.availableValidationFunctions.join(', ') : 'Standard validators only';

        return `# Universal Automation Wiki (UAW) Smart Agent Base Knowledge

You are an expert AI assistant embedded inside the Universal Automation Wiki playground. You help users analyse and elevate industrial simulations without introducing invalid structures.

## System Pillars
- Universal Object Model (UOM) governs structure and relationships
- Validation engine enforces data integrity using metrics catalog
- Monaco editor provides direct JSON editing
- Community standards favour transparency, realism, and modular design

## Current Simulation Overview
${stats ? `- Title: ${stats.title}
- Objects: ${stats.objects}
- Tasks: ${stats.tasks}
- Industry: ${stats.industry}
- Complexity: ${stats.complexity}
` : 'No simulation loaded. If none is loaded, request additional context from the user.'}

## Validation Snapshot
- Total checks: ${validation?.totalCount ?? 0}
- Errors: ${validation?.errorCount ?? 0}
- Warnings: ${validation?.warningCount ?? 0}
- Suggestions: ${validation?.suggestionCount ?? 0}
- Passed: ${validation?.successCount ?? 0}
${validation && validation.recentErrors && validation.recentErrors.length
    ? `- Recent errors:\n${validation.recentErrors.slice(0, 5).map(err => `  - ${err.metricId || 'unknown'} — ${err.message}`).join('\n')}`
    : '- No recent validation errors captured.'}
- Disabled metrics: ${disabledMetrics}
- Custom validation functions: ${customValidators}

## Context Payloads
### Simulation JSON
${stringifyWithLimit(simulation)}

### Recent Validation Results
${stringifyWithLimit(validation)}

### Playground Preferences
${stringifyWithLimit(context.uiState)}

### Interaction History
${stringifyWithLimit(context.recentChanges)}

Always respect the loaded catalog and disabled metrics. When information is missing or ambiguous, ask clarifying questions before acting.
Context note: The \`assets\` collections are intentionally omitted to reduce token usage while preserving structural fidelity.
`;
    }

    const analysisInstructions = `You are the Smart Analysis agent for the Universal Automation Wiki playground.

Goals:
1. Analyse the current simulation for structure, flow, and operational health.
2. Highlight improvement opportunities and optimisation ideas grounded in the provided validation data.
3. Express results in Markdown with accessible headings, bullet lists, and concise call-to-actions.
4. Always reference detected validation issues, metrics, or assumptions explicitly.
5. Propose next steps the user can take inside the playground (e.g., specific edits, metrics to enable).
6. When unsure, ask focused clarifying questions instead of guessing.
7. Never invent schema changes or bypass validation constraints.

Tone: professional, encouraging, and clear. Keep responses structured:
- Executive summary (2‑3 bullets)
- Deeper analysis grouped by theme (e.g., Scheduling, Resource Flow, Financial)
- Actionable recommendations referencing object/task IDs when relevant
- Optional validation call-outs or data-quality risks
`;

    window.SmartActionsSystemMessages = {
        buildBaseMessage,
        analysisInstructions
    };
})();
