// Playground Validation - Validation display and filtering
// Universal Automation Wiki - Simulation Playground

// Display validation results
function displayValidationResults(results) {
    // Use the new grouped validation display
    try {
        window.__uawValidationResultsCache = {
            timestamp: Date.now(),
            results: Array.isArray(results) ? [...results] : [],
        };
    } catch (error) {
        console.warn('SmartActions: failed to cache validation results.', error);
    }
    displayGroupedValidationResults(results);
}

function displayGroupedValidationResults(results) {
    const compactContainer = document.getElementById("validation-compact");
    if (!compactContainer) {
        console.warn('Validation compact container not found in DOM');
        return;
    }

    // Single-pass grouping for better performance (was 8 filters, now 1 loop)
    const grouped = {
        errors: [],
        warnings: [],
        suggestions: [],
        success: []
    };

    const stats = {
        total: results.length,
        errors: 0,
        warnings: 0,
        suggestions: 0,
        success: 0
    };

    // Single pass through results to group and count
    for (const result of results) {
        switch (result.status) {
            case 'error':
                grouped.errors.push(result);
                stats.errors++;
                break;
            case 'warning':
                grouped.warnings.push(result);
                stats.warnings++;
                break;
            case 'suggestion':
                grouped.suggestions.push(result);
                stats.suggestions++;
                break;
            case 'success':
                grouped.success.push(result);
                stats.success++;
                break;
            default:
                console.warn(`Unknown validation status: ${result.status}`);
        }
    }

    try {
        if (window.__uawValidationResultsCache) {
            window.__uawValidationResultsCache.stats = stats;
        }
    } catch (error) {
        // Ignore cache failures silently
    }

    // Update stat counters
    updateValidationStats(stats);

    // Cache metrics catalog to avoid repeated expensive calls
    const mergedCatalog = getMergedMetricsCatalog();

    // Display grouped results (pass cached catalog)
    displayValidationGroup('errors', grouped.errors, '❌', false, mergedCatalog);
    displayValidationGroup('warnings', grouped.warnings, '⚠️', false, mergedCatalog);
    displayValidationGroup('suggestions', grouped.suggestions, '💡', false, mergedCatalog);
    displayValidationGroup('passed', grouped.success, '✅', false, mergedCatalog); // show passed messages by default

    // Apply current filter
    applyValidationFilter();

    // Setup interactive elements - always refresh to ensure proper event handling
    setupValidationInteractions();
}

function updateValidationStats(stats) {
    const elements = {
        total: document.getElementById('total-metrics-count'),
        errors: document.getElementById('error-metrics-count'),
        warnings: document.getElementById('warning-metrics-count'),
        suggestions: document.getElementById('suggestion-metrics-count'),
        success: document.getElementById('success-metrics-count')
    };

    if (elements.total) elements.total.textContent = stats.total;
    if (elements.errors) elements.errors.textContent = stats.errors;
    if (elements.warnings) elements.warnings.textContent = stats.warnings;
    if (elements.suggestions) elements.suggestions.textContent = stats.suggestions;
    if (elements.success) elements.success.textContent = stats.success;
}

