// Smart Actions Context Manager - Collects live playground state for AI prompts
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    class SmartActionsContextManager {
        constructor() {
            this.cache = null;
            this.cacheTTL = 1000;
            this.lastFetch = 0;
        }

        async getContext(forceRefresh = false) {
            const now = Date.now();
            if (!forceRefresh && this.cache && (now - this.lastFetch) < this.cacheTTL) {
                return this.cache;
            }

            const context = {
                timestamp: new Date().toISOString(),
                currentSimulation: this.getCurrentSimulation(),
                validationResults: this.getValidationResults(),
                builtInMetrics: this.getBuiltInMetrics(),
                customMetricsCount: this.getCustomMetricsCount(),
                disabledMetrics: this.getDisabledMetrics(),
                availableValidationFunctions: this.getValidationFunctions(),
                uiState: this.getUIState(),
                recentChanges: this.getRecentChanges()
            };

            this.cache = context;
            this.lastFetch = now;
            return context;
        }

        getCurrentSimulation() {
            if (typeof editor === 'undefined' || !editor || typeof editor.getValue !== 'function') {
                return null;
            }
            try {
                const value = editor.getValue();
                if (!value || !value.trim()) {
                    return null;
                }
                const parsed = JSON.parse(value);
                const sanitized = JSON.parse(JSON.stringify(parsed, (key, val) => {
                    if (key === 'assets') {
                        return undefined;
                    }
                    return val;
                }));
                return sanitized;
            } catch (error) {
                return {
                    error: 'Invalid JSON in editor',
                    message: error.message
                };
            }
        }

        getValidationResults() {
            const cache = window.__uawValidationResultsCache;
            if (!cache || !Array.isArray(cache.results)) {
                return null;
            }

            const stats = cache.stats || {
                total: cache.results.length,
                errors: cache.results.filter(item => item.status === 'error').length,
                warnings: cache.results.filter(item => item.status === 'warning').length,
                suggestions: cache.results.filter(item => item.status === 'suggestion').length,
                success: cache.results.filter(item => item.status === 'success').length
            };

            const recentErrors = cache.results
                .filter(item => item.status === 'error')
                .slice(0, 10)
                .map(item => ({
                    status: item.status,
                    metricId: item.metricId,
                    message: item.message,
                    category: item.category || item.status
                }));

            return {
                totalCount: stats.total,
                errorCount: stats.errors,
                warningCount: stats.warnings,
                suggestionCount: stats.suggestions,
                infoCount: stats.suggestions,
                successCount: stats.success,
                recentErrors,
                timestamp: cache.timestamp || Date.now()
            };
        }

        getBuiltInMetrics() {
            if (!window.metricsCatalog || !Array.isArray(window.metricsCatalog)) {
                return [];
            }
            return window.metricsCatalog.filter(metric => metric && metric.source !== 'custom');
        }

        getCustomMetricsCount() {
            try {
                const raw = window.localStorage.getItem('uaw-metrics-catalog-custom');
                if (!raw) {
                    return 0;
                }
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    return 0;
                }
                return parsed.filter(entry => !entry.disabled_metrics).length;
            } catch (error) {
                console.warn('SmartActions: Failed to read custom metrics.', error);
                return 0;
            }
        }

        getDisabledMetrics() {
            try {
                const raw = window.localStorage.getItem('uaw-metrics-catalog-custom');
                if (!raw) {
                    return [];
                }
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    return [];
                }
                const disabledEntry = parsed.find(entry => Array.isArray(entry.disabled_metrics));
                return disabledEntry ? disabledEntry.disabled_metrics : [];
            } catch (error) {
                console.warn('SmartActions: Failed to resolve disabled metrics.', error);
                return [];
            }
        }

        getValidationFunctions() {
            try {
                const raw = window.localStorage.getItem('uaw-metrics-validator-custom') || '';
                const matches = raw.match(/function\s+(\w+)\s*\(/g) || [];
                return matches.map(match => match.replace(/function\s+/, '').replace('(', '').trim());
            } catch (error) {
                return [];
            }
        }

        getUIState() {
            return {
                playgroundMode: window.isMetricsMode ? 'metrics' : 'standard',
                darkMode: document.documentElement.getAttribute('data-theme') === 'dark',
                autoValidationEnabled: window.autoValidationEnabled !== false,
                autoRenderEnabled: window.autoRender !== false,
                selectedLibraryItem: document.querySelector('#simulation-library-select')?.value || null
            };
        }

        getRecentChanges() {
            try {
                const raw = window.localStorage.getItem('uaw-recent-actions');
                if (!raw) {
                    return [];
                }
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
            } catch (error) {
                return [];
            }
        }
    }

    window.SmartActionsContextManager = SmartActionsContextManager;
})();
