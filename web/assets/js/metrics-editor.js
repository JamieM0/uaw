// Global state
let jsonEditor = null;
let jsEditor = null;
let currentMetricsCatalog = [];
let selectedMetric = null;
let testSimulationData = null;
let isRightPanelVisible = true;
let parameterCounter = 0;
let debounceTimeout = null;

// Initialize Monaco Editor with better error handling
console.log('Setting up Monaco Editor configuration...');

// Check if require is available
if (typeof require === 'undefined') {
    console.error('RequireJS is not loaded - Monaco Editor cannot initialize');
} else {
    require.config({ 
        paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' },
        timeout: 30 // 30 seconds timeout
    });
    console.log('Monaco Editor configuration set');
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, attempting to load Monaco Editor...');
    
    // Fallback initialization without Monaco if it fails to load
    function initializeWithoutMonaco() {
        console.warn('Initializing without Monaco Editor - using fallback textareas');
        createFallbackEditors();
        loadDefaultData();
        initializeEventHandlers();
        initializeResizeHandles();
    }
    
    // Try to load Monaco Editor
    if (typeof require === 'undefined') {
        console.error('RequireJS not available, using fallback');
        initializeWithoutMonaco();
        return;
    }
    
    require(['vs/editor/editor.main'], function() {
        console.log('Monaco Editor loaded successfully');
        initializeEditors();
        loadDefaultData();
        initializeEventHandlers();
        initializeResizeHandles();
    }, function(err) {
        console.error('Failed to load Monaco Editor:', err);
        console.log('Falling back to textarea editors');
        initializeWithoutMonaco();
    });
});

function initializeEditors() {
    try {
        console.log('Initializing Monaco editors...');
        
        // Check if Monaco is available
        if (typeof monaco === 'undefined') {
            throw new Error('Monaco Editor is not available');
        }
        
        // Check if containers exist
        const jsonContainer = document.getElementById('jsonEditorContainer');
        const jsContainer = document.getElementById('jsEditorContainer');
        
        if (!jsonContainer) {
            throw new Error('JSON editor container not found');
        }
        if (!jsContainer) {
            throw new Error('JS editor container not found');
        }
        
        console.log('Editor containers found, creating Monaco editors...');
        
        // Clear containers first
        jsonContainer.innerHTML = '';
        jsContainer.innerHTML = '';
        
        // JSON Editor for metrics catalog
        jsonEditor = monaco.editor.create(jsonContainer, {
            value: '[]',
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            fontSize: 12
        });

        // JavaScript Editor for validation logic
        jsEditor = monaco.editor.create(jsContainer, {
            value: getDefaultValidationCode(),
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            fontSize: 12
        });
        
        // Verify editors were created
        if (!jsonEditor || !jsEditor) {
            throw new Error('Failed to create Monaco editors');
        }
        
        console.log('Monaco editors created successfully');
        
        // Set up event handlers with debouncing
        if (jsonEditor) {
            jsonEditor.onDidChangeModelContent(() => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    validateJsonSyntax();
                    updateVisualCatalog();
                }, 300);
            });
        }

        if (jsEditor) {
            jsEditor.onDidChangeModelContent(() => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    updateFunctionDropdown();
                }, 500);
            });
        }

        logToConsole('actionsConsole', 'Monaco editors initialized successfully', 'success');
    } catch (error) {
        console.error('Error initializing Monaco editors:', error);
        console.log('Falling back to textarea editors due to error:', error.message);
        createFallbackEditors();
    }
}

function createFallbackEditors() {
    console.log('Creating fallback textarea editors...');
    
    // Create fallback JSON editor
    const jsonContainer = document.getElementById('jsonEditorContainer');
    if (jsonContainer) {
        jsonContainer.innerHTML = `
            <textarea id="fallback-json-editor" style="width: 100%; height: 100%; border: none; resize: none; font-family: monospace; padding: 8px; background: #1e1e1e; color: #d4d4d4;">[]</textarea>
        `;
        
        // Create a mock editor object
        jsonEditor = {
            getValue: () => document.getElementById('fallback-json-editor').value,
            setValue: (value) => document.getElementById('fallback-json-editor').value = value,
            onDidChangeModelContent: (callback) => {
                document.getElementById('fallback-json-editor').addEventListener('input', callback);
            },
            layout: () => {}, // No-op for layout
            revealLineInCenter: () => {}, // No-op
            setSelection: () => {} // No-op
        };
        console.log('Fallback JSON editor created');
    }
    
    // Create fallback JS editor
    const jsContainer = document.getElementById('jsEditorContainer');
    if (jsContainer) {
        jsContainer.innerHTML = `
            <textarea id="fallback-js-editor" style="width: 100%; height: 100%; border: none; resize: none; font-family: monospace; padding: 8px; background: #1e1e1e; color: #d4d4d4;">${getDefaultValidationCode()}</textarea>
        `;
        
        // Create a mock editor object
        jsEditor = {
            getValue: () => document.getElementById('fallback-js-editor').value,
            setValue: (value) => document.getElementById('fallback-js-editor').value = value,
            onDidChangeModelContent: (callback) => {
                document.getElementById('fallback-js-editor').addEventListener('input', callback);
            },
            layout: () => {}, // No-op for layout
            getAction: () => ({ run: () => {} }) // No-op for formatting
        };
        console.log('Fallback JS editor created');
    }
    
    logToConsole('actionsConsole', 'Fallback editors initialized (Monaco Editor not available)', 'warning');
}