function displayValidationGroup(groupId, results, icon, collapsedByDefault = false, mergedCatalog = null) {
    const groupElement = document.getElementById(`${groupId}-group`);
    const contentElement = document.getElementById(`${groupId}-group-content`);

    if (!groupElement) {
        console.warn(`Validation group element not found: ${groupId}-group`);
        return;
    }
    if (!contentElement) {
        console.warn(`Validation group content element not found: ${groupId}-group-content`);
        return;
    }

    // Show/hide group based on whether it has results
    if (results.length > 0) {
        groupElement.style.display = 'block';

        // Sort results to float custom metrics to the top
        // Use cached catalog if provided, otherwise fetch it
        if (!mergedCatalog) {
            mergedCatalog = getMergedMetricsCatalog();
        }
        const sortedResults = [...results].sort((a, b) => {
            const metricA = mergedCatalog.find(m => m.id === a.metricId);
            const metricB = mergedCatalog.find(m => m.id === b.metricId);
            
            const isCustomA = metricA?.source === 'custom';
            const isCustomB = metricB?.source === 'custom';
            
            // Custom metrics first
            if (isCustomA && !isCustomB) return -1;
            if (!isCustomA && isCustomB) return 1;
            
            // Within same type (custom/built-in), sort alphabetically by metric name
            const nameA = metricA?.name || a.metricId;
            const nameB = metricB?.name || b.metricId;
            return nameA.localeCompare(nameB);
        });

        // Generate HTML for results
        const html = sortedResults.map(result => {
            const metricName = sanitizeHTML(getMetricDisplayName(result.metricId, mergedCatalog));
            const sanitizedMessage = sanitizeHTML(result.message);
            const metric = mergedCatalog.find(m => m.id === result.metricId);

            // Add example and disable buttons for builtin metrics in Metrics Editor mode
            let actionButtons = '';
            if (isMetricsMode && metric && metric.source === 'builtin') {
                const sanitizedMetricId = sanitizeHTML(result.metricId);
                actionButtons = `
                    <div class="validation-actions">
                        <button class="example-btn" data-metric-id="${sanitizedMetricId}" title="Insert validation code example">📋</button>
                        <button class="disable-btn" data-metric-id="${sanitizedMetricId}" title="Disable this metric">Disable</button>
                    </div>
                `;
            }

            // Create accessible status label for screen readers
            const statusLabel = result.status === 'error' ? 'Error' :
                               result.status === 'warning' ? 'Warning' :
                               result.status === 'suggestion' ? 'Suggestion' : 'Success';

            return `
                <div class="validation-result-item ${result.status}"
                     data-metric-id="${sanitizeHTML(result.metricId)}"
                     data-clickable="true"
                     role="button"
                     tabindex="0"
                     aria-label="${statusLabel}: ${metricName} - ${sanitizedMessage}">
                    <div class="validation-result-status ${result.status}" aria-hidden="true"></div>
                    <div class="validation-result-details">
                        <div class="validation-result-name">
                            ${metricName} <span class="validation-message-inline">— ${sanitizedMessage}</span>
                        </div>
                    </div>
                    ${actionButtons}
                </div>
            `;
        }).join('');

        contentElement.innerHTML = html;

        // Handle collapsed state for passed group
        if (collapsedByDefault) {
            contentElement.classList.add('collapsed');
        } else {
            contentElement.classList.remove('collapsed');
        }
    } else {
        groupElement.style.display = 'none';
    }
}

function getMetricDisplayName(metricId, mergedCatalog = null) {
    // Try to get a more friendly name from the merged metrics catalog
    // Use cached catalog if provided, otherwise fetch it
    if (!mergedCatalog) {
        mergedCatalog = getMergedMetricsCatalog();
    }

    const metric = mergedCatalog.find(m => m.id === metricId);

    if (!metric) {
        console.warn(`Metric not found in catalog: ${metricId}`);
        return metricId;
    }

    // For custom metrics, show ID; for built-in, show name
    const displayName = metric.source === 'custom' ? metric.id : metric.name;

    return displayName;
}

// Store references to event handlers for cleanup
let validationEventHandlers = {
    clickHandler: null,
    keyboardHandler: null,
    filterChangeHandler: null
};

