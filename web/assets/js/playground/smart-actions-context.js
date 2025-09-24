// Smart Actions Context - Dynamic context construction for AI agents
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * Manages dynamic context construction for Smart Actions
     * Gathers current simulation state, validation results, and system info
     */
    class SmartActionsContext {
        constructor() {
            this.cache = null;
            this.cacheTimeout = 2000; // 2 second cache
            this.lastUpdate = 0;
        }

        /**
         * Get current context for AI agents
         * @param {boolean} forceRefresh - Force refresh context cache
         * @returns {Object} Complete context object
         */
        async getContext(forceRefresh = false) {
            const now = Date.now();

            if (!forceRefresh && this.cache && (now - this.lastUpdate) < this.cacheTimeout) {
                return this.cache;
            }

            try {
                const context = {
                    timestamp: new Date().toISOString(),
                    simulation: this.getCurrentSimulation(),
                    validation: this.getValidationResults(),
                    metrics: this.getMetricsInfo(),
                    ui: this.getUIState(),
                    syntax: this.getSyntaxInfo()
                };

                this.cache = context;
                this.lastUpdate = now;
                return context;
            } catch (error) {
                console.error('SmartActionsContext: Error gathering context:', error);
                return this.getEmptyContext();
            }
        }

        /**
         * Get current simulation from Monaco editor
         */
        getCurrentSimulation() {
            try {
                if (typeof editor === 'undefined' || !editor || typeof editor.getValue !== 'function') {
                    return null;
                }

                const rawJson = editor.getValue();
                if (!rawJson || !rawJson.trim()) {
                    return null;
                }

                const simulation = JSON.parse(rawJson);

                // Extract key metadata
                const meta = simulation?.simulation?.meta || {};
                const objects = simulation?.simulation?.objects || [];
                const tasks = simulation?.simulation?.tasks || [];

                // Extract key summary info instead of full JSON to reduce token usage
                const objectTypes = objects.reduce((acc, obj) => {
                    acc[obj.type] = (acc[obj.type] || 0) + 1;
                    return acc;
                }, {});

                const taskTypes = tasks.reduce((acc, task) => {
                    const type = task.task_type || 'unspecified';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {});

                return {
                    title: meta.title || 'Untitled Simulation',
                    description: meta.description || '',
                    industry: meta.industry || 'unspecified',
                    complexityLevel: meta.complexity_level || 'unspecified',
                    objectCount: objects.length,
                    taskCount: tasks.length,
                    currency: simulation?.simulation?.config?.currency || 'USD',
                    timeUnit: simulation?.simulation?.config?.time_unit || 'minutes',
                    objectTypes,
                    taskTypes,
                    // Provide lightweight JSON summary instead of full data
                    jsonSummary: {
                        hasSimulation: true,
                        totalCharacters: JSON.stringify(simulation).length,
                        hasAssets: !!(simulation?.assets && Object.keys(simulation.assets).length > 0),
                        assetCount: simulation?.assets ? Object.keys(simulation.assets).length : 0
                    }
                };
            } catch (error) {
                return {
                    error: true,
                    message: error.message,
                    syntaxIssue: true
                };
            }
        }

        /**
         * Get current validation results
         */
        getValidationResults() {
            try {
                // Check for validation results cache
                const cache = window.__uawValidationResultsCache;
                if (!cache || !Array.isArray(cache.results)) {
                    return { available: false };
                }

                const results = cache.results;
                const stats = {
                    total: results.length,
                    errors: results.filter(r => r.status === 'error').length,
                    warnings: results.filter(r => r.status === 'warning').length,
                    info: results.filter(r => r.status === 'info' || r.status === 'suggestion').length,
                    success: results.filter(r => r.status === 'success').length
                };

                // Get recent errors for context
                const recentErrors = results
                    .filter(r => r.status === 'error')
                    .slice(0, 5)
                    .map(r => ({
                        id: r.id,
                        message: r.message,
                        category: r.category || 'unknown'
                    }));

                return {
                    available: true,
                    stats,
                    recentErrors,
                    lastValidation: cache.timestamp || new Date().toISOString()
                };
            } catch (error) {
                return {
                    available: false,
                    error: error.message
                };
            }
        }

        /**
         * Get metrics system information
         */
        getMetricsInfo() {
            try {
                const info = {
                    builtInCount: 0,
                    customCount: 0,
                    disabledMetrics: [],
                    validationFunctions: []
                };

                // Get built-in metrics count
                if (window.metricsCatalog && Array.isArray(window.metricsCatalog)) {
                    info.builtInCount = window.metricsCatalog.filter(m => m.source !== 'custom').length;
                }

                // Get custom metrics information
                try {
                    const customCatalogText = localStorage.getItem('uaw-metrics-catalog-custom');
                    if (customCatalogText) {
                        const customCatalog = JSON.parse(customCatalogText);
                        if (Array.isArray(customCatalog)) {
                            info.customCount = customCatalog.filter(item => !item.disabled_metrics).length;

                            // Extract disabled metrics
                            const disabledEntry = customCatalog.find(item => item.disabled_metrics);
                            if (disabledEntry) {
                                info.disabledMetrics = disabledEntry.disabled_metrics;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse custom metrics:', e);
                }

                // Get validation functions from custom validator
                try {
                    const validatorCode = localStorage.getItem('uaw-metrics-validator-custom');
                    if (validatorCode) {
                        const functionMatches = validatorCode.match(/function\s+(\w+)\s*\(/g);
                        if (functionMatches) {
                            info.validationFunctions = functionMatches.map(match =>
                                match.replace(/function\s+(\w+)\s*\(/, '$1')
                            );
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse validation functions:', e);
                }

                return info;
            } catch (error) {
                return {
                    error: error.message,
                    builtInCount: 0,
                    customCount: 0,
                    disabledMetrics: [],
                    validationFunctions: []
                };
            }
        }

        /**
         * Get current UI state
         */
        getUIState() {
            try {
                return {
                    mode: this.getCurrentMode(),
                    activeTab: this.getActiveTab(),
                    autoValidation: window.autoValidationEnabled !== false,
                    autoRender: window.autoRender !== false,
                    theme: document.documentElement.getAttribute('data-theme') || 'light'
                };
            } catch (error) {
                return {
                    mode: 'unknown',
                    error: error.message
                };
            }
        }

        /**
         * Get current playground mode
         */
        getCurrentMode() {
            const metricsMode = document.querySelector('.metrics-mode-layout');
            const standardMode = document.querySelector('.standard-mode-layout');

            if (metricsMode && metricsMode.style.display !== 'none') {
                return 'metrics';
            } else if (standardMode && standardMode.style.display !== 'none') {
                return 'standard';
            }

            return 'unknown';
        }

        /**
         * Get active tab in simulation panel
         */
        getActiveTab() {
            const activeTab = document.querySelector('.tab-btn.active');
            return activeTab ? activeTab.getAttribute('data-tab') : 'timeline';
        }

        /**
         * Get Universal Object Model syntax information
         */
        getSyntaxInfo() {
            return {
                objectTypes: ['actor', 'equipment', 'resource', 'product'],
                commonProperties: {
                    actor: ['hourly_cost', 'skills', 'capacity', 'availability'],
                    equipment: ['states', 'capacity', 'maintenance_cost', 'operational_cost'],
                    resource: ['quantity', 'unit_cost', 'supplier', 'reorder_point'],
                    product: ['value', 'quality_metrics', 'weight', 'dimensions']
                },
                interactionTypes: ['set', 'delta', 'from', 'to'],
                timeUnits: ['seconds', 'minutes', 'hours', 'days'],
                complexityLevels: ['basic', 'intermediate', 'advanced'],
                currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
            };
        }

        /**
         * Get empty context for error states
         */
        getEmptyContext() {
            return {
                timestamp: new Date().toISOString(),
                simulation: null,
                validation: { available: false },
                metrics: { builtInCount: 0, customCount: 0, disabledMetrics: [], validationFunctions: [] },
                ui: { mode: 'unknown' },
                syntax: this.getSyntaxInfo(),
                error: true
            };
        }

        /**
         * Create context summary for AI prompts
         */
        createContextSummary(context) {
            const simulation = context.simulation;
            const validation = context.validation;
            const metrics = context.metrics;

            let summary = '';

            // Simulation info
            if (simulation && !simulation.error) {
                summary += `Current Simulation: "${simulation.title}"\n`;
                summary += `Objects: ${simulation.objectCount}, Tasks: ${simulation.taskCount}\n`;
                summary += `Industry: ${simulation.industry}, Complexity: ${simulation.complexityLevel}\n`;
            } else if (simulation && simulation.error) {
                summary += `Simulation has JSON syntax error: ${simulation.message}\n`;
            } else {
                summary += 'No simulation currently loaded\n';
            }

            // Validation info
            if (validation.available) {
                summary += `\nValidation: ${validation.stats.errors} errors, ${validation.stats.warnings} warnings\n`;
                if (validation.recentErrors.length > 0) {
                    summary += 'Recent errors:\n';
                    validation.recentErrors.forEach(error => {
                        summary += `- ${error.message}\n`;
                    });
                }
            } else {
                summary += '\nValidation results not available\n';
            }

            // Metrics info
            summary += `\nMetrics: ${metrics.builtInCount} built-in, ${metrics.customCount} custom\n`;
            if (metrics.disabledMetrics.length > 0) {
                summary += `Disabled: ${metrics.disabledMetrics.join(', ')}\n`;
            }

            return summary;
        }
    }

    // Export to global scope
    window.SmartActionsContext = SmartActionsContext;

})();