function getDefaultValidationCode() {
    return `// Custom Metrics Validation Functions
// Extend the base SimulationValidator class to add your custom validation logic

class CustomSimulationValidator extends SimulationValidator {
    
    // Example: Validate task execution time efficiency
    validateExecutionTime(metric) {
        const tasks = this.simulation.tasks || [];
        const params = metric.computation?.params || {};
        const maxDelayPercent = params.max_delay_percent || 20;
        
        let issues = 0;
        tasks.forEach(task => {
            const expectedDuration = task.duration || 0;
            const actualDuration = task.actual_duration || expectedDuration;
            const delayPercent = ((actualDuration - expectedDuration) / expectedDuration) * 100;
            
            if (delayPercent > maxDelayPercent) {
                issues++;
                this.addResult({ 
                    metricId: metric.id, 
                    status: 'warning', 
                    message: \`Task "\${task.id}" exceeded expected time by \${delayPercent.toFixed(1)}%\`
                });
            }
        });
        
        if (issues === 0) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: \`All \${tasks.length} tasks completed within expected time limits\`
            });
        }
    }
    
    // Example: Validate output quality standards
    validateOutputQuality(metric) {
        const tasks = this.simulation.tasks || [];
        let qualityIssues = 0;
        
        tasks.forEach(task => {
            const outputs = task.outputs || [];
            outputs.forEach(output => {
                if (output.quality_score && output.quality_score < 0.8) {
                    qualityIssues++;
                    this.addResult({ 
                        metricId: metric.id, 
                        status: 'error', 
                        message: \`Task "\${task.id}" output "\${output.name}" has low quality score: \${output.quality_score}\`
                    });
                }
            });
        });
        
        if (qualityIssues === 0) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: 'All task outputs meet quality standards'
            });
        }
    }
    
    // Example: Calculate resource efficiency ratio
    validateResourceEfficiency(metric) {
        const params = metric.computation?.params || {};
        const targetEfficiency = params.target_efficiency || 0.85;
        
        const resources = this.simulation.consumable_resources || [];
        const tasks = this.simulation.tasks || [];
        
        let totalUsed = 0;
        let totalAvailable = 0;
        
        resources.forEach(resource => {
            totalAvailable += resource.stock || 0;
            
            tasks.forEach(task => {
                const consumables = task.consumables || [];
                const usage = consumables.find(c => c.name === resource.name);
                if (usage) {
                    totalUsed += usage.quantity || 0;
                }
            });
        });
        
        const efficiency = totalAvailable > 0 ? totalUsed / totalAvailable : 0;
        
        if (efficiency >= targetEfficiency) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: \`Resource efficiency: \${(efficiency * 100).toFixed(1)}% (target: \${(targetEfficiency * 100)}%)\`
            });
        } else {
            this.addResult({ 
                metricId: metric.id, 
                status: 'warning', 
                message: \`Low resource efficiency: \${(efficiency * 100).toFixed(1)}% (target: \${(targetEfficiency * 100)}%)\`
            });
        }
    }
    
    // Example: Check hazard proximity safety
    validateHazardProximity(metric) {
        const params = metric.computation?.params || {};
        const minSafetyDistance = params.min_safety_distance || 5;
        
        const layout = this.simulation.layout || {};
        const locations = layout.locations || [];
        const tasks = this.simulation.tasks || [];
        
        let safetyViolations = 0;
        
        tasks.forEach(task => {
            if (task.hazard_level && task.hazard_level > 0) {
                const taskLocation = locations.find(loc => loc.id === task.location);
                if (taskLocation) {
                    // Check for nearby actors or equipment
                    const nearbyObjects = this.findNearbyObjects(taskLocation, minSafetyDistance);
                    if (nearbyObjects.length > 1) { // More than just the hazardous task itself
                        safetyViolations++;
                        this.addResult({ 
                            metricId: metric.id, 
                            status: 'error', 
                            message: \`Hazardous task "\${task.id}" has \${nearbyObjects.length - 1} objects within \${minSafetyDistance}m safety zone\`
                        });
                    }
                }
            }
        });
        
        if (safetyViolations === 0) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: 'All hazardous tasks maintain adequate safety distances'
            });
        }
    }
    
    // Example: Detect workflow bottlenecks
    detectWorkflowBottlenecks(metric) {
        const params = metric.computation?.params || {};
        const thresholdMinutes = params.threshold_minutes || 30;
        
        const tasks = this.simulation.tasks || [];
        const actors = this.simulation.actors || [];
        
        // Analyze actor workload distribution
        const actorWorkloads = {};
        actors.forEach(actor => {
            actorWorkloads[actor.id] = {
                totalTime: 0,
                taskCount: 0,
                tasks: []
            };
        });
        
        tasks.forEach(task => {
            const actorId = task.assigned_to;
            if (actorId && actorWorkloads[actorId]) {
                const duration = task.duration || 0;
                actorWorkloads[actorId].totalTime += duration;
                actorWorkloads[actorId].taskCount++;
                actorWorkloads[actorId].tasks.push(task);
            }
        });
        
        // Identify bottlenecks
        let bottlenecks = 0;
        const avgWorkload = Object.values(actorWorkloads).reduce((sum, wl) => sum + wl.totalTime, 0) / actors.length;
        
        Object.entries(actorWorkloads).forEach(([actorId, workload]) => {
            if (workload.totalTime > avgWorkload + thresholdMinutes) {
                bottlenecks++;
                this.addResult({ 
                    metricId: metric.id, 
                    status: 'warning', 
                    message: \`Actor "\${actorId}" is overloaded with \${workload.totalTime}min of work (avg: \${avgWorkload.toFixed(1)}min)\`
                });
            }
        });
        
        if (bottlenecks === 0) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: 'Workload is evenly distributed across all actors'
            });
        }
    }
    
    // Example: Validate budget compliance
    validateBudgetCompliance(metric) {
        const params = metric.computation?.params || {};
        const maxBudget = params.max_budget || 10000;
        const currency = params.currency || 'USD';
        
        const tasks = this.simulation.tasks || [];
        const resources = this.simulation.consumable_resources || [];
        const actors = this.simulation.actors || [];
        
        let totalCost = 0;
        
        // Calculate labor costs
        tasks.forEach(task => {
            const actor = actors.find(a => a.id === task.assigned_to);
            if (actor && actor.hourly_rate) {
                const hours = (task.duration || 0) / 60;
                totalCost += hours * actor.hourly_rate;
            }
            
            // Calculate material costs
            const consumables = task.consumables || [];
            consumables.forEach(consumable => {
                const resource = resources.find(r => r.name === consumable.name);
                if (resource && resource.cost_per_unit) {
                    totalCost += (consumable.quantity || 0) * resource.cost_per_unit;
                }
            });
        });
        
        if (totalCost <= maxBudget) {
            this.addResult({ 
                metricId: metric.id, 
                status: 'success', 
                message: \`Total cost \${totalCost.toFixed(2)} \${currency} is within budget (\${maxBudget} \${currency})\`
            });
        } else {
            const overrun = totalCost - maxBudget;
            this.addResult({ 
                metricId: metric.id, 
                status: 'error', 
                message: \`Budget exceeded by \${overrun.toFixed(2)} \${currency} (total: \${totalCost.toFixed(2)}, budget: \${maxBudget})\`
            });
        }
    }
    
    // Helper method to find nearby objects (simplified implementation)
    findNearbyObjects(location, distance) {
        // This is a simplified implementation
        // In a real scenario, you would calculate actual distances between objects
        return [location]; // Return at least the location itself
    }
}`;
}