function setupValidationInteractions() {
    const validationContainer = document.querySelector('.validation-panel');
    const filterSelect = document.getElementById('validation-filter');

    // Clean up existing event handlers to prevent duplicates
    if (validationEventHandlers.clickHandler && validationContainer) {
        validationContainer.removeEventListener('click', validationEventHandlers.clickHandler);
    }
    if (validationEventHandlers.keyboardHandler && validationContainer) {
        validationContainer.removeEventListener('keydown', validationEventHandlers.keyboardHandler);
    }
    if (validationEventHandlers.filterChangeHandler && filterSelect) {
        filterSelect.removeEventListener('change', validationEventHandlers.filterChangeHandler);
        filterSelect.removeAttribute('data-listener-attached');
    }

    if (validationContainer) {
        // Delegated event listener for stat items and example buttons
        validationEventHandlers.clickHandler = (e) => {
            if (e.target.closest('.stat-item.clickable')) {
                const statItem = e.target.closest('.stat-item.clickable');
                const filterValue = statItem.dataset.filter;
                const filterSelect = document.getElementById('validation-filter');
                if (filterSelect) {
                    filterSelect.value = filterValue;
                    applyValidationFilter();
                    
                    // Update visual state
                    document.querySelectorAll('.stat-item.clickable').forEach(s => s.classList.remove('active'));
                    statItem.classList.add('active');
                }
            }
            
            // Handle example button clicks
            if (e.target.closest('.example-btn')) {
                const exampleBtn = e.target.closest('.example-btn');
                const metricId = exampleBtn.dataset.metricId;
                insertValidationExample(metricId);
                e.stopPropagation(); // Prevent event bubbling
            }
            
            // Handle disable button clicks
            if (e.target.closest('.disable-btn')) {
                const actionBtn = e.target.closest('.disable-btn');
                const metricId = actionBtn.dataset.metricId;
                disableBuiltinMetric(metricId);
                e.stopPropagation(); // Prevent event bubbling
            }
            
            // Handle validation result item clicks
            if (e.target.closest('.validation-result-item[data-clickable="true"]')) {
                const resultItem = e.target.closest('.validation-result-item');
                const message = resultItem.querySelector('.validation-message-inline');
                if (message) {
                    const messageText = message.textContent.replace('— ', '');
                    jumpToValidationTarget(messageText);
                    e.stopPropagation(); // Prevent event bubbling
                }
            }

            // Handle passed group collapsible
            if (e.target.closest('#passed-group') && !e.target.closest('.validation-result-item')) {
                const content = document.getElementById('passed-group-content');
                if (content) {
                    const isCollapsed = content.classList.contains('collapsed');
                    if (isCollapsed) {
                        content.classList.remove('collapsed');
                    } else {
                        content.classList.add('collapsed');
                    }
                }
            }
        };

        // Keyboard handler for accessibility
        validationEventHandlers.keyboardHandler = (e) => {
            // Handle Enter or Space key on validation result items
            if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.validation-result-item[data-clickable="true"]')) {
                e.preventDefault();
                const resultItem = e.target.closest('.validation-result-item');
                const message = resultItem.querySelector('.validation-message-inline');
                if (message) {
                    const messageText = message.textContent.replace('— ', '');
                    jumpToValidationTarget(messageText);
                }
            }

            // Handle Enter or Space key on stat items
            if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.stat-item.clickable')) {
                e.preventDefault();
                const statItem = e.target.closest('.stat-item.clickable');
                const filterValue = statItem.dataset.filter;
                const filterSelect = document.getElementById('validation-filter');
                if (filterSelect) {
                    filterSelect.value = filterValue;
                    applyValidationFilter();

                    // Update visual state
                    document.querySelectorAll('.stat-item.clickable').forEach(s => s.classList.remove('active'));
                    statItem.classList.add('active');
                }
            }
        };

        validationContainer.addEventListener('click', validationEventHandlers.clickHandler);
        validationContainer.addEventListener('keydown', validationEventHandlers.keyboardHandler);
    }

    // Setup filter dropdown
    if (filterSelect) {
        validationEventHandlers.filterChangeHandler = applyValidationFilter;
        filterSelect.addEventListener('change', validationEventHandlers.filterChangeHandler);
        filterSelect.setAttribute('data-listener-attached', 'true');
    }
}

function applyValidationFilter() {
    const filterSelect = document.getElementById('validation-filter');
    if (!filterSelect) {
        console.warn('Validation filter select element not found');
        return;
    }

    const filterValue = filterSelect.value || 'all';

    // Get all validation groups
    const groups = {
        errors: document.getElementById('errors-group'),
        warnings: document.getElementById('warnings-group'),
        suggestions: document.getElementById('suggestions-group'),
        passed: document.getElementById('passed-group')
    };

    // Check if any groups are missing
    const missingGroups = Object.entries(groups)
        .filter(([_, element]) => !element)
        .map(([name, _]) => name);

    if (missingGroups.length > 0) {
        console.warn(`Validation groups not found: ${missingGroups.join(', ')}`);
    }

    // Update stat item visual states
    document.querySelectorAll('.stat-item.clickable').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeStatItem = document.querySelector(`[data-filter="${filterValue}"]`);
    if (activeStatItem) {
        activeStatItem.classList.add('active');
    }

    // Apply filter logic
    switch (filterValue) {
        case 'all':
            // Reset all groups and items to their original state
            Object.values(groups).forEach(group => {
                if (!group) return;
                
                // Show group if it has any items
                const hasItems = group.querySelector('.validation-result-item');
                group.style.display = hasItems ? 'block' : 'none';
                
                // Show all items within groups
                const items = group.querySelectorAll('.validation-result-item');
                items.forEach(item => item.style.display = 'flex');
                
                // Reset group counts to original values
                const countElement = group.querySelector('.group-count');
                if (countElement) {
                    countElement.textContent = items.length;
                }
            });
            break;
            
        case 'errors':
            showOnlyGroup('errors', groups);
            break;
            
        case 'warnings':
            showOnlyGroup('warnings', groups);
            break;
            
        case 'suggestions':
            showOnlyGroup('suggestions', groups);
            break;
            
        case 'passed':
            showOnlyGroup('passed', groups);
            // Auto-expand passed group when filtering to it
            const passedGroup = groups.passed;
            const passedContent = document.getElementById('passed-group-content');
            if (passedGroup && passedContent) {
                passedContent.classList.remove('collapsed');
                passedGroup.classList.add('expanded');
            }
            break;
            
        case 'custom':
            filterBySource('custom', groups);
            break;
            
        case 'builtin':
            filterBySource('builtin', groups);
            break;
    }
}

