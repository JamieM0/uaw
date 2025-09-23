// Smart Actions Analysis - Context-aware conversation helpers
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    if (typeof SmartActionsSystemMessages === 'undefined' || typeof SmartActionsContextManager === 'undefined' || typeof SmartActionsClient === 'undefined') {
        throw new Error('SmartActionsAnalysis module is missing required dependencies.');
    }

    const contextManager = new SmartActionsContextManager();

    function buildInitialUserPrompt(context) {
        const validation = context.validationResults;
        const summaryLines = [];
        if (validation) {
            summaryLines.push(`Validation status → ${validation.errorCount || 0} errors, ${validation.warningCount || 0} warnings, ${validation.suggestionCount || validation.infoCount || 0} suggestions.`);
            summaryLines.push(`Passed checks: ${validation.successCount || 0} / ${validation.totalCount || 0}.`);
            if (validation.errorCount > 0 && Array.isArray(validation.recentErrors)) {
                const keyErrors = validation.recentErrors.slice(0, 3).map(err => `- ${err.metricId || 'Unknown metric'}: ${err.message}`);
                summaryLines.push('Most recent errors:');
                summaryLines.push(...keyErrors);
            }
        } else {
            summaryLines.push('Validation results are unavailable. Flag areas that require verification.');
        }
        summaryLines.push('Provide an executive summary, detailed analysis, and prioritised recommendations grounded in the metrics above.');
        summaryLines.push('Offer follow-up questions if critical information is missing.');
        summaryLines.push('Use rich Markdown (headings, bullet lists, tables, code snippets) when helpful.');
        return summaryLines.join('\n');
    }

    async function fetchContext(forceRefresh) {
        return contextManager.getContext(forceRefresh);
    }

    async function buildInitialMessages(forceRefresh) {
        const context = await fetchContext(forceRefresh);
        const base = SmartActionsSystemMessages.buildBaseMessage(context);
        const instructions = SmartActionsSystemMessages.analysisInstructions;
        const systemMessage = {
            role: 'system',
            content: `${base}\n\n${instructions}`
        };
        const userPrompt = {
            role: 'user',
            content: buildInitialUserPrompt(context)
        };
        return {
            context,
            messages: [systemMessage, userPrompt]
        };
    }

    async function sendAnalysisRequest(config, messages, options = {}) {
        if (options.stream && typeof SmartActionsClient.streamChat === 'function') {
            try {
                const chunks = [];
                for await (const chunk of SmartActionsClient.streamChat(config, messages, options)) {
                    if (chunk) {
                        chunks.push(chunk);
                        if (typeof options.onChunk === 'function') {
                            options.onChunk(chunk);
                        }
                    }
                }
                return {
                    message: chunks.join('')
                };
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    throw error;
                }
                if (options.allowStreamFallback !== false) {
                    console.warn('SmartActions: Streaming unavailable, falling back to standard response.', error);
                } else {
                    throw error;
                }
            }
        }
        return SmartActionsClient.sendChat(config, messages, options);
    }

    window.SmartActionsAnalysis = {
        buildInitialMessages,
        sendAnalysisRequest,
        fetchContext
    };
})();
