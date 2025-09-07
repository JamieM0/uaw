// Playground Validation - Validation display and filtering
// Universal Automation Wiki - Simulation Playground

// Display validation results
function displayValidationResults(results) {
    // Use the new grouped validation display
    displayGroupedValidationResults(results);
}

function displayGroupedValidationResults(results) {
    const compactContainer = document.getElementById("validation-compact");
    if (!compactContainer) return;

    // Calculate stats for each category
    const stats = {
        total: results.length,
        errors: results.filter(r => r.status === 'error').length,
        warnings: results.filter(r => r.status === 'warning').length,
        suggestions: results.filter(r => r.status === 'suggestion').length,
        success: results.filter(r => r.status === 'success').length
    };

    // Update stat counters
    updateValidationStats(stats);

    // Group results by status
    const grouped = {
        errors: results.filter(r => r.status === 'error'),
        warnings: results.filter(r => r.status === 'warning'), 
        suggestions: results.filter(r => r.status === 'suggestion'),
        success: results.filter(r => r.status === 'success')
    };

    // Display grouped results
    displayValidationGroup('errors', grouped.errors, '❌');
    displayValidationGroup('warnings', grouped.warnings, '⚠️');
    displayValidationGroup('suggestions', grouped.suggestions, '💡');
    displayValidationGroup('passed', grouped.success, '✅', false); // show passed messages by default

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

function displayValidationGroup(groupId, results, icon, collapsedByDefault = false) {
    const groupElement = document.getElementById(`${groupId}-group`);
    const contentElement = document.getElementById(`${groupId}-group-content`);

    if (!groupElement || !contentElement) return;

    // Show/hide group based on whether it has results
    if (results.length > 0) {
        groupElement.style.display = 'block';

        // Sort results to float custom metrics to the top
        const mergedCatalog = getMergedMetricsCatalog();
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
            const statusIcon = getStatusIcon(result.status);
            const metricName = getMetricDisplayName(result.metricId);
            
            return `
                <div class="validation-result-item ${result.status}" data-metric-id="${result.metricId}">
                    <div class="validation-result-status ${result.status}"></div>
                    <div class="validation-result-details">
                        <div class="validation-result-name">
                            ${metricName} <span class="validation-message-inline">— ${result.message}</span>
                        </div>
                    </div>
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

function getStatusIcon(status) {
    // Return empty string since we'll use CSS for visual indicators
    return '';
}

function getMetricDisplayName(metricId) {
    // Try to get a more friendly name from the merged metrics catalog
    const mergedCatalog = getMergedMetricsCatalog();
    const metric = mergedCatalog.find(m => m.id === metricId);
    
    if (!metric) {
        return metricId;
    }
    
    // For custom metrics, show ID; for built-in, show name
    const displayName = metric.source === 'custom' ? metric.id : metric.name;
    
    return displayName;
}

function setupValidationInteractions() {
    // Use event delegation to avoid needing to re-attach listeners
    // Remove any existing delegated listeners first
    const validationContainer = document.querySelector('.validation-panel');
    if (validationContainer && !validationContainer.hasAttribute('data-validation-listeners-attached')) {
        
        // Delegated event listener for stat items
        validationContainer.addEventListener('click', (e) => {
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
        });
        
        // Setup filter dropdown (only once)
        const filterSelect = document.getElementById('validation-filter');
        if (filterSelect && !filterSelect.hasAttribute('data-listener-attached')) {
            filterSelect.addEventListener('change', applyValidationFilter);
            filterSelect.setAttribute('data-listener-attached', 'true');
        }
        
        validationContainer.setAttribute('data-validation-listeners-attached', 'true');
    }
}

function applyValidationFilter() {
    const filterSelect = document.getElementById('validation-filter');
    const filterValue = filterSelect?.value || 'all';

    // Get all validation groups
    const groups = {
        errors: document.getElementById('errors-group'),
        warnings: document.getElementById('warnings-group'),
        suggestions: document.getElementById('suggestions-group'),
        passed: document.getElementById('passed-group')
    };

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
    const errorResult = [
        {
            metricId: 'json-syntax',
            status: 'error',
            message: message
        }
    ];
    displayGroupedValidationResults(errorResult);
}