function showOnlyGroup(targetGroupId, groups) {
    Object.entries(groups).forEach(([groupId, group]) => {
        if (group) {
            if (groupId === targetGroupId) {
                // Reset all items in the target group to be visible
                const items = group.querySelectorAll('.validation-result-item');
                items.forEach(item => item.style.display = 'flex');
                
                // Show group if it has any items
                const hasContent = items.length > 0;
                group.style.display = hasContent ? 'block' : 'none';
                
                // Reset group count to show all items
                const countElement = group.querySelector('.group-count');
                if (countElement) {
                    countElement.textContent = items.length;
                }
            } else {
                group.style.display = 'none';
            }
        }
    });
}

function filterBySource(source, groups) {
    // Show all groups but filter their content by source
    Object.values(groups).forEach(group => {
        if (!group) return;
        
        // First show the group (in case it was hidden by a previous filter)
        group.style.display = 'block';
        
        const items = group.querySelectorAll('.validation-result-item');
        let visibleCount = 0;
        
        items.forEach(item => {
            const metricId = item.dataset.metricId;
            const isCustomMetric = metricId && metricId.startsWith('custom.');
            const shouldShow = (source === 'custom') ? isCustomMetric : !isCustomMetric;
            
            item.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) visibleCount++;
        });
        
        // Hide group if no items are visible after filtering
        if (visibleCount === 0) {
            group.style.display = 'none';
        }
        
        // Update group count
        const countElement = group.querySelector('.group-count');
        if (countElement) {
            countElement.textContent = visibleCount;
        }
    });
}

// Compact validation display functions
function displayCompactValidationResults(results) {
    // Use the same grouped display for compact view
    displayGroupedValidationResults(results);
}

function filterValidationResults() {
    // Legacy function - now handled by applyValidationFilter
}

function displayValidationError(message) {
    // Ensure we have a valid error message
    if (!message || typeof message !== 'string') {
        message = 'An unknown validation error occurred. Please check your simulation data.';
    }

    // Add helpful context based on common error types
    let enhancedMessage = message;
    if (message.includes('JSON')) {
        enhancedMessage = `${message}\n\nTip: Check for missing commas, quotes, or brackets in your JSON.`;
    } else if (message.includes('simulation data')) {
        enhancedMessage = `${message}\n\nMake sure your simulation follows the Universal Object Model structure.`;
    }

    const errorResult = [
        {
            metricId: 'validation-error',
            status: 'error',
            message: enhancedMessage
        }
    ];
    displayGroupedValidationResults(errorResult);
}

// Function to insert validation example code
function insertValidationExample(metricId) {
    if (!isMetricsMode) return;
    
    // Get the metric from the catalog to find the function name
    const mergedCatalog = getMergedMetricsCatalog();
    const metric = mergedCatalog.find(m => m.id === metricId);
    
    if (!metric || metric.source !== 'builtin') {
        console.warn('Cannot insert example: metric not found or not builtin');
        return;
    }
    
    const functionName = metric.computation?.function_name || metric.function;
    if (!functionName) {
        console.warn('Cannot insert example: no function name found');
        return;
    }
    
    // Extract the function code from the SimulationValidator class
    const validationCode = extractValidationFunction(functionName);
    if (!validationCode) {
        console.warn('Cannot insert example: function code not found');
        return;
    }
    
    // Generate a custom version of the function
    const customCode = generateCustomValidationCode(metric, functionName, validationCode);
    
    // Insert into the metrics validator editor
    if (window.metricsValidatorEditor) {
        const currentCode = window.metricsValidatorEditor.getValue();
        const newCode = currentCode + '\n\n' + customCode;
        window.metricsValidatorEditor.setValue(newCode);
        
        // Switch to the validator tab and focus
        switchMetricsTab('validator');
        window.metricsValidatorEditor.focus();
        
        // Scroll to the end to show the inserted code
        const lineCount = window.metricsValidatorEditor.getModel().getLineCount();
        window.metricsValidatorEditor.setPosition({ lineNumber: lineCount, column: 1 });
    }
}