function loadDefaultData() {
    // Load default metrics catalog
    fetch('/assets/static/metrics-catalog.json')
        .then(response => response.json())
        .then(data => {
            currentMetricsCatalog = data;
            jsonEditor.setValue(JSON.stringify(data, null, 2));
            updateVisualCatalog();
            logToConsole('actionsConsole', 'Loaded default metrics catalog', 'success');
        })
        .catch(error => {
            logToConsole('actionsConsole', 'Error loading default metrics catalog: ' + error.message, 'error');
        });
}

function loadCustomData() {
    // Load custom metrics catalog
    fetch('/assets/static/metrics-catalog-custom.json')
        .then(response => response.json())
        .then(data => {
            currentMetricsCatalog = data;
            jsonEditor.setValue(JSON.stringify(data, null, 2));
            updateVisualCatalog();
            logToConsole('actionsConsole', 'Loaded custom metrics catalog', 'success');
        })
        .catch(error => {
            logToConsole('actionsConsole', 'Error loading custom metrics catalog: ' + error.message, 'error');
        });
}

function updateVisualCatalog() {
    try {
        const catalogData = JSON.parse(jsonEditor.getValue());
        const catalogContainer = document.getElementById('visualCatalog');
        catalogContainer.innerHTML = '';

        if (Array.isArray(catalogData)) {
            const categories = {};
            
            // Group metrics by category
            catalogData.forEach(metric => {
                const category = metric.category || 'Uncategorized';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(metric);
            });

            // Create category sections
            Object.keys(categories).sort().forEach(categoryName => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'metric-category';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'category-header';
                headerDiv.innerHTML = `<span class="expand-icon">▶</span>${categoryName}`;
                headerDiv.onclick = () => toggleCategory(categoryName);
                categoryDiv.appendChild(headerDiv);

                const listDiv = document.createElement('div');
                listDiv.className = 'metric-list';
                listDiv.id = `category-${categoryName.replace(/\s+/g, '-')}`;

                categories[categoryName].forEach(metric => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'metric-item';
                    itemDiv.setAttribute('data-metric-id', metric.id);
                    itemDiv.onclick = () => selectMetric(metric.id);
                    
                    const isCustom = metric.id.startsWith('custom.');
                    const severityClass = `severity-${metric.severity || 'info'}`;
                    
                    itemDiv.innerHTML = `
                        <div class="metric-content">
                            <div class="metric-name">${metric.name || metric.id}</div>
                            <div class="metric-description">${metric.description || ''}</div>
                        </div>
                        <div class="metric-badges">
                            <div class="metric-badge ${severityClass}">${metric.severity || 'info'}</div>
                            ${isCustom ? '<div class="metric-badge source-custom">custom</div>' : ''}
                        </div>
                    `;
                    
                    listDiv.appendChild(itemDiv);
                });

                categoryDiv.appendChild(listDiv);
                catalogContainer.appendChild(categoryDiv);
            });

            logToConsole('structureConsole', `Updated visual catalog with ${catalogData.length} metrics`, 'info');
        }
    } catch (error) {
        logToConsole('actionsConsole', 'Error updating visual catalog: ' + error.message, 'error');
    }
}