// Extract validation function source code from SimulationValidator
function extractValidationFunction(functionName) {
    try {
        // Get the function from the SimulationValidator prototype
        const validatorPrototype = SimulationValidator.prototype;
        const func = validatorPrototype[functionName];
        
        if (typeof func !== 'function') {
            return null;
        }
        
        // Get the function source code
        return func.toString();
    } catch (e) {
        console.error('Error extracting validation function:', e);
        return null;
    }
}

// Generate custom validation code based on builtin function
function generateCustomValidationCode(metric, originalFunctionName, originalCode) {
    // Create a custom function name to avoid conflicts
    const customFunctionName = `custom${originalFunctionName.charAt(0).toUpperCase() + originalFunctionName.slice(1)}`;
    
    // Extract the function body (remove function declaration and outer braces)
    let functionBody = originalCode;
    const functionStart = functionBody.indexOf('{');
    const functionEnd = functionBody.lastIndexOf('}');
    
    if (functionStart !== -1 && functionEnd !== -1) {
        functionBody = functionBody.substring(functionStart + 1, functionEnd);
    }
    
    // Replace references to 'this' with appropriate context
    functionBody = functionBody.replace(/this\.simulation/g, 'this.simulation');
    functionBody = functionBody.replace(/this\.addResult/g, 'this.addResult');
    functionBody = functionBody.replace(/this\._timeToMinutes/g, 'this._timeToMinutes || _timeToMinutes');
    
    // Generate the custom validation function
    const customCode = `/**
 * Custom validation function based on: ${metric.name}
 * Original metric ID: ${metric.id}
 * 
 * This is an example implementation. Customize it for your specific needs.
 */
function ${customFunctionName}(metric) {${functionBody}
}`;

    return customCode;
}

// Check if a builtin metric is disabled
function isMetricDisabled(metricId) {
    try {
        const customCatalog = getCustomMetricsCatalog();
        const disabledMetrics = customCatalog.find(item => item.disabled_metrics);
        return disabledMetrics && disabledMetrics.disabled_metrics.includes(metricId);
    } catch (e) {
        return false;
    }
}

// Disable a builtin metric by adding to disabled_metrics array
function disableBuiltinMetric(metricId) {
    try {
        const customCatalog = getCustomMetricsCatalog();
        
        // Check if already disabled
        if (isMetricDisabled(metricId)) return;
        
        // Find or create disabled_metrics entry
        let disabledMetricsEntry = customCatalog.find(item => item.disabled_metrics);
        
        if (!disabledMetricsEntry) {
            // Create new disabled_metrics entry
            disabledMetricsEntry = {
                disabled_metrics: []
            };
            customCatalog.push(disabledMetricsEntry);
        }
        
        // Add metric ID to disabled list
        if (!disabledMetricsEntry.disabled_metrics.includes(metricId)) {
            disabledMetricsEntry.disabled_metrics.push(metricId);
        }
        
        // Update the catalog in localStorage and editor
        const catalogJson = JSON.stringify(customCatalog, null, 2);
        try {
            localStorage.setItem('uaw-metrics-catalog-custom', catalogJson);
        } catch (e) {
            console.error('Error saving custom metrics catalog:', e.message);
        }
        
        if (window.metricsCatalogEditor) {
            window.metricsCatalogEditor.setValue(catalogJson);
        }
        
        // Re-run validation to reflect the change
        if (typeof runCustomValidation === 'function') {
            runCustomValidation();
        } else {
            // If not in custom validation mode, refresh current validation display
            refreshValidationDisplay();
        }
        
    } catch (e) {
        console.error('Error disabling metric:', e);
    }
}

// Enable a builtin metric by removing from disabled_metrics array
function enableBuiltinMetric(metricId) {
    try {
        const customCatalog = getCustomMetricsCatalog();
        
        // Find disabled_metrics entry
        const disabledMetricsEntry = customCatalog.find(item => item.disabled_metrics);
        
        if (disabledMetricsEntry && disabledMetricsEntry.disabled_metrics) {
            // Remove metric ID from disabled list
            const index = disabledMetricsEntry.disabled_metrics.indexOf(metricId);
            if (index > -1) {
                disabledMetricsEntry.disabled_metrics.splice(index, 1);
            }
            
            // Remove the entire disabled_metrics entry if it's empty
            if (disabledMetricsEntry.disabled_metrics.length === 0) {
                const entryIndex = customCatalog.indexOf(disabledMetricsEntry);
                if (entryIndex > -1) {
                    customCatalog.splice(entryIndex, 1);
                }
            }
        }
        
        // Update the catalog in localStorage and editor
        const catalogJson = JSON.stringify(customCatalog, null, 2);
        try {
            localStorage.setItem('uaw-metrics-catalog-custom', catalogJson);
        } catch (e) {
            console.error('Error saving custom metrics catalog:', e.message);
        }
        
        if (window.metricsCatalogEditor) {
            window.metricsCatalogEditor.setValue(catalogJson);
        }
        
        // Re-run validation to reflect the change
        if (typeof runCustomValidation === 'function') {
            runCustomValidation();
        } else {
            // If not in custom validation mode, refresh current validation display
            refreshValidationDisplay();
        }
        
    } catch (e) {
        console.error('Error enabling metric:', e);
    }
}

// Refresh the current validation display (re-run validation to update buttons/visibility)
function refreshValidationDisplay() {
    try {
        // Check if getCurrentSimulationData function exists
        if (typeof getCurrentSimulationData !== 'function') {
            console.error('getCurrentSimulationData function not available');
            displayValidationError('Unable to access simulation data. Please reload the page.');
            return;
        }

        // Get current simulation data
        const currentSimulationData = getCurrentSimulationData();
        if (!currentSimulationData) {
            // No simulation to validate, clear display
            displayValidationError('No simulation data available. Load or create a simulation to validate.');
            return;
        }

        // Re-run validation with current data
        if (isMetricsMode && typeof runCustomValidation === 'function') {
            // In metrics mode, use custom validation
            runCustomValidation();
        } else {
            // In standard mode, use built-in validation
            if (typeof validateJSON === 'function') {
                validateJSON();
            } else if (typeof window.validateJSON === 'function') {
                window.validateJSON();
            } else {
                // Fallback: run validation manually
                const mergedCatalog = getMergedMetricsCatalog();
                if (!mergedCatalog || mergedCatalog.length === 0) {
                    displayValidationError('No validation metrics available. Check metrics catalog.');
                    return;
                }

                if (typeof SimulationValidator !== 'function') {
                    console.error('SimulationValidator class not available');
                    displayValidationError('Validation engine not loaded. Please reload the page.');
                    return;
                }

                const validator = new SimulationValidator(currentSimulationData);
                const results = validator.runChecks(mergedCatalog);
                displayValidationResults(results);
            }
        }
    } catch (e) {
        console.error('Error refreshing validation display:', e);
        displayValidationError(`Error refreshing validation: ${e.message}`);
    }
}

// Jump to the referenced JSON location from a validation message
function jumpToValidationTarget(message) {
    // Validate input
    if (!message || typeof message !== 'string') {
        console.warn('Invalid message passed to jumpToValidationTarget');
        return;
    }

    // Extract task or object IDs from validation messages using various patterns
    let targetId = null;
    let targetType = null;

    // Define all patterns to check - reduces code duplication
    const patterns = [
        { regex: /Task '([^']+)'/, type: 'task' },
        { regex: /Object '([^']+)'/, type: 'object' },
        { regex: /Actor '([^']+)'/, type: 'object' },
        { regex: /Equipment '([^']+)'/, type: 'object' },
        { regex: /Resource '([^']+)'/, type: 'object' },
        { regex: /Product '([^']+)'/, type: 'object' },
        { regex: /Location '([^']+)'/, type: 'object' }
    ];

    // Find the first matching pattern
    for (const pattern of patterns) {
        const match = message.match(pattern.regex);
        if (match && match[1]) {
            targetId = match[1];
            targetType = pattern.type;
            break;
        }
    }

    // If we found a target, try to jump to it
    if (targetId && targetType) {
        try {
            if (targetType === 'task' && typeof scrollToTaskInJSON === 'function') {
                scrollToTaskInJSON(targetId);
            } else if (targetType === 'object' && typeof scrollToObjectInJSON === 'function') {
                scrollToObjectInJSON(targetId);
            } else {
                console.warn(`Jump function not available for type: ${targetType}`);
            }
        } catch (error) {
            console.error(`Error jumping to ${targetType} '${targetId}':`, error);
        }
    } else {
        console.log('No jumpable target found in validation message:', message);
    }
}