function toggleCategory(categoryName) {
    const categoryId = `category-${categoryName.replace(/\s+/g, '-')}`;
    const header = document.querySelector(`[onclick*="${categoryName}"]`);
    const list = document.getElementById(categoryId);
    
    if (header && list) {
        header.classList.toggle('expanded');
        list.classList.toggle('expanded');
    }
}

function selectMetric(metricId) {
    // Remove previous selection
    document.querySelectorAll('.metric-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selection to clicked item
    const selectedItem = document.querySelector(`[data-metric-id="${metricId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }

    selectedMetric = metricId;
    logToConsole('actionsConsole', `Selected metric: ${metricId}`, 'info');
    
    // Optionally scroll to the metric in JSON editor
    highlightMetricInJson(metricId);
}

function highlightMetricInJson(metricId) {
    try {
        const jsonContent = jsonEditor.getValue();
        const lines = jsonContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`"id": "${metricId}"`)) {
                jsonEditor.revealLineInCenter(i + 1);
                jsonEditor.setSelection(new monaco.Range(i + 1, 1, i + 1, lines[i].length + 1));
                break;
            }
        }
    } catch (error) {
        // Ignore errors in highlighting
    }
}

function updateFunctionDropdown() {
    const code = jsEditor.getValue();
    const dropdown = document.getElementById('functionDropdown');
    const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{)/g;
    
    dropdown.innerHTML = '<option value="">Select function...</option>';
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
        const functionName = match[1] || match[2];
        if (functionName) {
            const option = document.createElement('option');
            option.value = functionName;
            option.textContent = functionName;
            dropdown.appendChild(option);
        }
    }
}

function jumpToFunction() {
    const dropdown = document.getElementById('functionDropdown');
    const selectedFunction = dropdown.value;
    
    if (selectedFunction) {
        const code = jsEditor.getValue();
        const regex = new RegExp(`(?:function\\s+${selectedFunction}|${selectedFunction}\\s*\\([^)]*\\)\\s*\\{)`, 'g');
        const match = regex.exec(code);
        
        if (match) {
            const lines = code.substring(0, match.index).split('\n');
            const lineNumber = lines.length;
            
            jsEditor.setPosition({ lineNumber, column: 1 });
            jsEditor.revealLineInCenter(lineNumber);
            jsEditor.focus();
        }
    }
}

function validateJsonSyntax() {
    try {
        JSON.parse(jsonEditor.getValue());
        logToConsole('structureConsole', 'JSON syntax is valid', 'success');
    } catch (error) {
        logToConsole('structureConsole', 'JSON syntax error: ' + error.message, 'error');
    }
}

function initializeEventHandlers() {
    // Header buttons
    document.getElementById('load-default-btn').onclick = loadDefaultData;
    document.getElementById('load-custom-btn').onclick = loadCustomData;
    document.getElementById('import-package-btn').onclick = importMetricsPackage;
    document.getElementById('export-package-btn').onclick = exportMetricsPackage;
    // Format JSON button (now in JSON editor panel)\n    const formatJsonBtn = document.getElementById('format-json-btn');\n    if (formatJsonBtn) {\n        formatJsonBtn.onclick = formatJson;\n    }
    document.getElementById('validate-all-btn').onclick = validateAll;
    document.getElementById('toggle-right-panel-btn').onclick = toggleRightPanel;
    document.getElementById('add-metric-btn').onclick = showAddMetricModal;
    document.getElementById('remove-metric-btn').onclick = removeSelectedMetric;

    // Panel buttons
    document.getElementById('refresh-catalog-btn').onclick = updateVisualCatalog;
    document.getElementById('expand-all-btn').onclick = expandAllCategories;
    document.getElementById('collapse-all-btn').onclick = collapseAllCategories;
    document.getElementById('validate-json-btn').onclick = validateJsonSyntax;
    document.getElementById('format-json-btn').onclick = formatJson;
    document.getElementById('format-js-btn').onclick = formatJavaScript;
    document.getElementById('check-syntax-btn').onclick = checkJavaScriptSyntax;
    document.getElementById('load-sample-btn').onclick = () => loadSimulation('bake_bread');
    document.getElementById('clear-data-btn').onclick = clearTestData;
    document.getElementById('clear-console-btn').onclick = clearConsole;
    document.getElementById('run-validation-btn').onclick = runValidation;

    // Function dropdown
    document.getElementById('functionDropdown').onchange = jumpToFunction;

    // Sample simulations
    document.querySelectorAll('.sample-simulation').forEach(elem => {
        elem.onclick = () => loadSimulation(elem.dataset.sample);
    });

    // Modal handlers
    document.getElementById('metric-cancel-btn').onclick = hideAddMetricModal;
    document.getElementById('metric-add-btn').onclick = confirmAddMetric;
    document.getElementById('add-param-btn').onclick = addParameter;

    // Auto-suggest handlers
    document.getElementById('metric-name-input').oninput = updateIdSuggestion;
    document.getElementById('metric-category-input').oninput = updateIdSuggestion;
    document.getElementById('metric-id-input').oninput = updateFunctionSuggestion;

    // Close modal when clicking outside
    document.getElementById('add-metric-modal').onclick = function(e) {
        if (e.target === this) hideAddMetricModal();
    };
}

function expandAllCategories() {
    document.querySelectorAll('.category-header').forEach(header => {
        header.classList.add('expanded');
    });
    document.querySelectorAll('.metric-list').forEach(list => {
        list.classList.add('expanded');
    });
}

function collapseAllCategories() {
    document.querySelectorAll('.category-header').forEach(header => {
        header.classList.remove('expanded');
    });
    document.querySelectorAll('.metric-list').forEach(list => {
        list.classList.remove('expanded');
    });
}

function toggleRightPanel() {
    const container = document.getElementById('metricsEditorContainer');
    const panel = document.getElementById('rightPanel');
    const toggleText = document.getElementById('right-panel-toggle-text');
    
    if (!container || !panel || !toggleText) {
        console.error('Required elements not found for panel toggle');
        return;
    }
    
    isRightPanelVisible = !isRightPanelVisible;
    
    if (isRightPanelVisible) {
        container.classList.remove('right-panel-hidden');
        panel.classList.remove('hidden');
        toggleText.textContent = '👁️‍🗨️ Hide Test Data';
        // Reset to default 3-column layout
        container.style.gridTemplateColumns = '25% 40% 35%';
    } else {
        container.classList.add('right-panel-hidden');
        panel.classList.add('hidden');
        toggleText.textContent = '👁️ Show Test Data';
        // Redistribute space between left and center panels
        container.style.gridTemplateColumns = '30% 70%';
    }
    
    // Update Monaco editors after layout change
    setTimeout(() => {
        try {
            if (jsonEditor && typeof jsonEditor.layout === 'function') {
                jsonEditor.layout();
            }
            if (jsEditor && typeof jsEditor.layout === 'function') {
                jsEditor.layout();
            }
        } catch (error) {
            console.warn('Error updating editor layout after panel toggle:', error);
        }
    }, 100);
}

function showAddMetricModal() {
    document.getElementById('add-metric-modal').style.display = 'flex';
    // Clear form
    clearAddMetricForm();
}

function hideAddMetricModal() {
    document.getElementById('add-metric-modal').style.display = 'none';
    clearAddMetricForm();
}

function clearAddMetricForm() {
    ['metric-id-input', 'metric-category-input', 'metric-name-input', 
     'metric-description-input', 'metric-validation-input'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
    document.getElementById('metric-severity-select').selectedIndex = 0;
    document.getElementById('parameters-container').innerHTML = '';
    document.getElementById('id-suggestion').textContent = '';
    document.getElementById('function-suggestion').textContent = '';
    parameterCounter = 0;
}

function updateIdSuggestion() {
    const name = document.getElementById('metric-name-input').value.trim();
    const category = document.getElementById('metric-category-input').value.trim();
    
    if (name && category) {
        const categorySlug = category.toLowerCase().replace(/\s+/g, '_');
        const nameSlug = name.toLowerCase().replace(/\s+/g, '_');
        const suggestion = `custom.${categorySlug}.${nameSlug}`;
        
        document.getElementById('id-suggestion').textContent = `Suggested: ${suggestion}`;
        
        // Auto-fill if ID field is empty
        const idInput = document.getElementById('metric-id-input');
        if (!idInput.value.trim()) {
            idInput.value = suggestion;
        }
    }
}

function updateFunctionSuggestion() {
    const id = document.getElementById('metric-id-input').value.trim();
    if (id) {
        const parts = id.split('.');
        const lastPart = parts[parts.length - 1];
        const suggestion = `validate${lastPart.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)).join('')}`;
        
        document.getElementById('function-suggestion').textContent = `Suggested: ${suggestion}`;
        
        // Auto-fill if function field is empty
        const funcInput = document.getElementById('metric-validation-input');
        if (!funcInput.value.trim()) {
            funcInput.value = suggestion;
        }
    }
}

function addParameter() {
    const container = document.getElementById('parameters-container');
    const paramRow = document.createElement('div');
    paramRow.className = 'parameter-row';
    paramRow.innerHTML = `
        <input type="text" placeholder="Parameter name" class="param-key">
        <input type="text" placeholder="Parameter value" class="param-value">
        <button type="button" class="btn-remove-param" onclick="removeParameter(this)">×</button>
    `;
    container.appendChild(paramRow);
    parameterCounter++;
}

function removeParameter(button) {
    button.parentElement.remove();
}

function confirmAddMetric() {
    const id = document.getElementById('metric-id-input').value.trim();
    const category = document.getElementById('metric-category-input').value.trim();
    const name = document.getElementById('metric-name-input').value.trim();
    const description = document.getElementById('metric-description-input').value.trim();
    const severity = document.getElementById('metric-severity-select').value;
    const functionName = document.getElementById('metric-validation-input').value.trim();

    // Validation
    if (!id || !name || !functionName) {
        alert('Metric ID, Name, and Function Name are required');
        return;
    }

    if (!id.match(/^[a-z_][a-z0-9_.]*$/)) {
        alert('Metric ID must start with a letter or underscore and contain only lowercase letters, numbers, underscores, and dots');
        return;
    }

    try {
        const catalogData = JSON.parse(jsonEditor.getValue());
        
        // Check for duplicate ID
        if (catalogData.find(m => m.id === id)) {
            alert('A metric with this ID already exists');
            return;
        }

        // Collect parameters
        const params = {};
        const paramRows = document.querySelectorAll('#parameters-container .parameter-row');
        paramRows.forEach(row => {
            const keyInput = row.querySelector('.param-key');
            const valueInput = row.querySelector('.param-value');
            if (keyInput.value.trim() && valueInput.value.trim()) {
                let value = valueInput.value.trim();
                // Try to parse as number or boolean
                if (!isNaN(value)) {
                    value = parseFloat(value);
                } else if (value === 'true' || value === 'false') {
                    value = value === 'true';
                }
                params[keyInput.value.trim()] = value;
            }
        });

        const newMetric = {
            id: id,
            name: name,
            description: description,
            category: category || 'General',
            severity: severity,
            validation_type: 'computational',
            computation: {
                engine: 'javascript',
                function_name: functionName
            }
        };

        // Add parameters if any
        if (Object.keys(params).length > 0) {
            newMetric.computation.params = params;
        }

        catalogData.push(newMetric);
        jsonEditor.setValue(JSON.stringify(catalogData, null, 2));
        hideAddMetricModal();
        
        logToConsole('actionsConsole', `Added new metric: ${id}`, 'success');
    } catch (error) {
        logToConsole('actionsConsole', 'Error adding metric: ' + error.message, 'error');
    }
}

function removeSelectedMetric() {
    if (!selectedMetric) {
        alert('Please select a metric to remove');
        return;
    }

    if (confirm(`Are you sure you want to remove the metric "${selectedMetric}"?`)) {
        try {
            const catalogData = JSON.parse(jsonEditor.getValue());
            const filteredData = catalogData.filter(metric => metric.id !== selectedMetric);
            jsonEditor.setValue(JSON.stringify(filteredData, null, 2));
            const removedMetric = selectedMetric;
            selectedMetric = null;
            logToConsole('actionsConsole', `Removed metric: ${removedMetric}`, 'success');
        } catch (error) {
            logToConsole('actionsConsole', 'Error removing metric: ' + error.message, 'error');
        }
    }
}

function loadSimulation(type) {
    let simulationPath = '';
    
    switch(type) {
        case 'bake_bread':
            simulationPath = '/routines/examples/bake_bread_95423d6a-5c82-4184-8564-e58197f25a0b/simulation.json';
            break;
        case 'dyson_sphere':
            simulationPath = '/routines/examples/construct_dyson_sphere_f611aa55-0c84-4c69-979d-426194970e06/simulation.json';
            break;
        default:
            // For custom, show file input dialog
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            testSimulationData = JSON.parse(e.target.result);
                            logToConsole('actionsConsole', `Loaded custom simulation: ${file.name}`, 'success');
                        } catch (error) {
                            logToConsole('actionsConsole', 'Error parsing simulation file: ' + error.message, 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
            return;
    }

    // Load simulation from path
    fetch(simulationPath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Simulation file not found');
            }
            return response.json();
        })
        .then(data => {
            testSimulationData = data;
            logToConsole('actionsConsole', `Loaded simulation: ${type}`, 'success');
        })
        .catch(error => {
            logToConsole('actionsConsole', 'Error loading simulation: ' + error.message, 'error');
        });
}

function runValidation() {
    if (!testSimulationData) {
        logToConsole('actionsConsole', 'No test data loaded', 'warning');
        return;
    }

    try {
        const catalogData = JSON.parse(jsonEditor.getValue());
        const validationCode = jsEditor.getValue();
        
        // Create validator instance
        eval(validationCode); // Note: In production, use a safer evaluation method
        
        let validator;
        if (typeof CustomSimulationValidator !== 'undefined') {
            validator = new CustomSimulationValidator(testSimulationData);
        } else {
            validator = new SimulationValidator(testSimulationData);
        }
        
        // Run validation
        const results = validator.runChecks(catalogData);
        
        // Display results
        const resultsText = results.map(r => `[${r.status.toUpperCase()}] ${r.metricId}: ${r.message}`).join('\n');
        document.getElementById('resultsConsole').innerHTML = '';
        resultsText.split('\n').forEach(line => {
            const status = line.includes('[SUCCESS]') ? 'success' : 
                         line.includes('[WARNING]') ? 'warning' : 
                         line.includes('[ERROR]') ? 'error' : 'info';
            logToConsole('resultsConsole', line.replace(/^\[[^\]]+\]\s*/, ''), status);
        });
        
        logToConsole('actionsConsole', `Validation completed: ${results.length} checks`, 'success');
        
    } catch (error) {
        logToConsole('actionsConsole', 'Validation error: ' + error.message, 'error');
    }
}

function formatJson() {
    try {
        const data = JSON.parse(jsonEditor.getValue());
        jsonEditor.setValue(JSON.stringify(data, null, 2));
        logToConsole('actionsConsole', 'JSON formatted', 'success');
    } catch (error) {
        logToConsole('actionsConsole', 'Error formatting JSON: ' + error.message, 'error');
    }
}

function formatJavaScript() {
    jsEditor.getAction('editor.action.formatDocument').run();
    logToConsole('actionsConsole', 'JavaScript formatted', 'success');
}

function checkJavaScriptSyntax() {
    try {
        // Basic syntax check by attempting to create a function
        new Function(jsEditor.getValue());
        logToConsole('structureConsole', 'JavaScript syntax is valid', 'success');
    } catch (error) {
        logToConsole('structureConsole', 'JavaScript syntax error: ' + error.message, 'error');
    }
}

function validateAll() {
    validateJsonSyntax();
    checkJavaScriptSyntax();
    if (testSimulationData) {
        runValidation();
    }
}

function clearConsole() {
    ['structureConsole', 'resultsConsole', 'actionsConsole'].forEach(consoleId => {
        document.getElementById(consoleId).innerHTML = 'Console cleared...';
    });
}

function clearTestData() {
    testSimulationData = null;
    logToConsole('actionsConsole', 'Test data cleared', 'info');
}

function importMetricsPackage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.catalog) {
                        jsonEditor.setValue(JSON.stringify(data.catalog, null, 2));
                    }
                    if (data.validation) {
                        jsEditor.setValue(data.validation);
                    }
                    logToConsole('actionsConsole', `Imported package: ${file.name}`, 'success');
                } catch (error) {
                    logToConsole('actionsConsole', 'Error importing package: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function exportMetricsPackage() {
    try {
        const catalogData = JSON.parse(jsonEditor.getValue());
        const validationCode = jsEditor.getValue();
        
        const exportData = {
            catalog: catalogData,
            validation: validationCode,
            exported: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'metrics-package.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logToConsole('actionsConsole', 'Metrics package exported', 'success');
    } catch (error) {
        logToConsole('actionsConsole', 'Error exporting package: ' + error.message, 'error');
    }
}

function logToConsole(consoleId, message, type) {
    const consoleElement = document.getElementById(consoleId);
    const timestamp = new Date().toLocaleTimeString();
    const statusClass = `status-${type === 'error' ? 'error' : 
                                 type === 'warning' ? 'warning' : 
                                 type === 'success' ? 'success' : 'info'}`;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <div class="status-indicator ${statusClass}"></div>
        <div class="log-timestamp">${timestamp}</div>
        <div class="log-message">${message}</div>
    `;
    
    consoleElement.appendChild(logEntry);
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

// Initialize resize handles for panels
function initializeResizeHandles() {
    const verticalHandles = document.querySelectorAll('.resize-handle-vertical');
    const horizontalHandle = document.querySelector('.resize-handle-horizontal');
    const container = document.querySelector('.metrics-editor-container');
    
    if (!container) {
        console.error('Metrics editor container not found');
        return;
    }
    
    let isDragging = false;
    let dragType = '';
    let dragHandle = null;
    let startX = 0;
    let startY = 0;
    let startWidths = [];
    let startHeights = [];
    let panelElements = [];

    // Get current panel sizes in pixels
    function getCurrentPanelSizes() {
        const leftPanel = container.querySelector('.left-panel');
        const centerPanel = container.querySelector('.center-panel');
        const rightPanel = container.querySelector('.right-panel');
        const validationConsole = container.querySelector('.validation-console');
        
        panelElements = [leftPanel, centerPanel, rightPanel, validationConsole].filter(Boolean);
        
        if (leftPanel && centerPanel) {
            startWidths = [
                leftPanel.getBoundingClientRect().width,
                centerPanel.getBoundingClientRect().width,
                rightPanel && !rightPanel.classList.contains('hidden') ? rightPanel.getBoundingClientRect().width : 0
            ];
        }
        
        if (validationConsole) {
            const containerRect = container.getBoundingClientRect();
            const consoleRect = validationConsole.getBoundingClientRect();
            startHeights = [
                containerRect.height - consoleRect.height,
                consoleRect.height
            ];
        }
    }

    // Vertical resize handles (between panels)
    verticalHandles.forEach((handle) => {
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragType = 'vertical';
            dragHandle = handle;
            startX = e.clientX;
            
            getCurrentPanelSizes();
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    });

    // Horizontal resize handle (for bottom panel)
    if (horizontalHandle) {
        horizontalHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragType = 'horizontal';
            dragHandle = horizontalHandle;
            startY = e.clientY;
            
            getCurrentPanelSizes();
            
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    }

    // Mouse move handler
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !dragHandle) return;
        e.preventDefault();

        if (dragType === 'vertical') {
            const deltaX = e.clientX - startX;
            const containerWidth = container.getBoundingClientRect().width;
            
            // Determine which panels to resize based on handle parent
            const handleParent = dragHandle.parentElement;
            let leftColIndex = -1;
            let rightColIndex = -1;
            
            if (handleParent.classList.contains('left-panel')) {
                leftColIndex = 0;
                rightColIndex = 1;
            } else if (handleParent.classList.contains('center-panel')) {
                leftColIndex = 1;
                rightColIndex = 2;
            }

            if (leftColIndex >= 0 && rightColIndex >= 0 && startWidths.length > rightColIndex) {
                // Calculate new widths with constraints
                const minWidth = containerWidth * 0.15; // 15% minimum
                const maxWidth = containerWidth * 0.70; // 70% maximum
                
                let newLeftWidth = Math.max(minWidth, Math.min(maxWidth, startWidths[leftColIndex] + deltaX));
                let newRightWidth = Math.max(minWidth, Math.min(maxWidth, startWidths[rightColIndex] - deltaX));
                
                // Ensure total width doesn't exceed container
                const totalOtherWidths = startWidths.reduce((sum, width, idx) => 
                    idx !== leftColIndex && idx !== rightColIndex ? sum + width : sum, 0
                );
                const availableWidth = containerWidth - totalOtherWidths - 4; // Account for gaps
                
                if (newLeftWidth + newRightWidth > availableWidth) {
                    const ratio = availableWidth / (newLeftWidth + newRightWidth);
                    newLeftWidth *= ratio;
                    newRightWidth *= ratio;
                }
                
                // Apply the new column template
                const isRightPanelHidden = container.classList.contains('right-panel-hidden');
                
                if (isRightPanelHidden && rightColIndex === 2) {
                    // Right panel is hidden, only resize left and center
                    const leftPercent = (newLeftWidth / containerWidth) * 100;
                    const centerPercent = (newRightWidth / containerWidth) * 100;
                    container.style.gridTemplateColumns = `${leftPercent}% ${centerPercent}%`;
                } else if (leftColIndex === 0 && rightColIndex === 1) {
                    // Resizing between left and center panels
                    const leftPercent = (newLeftWidth / containerWidth) * 100;
                    const centerPercent = (newRightWidth / containerWidth) * 100;
                    const rightPercent = startWidths[2] > 0 ? (startWidths[2] / containerWidth) * 100 : 35;
                    
                    if (isRightPanelHidden) {
                        container.style.gridTemplateColumns = `${leftPercent}% ${centerPercent + rightPercent}%`;
                    } else {
                        container.style.gridTemplateColumns = `${leftPercent}% ${centerPercent}% ${rightPercent}%`;
                    }
                } else if (leftColIndex === 1 && rightColIndex === 2) {
                    // Resizing between center and right panels
                    const leftPercent = (startWidths[0] / containerWidth) * 100;
                    const centerPercent = (newLeftWidth / containerWidth) * 100;
                    const rightPercent = (newRightWidth / containerWidth) * 100;
                    
                    container.style.gridTemplateColumns = `${leftPercent}% ${centerPercent}% ${rightPercent}%`;
                }
            }
        } else if (dragType === 'horizontal') {
            const deltaY = e.clientY - startY;
            const containerHeight = container.getBoundingClientRect().height;
            
            if (startHeights.length >= 2) {
                const minBottomHeight = containerHeight * 0.05; // 5% minimum (1/4 of previous 20%)
                const maxTopHeight = containerHeight * 0.95; // 95% maximum for top
                const maxBottomHeight = containerHeight * 0.60; // 60% maximum for bottom
                const minTopHeight = containerHeight * 0.40; // 40% minimum for top
                
                // Fix the direction - when dragging down (positive deltaY), top gets bigger, bottom gets smaller
                let newTopHeight = Math.max(minTopHeight, Math.min(maxTopHeight, startHeights[0] + deltaY));
                let newBottomHeight = Math.max(minBottomHeight, Math.min(maxBottomHeight, startHeights[1] - deltaY));
                
                // Ensure heights don't exceed container
                if (newTopHeight + newBottomHeight > containerHeight - 4) { // Account for gap
                    const ratio = (containerHeight - 4) / (newTopHeight + newBottomHeight);
                    newTopHeight *= ratio;
                    newBottomHeight *= ratio;
                }
                
                const topPercent = (newTopHeight / containerHeight) * 100;
                const bottomPercent = (newBottomHeight / containerHeight) * 100;
                
                container.style.gridTemplateRows = `${topPercent}% ${bottomPercent}%`;
            }
        }

        // Trigger editor layout updates with debouncing
        clearTimeout(window.editorLayoutTimeout);
        window.editorLayoutTimeout = setTimeout(() => {
            try {
                if (jsonEditor && typeof jsonEditor.layout === 'function') {
                    jsonEditor.layout();
                }
                if (jsEditor && typeof jsEditor.layout === 'function') {
                    jsEditor.layout();
                }
            } catch (error) {
                console.warn('Error updating editor layout:', error);
            }
        }, 16); // ~60fps
    });

    // Mouse up handler
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            dragType = '';
            dragHandle = null;
            startWidths = [];
            startHeights = [];
            panelElements = [];
            
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Final editor layout update
            clearTimeout(window.editorLayoutTimeout);
            setTimeout(() => {
                try {
                    if (jsonEditor && typeof jsonEditor.layout === 'function') {
                        jsonEditor.layout();
                    }
                    if (jsEditor && typeof jsEditor.layout === 'function') {
                        jsEditor.layout();
                    }
                } catch (error) {
                    console.warn('Error in final editor layout update:', error);
                }
            }, 100);
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        clearTimeout(window.windowResizeTimeout);
        window.windowResizeTimeout = setTimeout(() => {
            try {
                if (jsonEditor && typeof jsonEditor.layout === 'function') {
                    jsonEditor.layout();
                }
                if (jsEditor && typeof jsEditor.layout === 'function') {
                    jsEditor.layout();
                }
            } catch (error) {
                console.warn('Error updating editor layout on window resize:', error);
            }
        }, 100);
    });

    console.log('Resize handles initialized successfully');
}