// Timeline Extensions - Support for digital and display interactions
// Universal Automation Wiki - Simulation Playground

// Extend the existing interaction system to support digital space and display interactions
function extendTaskWithDigitalDisplayInteractions() {
    // Add digital_interactions and display_interactions arrays to task creation
    const originalAddInteraction = window.addInteraction;
    if (typeof originalAddInteraction === 'function') {
        window.addInteraction = function() {
            originalAddInteraction();
            
            // Add digital and display interaction options to the new interaction
            const interactionItems = document.querySelectorAll('.interaction-item');
            const lastInteraction = interactionItems[interactionItems.length - 1];
            
            if (lastInteraction) {
                addDigitalDisplayInteractionOptions(lastInteraction);
            }
        };
    }
}

function addDigitalDisplayInteractionOptions(interactionElement) {
    const typeSelect = interactionElement.querySelector('.interaction-type-select');
    if (!typeSelect) return;

    // Add digital and display interaction types
    const digitalOptions = [
        '<optgroup label="Digital Space">',
        '<option value="digital_object_create">Create Digital Object</option>',
        '<option value="digital_object_move">Move Digital Object</option>',
        '<option value="digital_object_modify">Modify Digital Object</option>',
        '<option value="digital_object_delete">Delete Digital Object</option>',
        '</optgroup>',
        '<optgroup label="Display Interface">',
        '<option value="display_element_show">Show Display Element</option>',
        '<option value="display_element_hide">Hide Display Element</option>',
        '<option value="display_element_click">Click Display Element</option>',
        '<option value="display_element_modify">Modify Display Element</option>',
        '<option value="display_window_open">Open Window</option>',
        '<option value="display_window_close">Close Window</option>',
        '</optgroup>'
    ].join('');
    
    typeSelect.insertAdjacentHTML('beforeend', digitalOptions);
    
    // Add event listener for digital/display interaction types
    typeSelect.addEventListener('change', function(e) {
        if (e.target.value.startsWith('digital_') || e.target.value.startsWith('display_')) {
            updateInteractionFieldsForDigitalDisplay(interactionElement, e.target.value);
        }
    });
}

function updateInteractionFieldsForDigitalDisplay(interactionElement, interactionType) {
    const fieldsContainer = interactionElement.querySelector('.interaction-fields') || 
                           interactionElement.querySelector('.interaction-item').parentElement;
    
    // Remove existing additional fields
    const existingFields = fieldsContainer.querySelectorAll('.digital-display-fields');
    existingFields.forEach(field => field.remove());
    
    // Add fields based on interaction type
    let additionalFields = '';
    
    if (interactionType.startsWith('digital_')) {
        additionalFields = createDigitalInteractionFields(interactionType);
    } else if (interactionType.startsWith('display_')) {
        additionalFields = createDisplayInteractionFields(interactionType);
    }
    
    if (additionalFields) {
        const fieldsDiv = document.createElement('div');
        fieldsDiv.className = 'digital-display-fields';
        fieldsDiv.innerHTML = additionalFields;
        fieldsContainer.appendChild(fieldsDiv);
    }
}

function createDigitalInteractionFields(interactionType) {
    const digitalLocations = getDigitalLocations();
    const digitalObjects = getDigitalObjects();
    
    switch (interactionType) {
        case 'digital_object_create':
            return `
                <div class="form-group">
                    <label>Object Name:</label>
                    <input type="text" class="digital-object-name" placeholder="New File.docx">
                </div>
                <div class="form-group">
                    <label>Object Type:</label>
                    <select class="digital-object-type">
                        <option value="file">File</option>
                        <option value="folder">Folder</option>
                        <option value="database">Database</option>
                        <option value="application">Application</option>
                        <option value="service">Service</option>
                        <option value="process">Process</option>
                        <option value="log">Log</option>
                        <option value="backup">Backup</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Location:</label>
                    <select class="digital-target-location">
                        ${digitalLocations.map(loc => 
                            `<option value="${loc.id}">${loc.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Size (MB):</label>
                    <input type="number" class="digital-object-size" value="1" min="0" step="0.1">
                </div>
            `;
            
        case 'digital_object_move':
            return `
                <div class="form-group">
                    <label>Object to Move:</label>
                    <select class="digital-source-object">
                        ${digitalObjects.map(obj => 
                            `<option value="${obj.id}">${obj.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>From Location:</label>
                    <select class="digital-source-location">
                        ${digitalLocations.map(loc => 
                            `<option value="${loc.id}">${loc.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>To Location:</label>
                    <select class="digital-target-location">
                        ${digitalLocations.map(loc => 
                            `<option value="${loc.id}">${loc.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            
        case 'digital_object_modify':
            return `
                <div class="form-group">
                    <label>Object to Modify:</label>
                    <select class="digital-source-object">
                        ${digitalObjects.map(obj => 
                            `<option value="${obj.id}">${obj.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Property to Change:</label>
                    <select class="digital-property">
                        <option value="name">Name</option>
                        <option value="size_mb">Size</option>
                        <option value="permissions">Permissions</option>
                        <option value="encrypted">Encryption Status</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>New Value:</label>
                    <input type="text" class="digital-new-value" placeholder="New value">
                </div>
            `;
            
        case 'digital_object_delete':
            return `
                <div class="form-group">
                    <label>Object to Delete:</label>
                    <select class="digital-source-object">
                        ${digitalObjects.map(obj => 
                            `<option value="${obj.id}">${obj.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
    }
    
    return '';
}

function createDisplayInteractionFields(interactionType) {
    const displays = getDisplays();
    const displayElements = getAllDisplayElements();
    
    switch (interactionType) {
        case 'display_element_show':
        case 'display_element_hide':
            return `
                <div class="form-group">
                    <label>Display:</label>
                    <select class="display-select">
                        ${displays.map(display => 
                            `<option value="${display.id}">${display.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Element:</label>
                    <select class="display-element-select">
                        ${displayElements.map(element => 
                            `<option value="${element.id}">${element.content.value || element.type}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            
        case 'display_element_click':
            return `
                <div class="form-group">
                    <label>Display:</label>
                    <select class="display-select">
                        ${displays.map(display => 
                            `<option value="${display.id}">${display.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Element to Click:</label>
                    <select class="display-element-select">
                        ${displayElements.filter(el => el.properties.clickable).map(element => 
                            `<option value="${element.id}">${element.content.value || element.type}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Click Type:</label>
                    <select class="click-type">
                        <option value="single">Single Click</option>
                        <option value="double">Double Click</option>
                        <option value="right">Right Click</option>
                    </select>
                </div>
            `;
            
        case 'display_element_modify':
            return `
                <div class="form-group">
                    <label>Display:</label>
                    <select class="display-select">
                        ${displays.map(display => 
                            `<option value="${display.id}">${display.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Element to Modify:</label>
                    <select class="display-element-select">
                        ${displayElements.map(element => 
                            `<option value="${element.id}">${element.content.value || element.type}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Property to Change:</label>
                    <select class="display-property">
                        <option value="content.value">Text Content</option>
                        <option value="properties.visible">Visibility</option>
                        <option value="properties.background">Background Color</option>
                        <option value="bounds.x">X Position</option>
                        <option value="bounds.y">Y Position</option>
                        <option value="bounds.width">Width</option>
                        <option value="bounds.height">Height</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>New Value:</label>
                    <input type="text" class="display-new-value" placeholder="New value">
                </div>
            `;
            
        case 'display_window_open':
            return `
                <div class="form-group">
                    <label>Display:</label>
                    <select class="display-select">
                        ${displays.map(display => 
                            `<option value="${display.id}">${display.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Window Title:</label>
                    <input type="text" class="window-title" placeholder="New Window">
                </div>
                <div class="form-group">
                    <label>Window Type:</label>
                    <select class="window-type">
                        <option value="dialog">Dialog</option>
                        <option value="window">Application Window</option>
                        <option value="popup">Popup</option>
                    </select>
                </div>
            `;
            
        case 'display_window_close':
            return `
                <div class="form-group">
                    <label>Display:</label>
                    <select class="display-select">
                        ${displays.map(display => 
                            `<option value="${display.id}">${display.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Window to Close:</label>
                    <select class="display-element-select">
                        ${displayElements.filter(el => ['window', 'dialog'].includes(el.type)).map(element => 
                            `<option value="${element.id}">${element.content.value || element.type}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
    }
    
    return '';
}

// Helper functions to get data from the simulation
function getDigitalLocations() {
    try {
        const editor = window.playgroundCore?.monacoEditor;
        if (!editor) return [];

        const data = JSON.parse(editor.getValue());
        const sim = data.simulation || data;
        // Support both new (nested) and old (root-level) formats for backward compatibility
        const digitalSpace = sim.digital_space || data.digital_space;
        return digitalSpace?.digital_locations || [];
    } catch (e) {
        return [];
    }
}

function getDigitalObjects() {
    try {
        const editor = window.playgroundCore?.monacoEditor;
        if (!editor) return [];

        const data = JSON.parse(editor.getValue());
        const sim = data.simulation || data;
        // Support both new (nested) and old (root-level) formats for backward compatibility
        const digitalSpace = sim.digital_space || data.digital_space;
        return digitalSpace?.digital_objects || [];
    } catch (e) {
        return [];
    }
}

function getDisplays() {
    try {
        const editor = window.playgroundCore?.monacoEditor;
        if (!editor) return [];

        const data = JSON.parse(editor.getValue());
        const sim = data.simulation || data;
        // Support both new (nested) and old (root-level) formats for backward compatibility
        return sim.displays || data.displays || [];
    } catch (e) {
        return [];
    }
}

function getAllDisplayElements() {
    const displays = getDisplays();
    const allElements = [];
    
    displays.forEach(display => {
        if (display.rectangles) {
            display.rectangles.forEach(element => {
                allElements.push({
                    ...element,
                    display_id: display.id,
                    display_name: display.name
                });
            });
        }
    });
    
    return allElements;
}

// Process digital and display interactions in tasks
function processDigitalDisplayInteractions(task, timeInMinutes) {
    const isTaskActive = timeInMinutes >= task.start_minutes && timeInMinutes < task.end_minutes;
    const isTaskCompleted = timeInMinutes >= task.end_minutes;
    
    // Process digital interactions
    if (task.digital_interactions) {
        task.digital_interactions.forEach(interaction => {
            if (isTaskActive || isTaskCompleted) {
                processDigitalInteraction(interaction, isTaskCompleted);
            }
        });
    }
    
    // Process display interactions
    if (task.display_interactions) {
        task.display_interactions.forEach(interaction => {
            if (isTaskActive || isTaskCompleted) {
                processDisplayInteraction(interaction, isTaskCompleted);
            }
        });
    }
}

function processDigitalInteraction(interaction, isCompleted) {
    // Implementation would depend on how you want to visualize digital interactions
    // This could update the digital space editor visualization in real-time
    console.log('Processing digital interaction:', interaction, 'completed:', isCompleted);
}

function processDisplayInteraction(interaction, isCompleted) {
    // Implementation would depend on how you want to visualize display interactions
    // This could update the display editor visualization in real-time
    console.log('Processing display interaction:', interaction, 'completed:', isCompleted);
}

// Extend the task creation process to collect digital and display interactions
function collectDigitalDisplayInteractionsFromTask() {
    const interactionItems = document.querySelectorAll('.interaction-item');
    const digitalInteractions = [];
    const displayInteractions = [];
    
    interactionItems.forEach(item => {
        const typeSelect = item.querySelector('.interaction-type-select');
        const objectSelect = item.querySelector('.interaction-object-select');
        
        if (!typeSelect || !objectSelect) return;
        
        const interactionType = typeSelect.value;
        const objectId = objectSelect.value;
        
        if (interactionType.startsWith('digital_')) {
            const digitalFields = item.querySelector('.digital-display-fields');
            if (digitalFields) {
                const digitalInteraction = collectDigitalInteractionData(interactionType, digitalFields);
                if (digitalInteraction) {
                    digitalInteractions.push(digitalInteraction);
                }
            }
        } else if (interactionType.startsWith('display_')) {
            const displayFields = item.querySelector('.digital-display-fields');
            if (displayFields) {
                const displayInteraction = collectDisplayInteractionData(interactionType, displayFields);
                if (displayInteraction) {
                    displayInteractions.push(displayInteraction);
                }
            }
        }
    });
    
    return { digitalInteractions, displayInteractions };
}

function collectDigitalInteractionData(interactionType, fieldsElement) {
    const interaction = { type: interactionType };
    
    switch (interactionType) {
        case 'digital_object_create':
            interaction.object_name = fieldsElement.querySelector('.digital-object-name')?.value;
            interaction.object_type = fieldsElement.querySelector('.digital-object-type')?.value;
            interaction.location_id = fieldsElement.querySelector('.digital-target-location')?.value;
            interaction.size_mb = parseFloat(fieldsElement.querySelector('.digital-object-size')?.value || '1');
            break;
            
        case 'digital_object_move':
            interaction.object_id = fieldsElement.querySelector('.digital-source-object')?.value;
            interaction.from_location_id = fieldsElement.querySelector('.digital-source-location')?.value;
            interaction.to_location_id = fieldsElement.querySelector('.digital-target-location')?.value;
            break;
            
        case 'digital_object_modify':
            interaction.object_id = fieldsElement.querySelector('.digital-source-object')?.value;
            interaction.property = fieldsElement.querySelector('.digital-property')?.value;
            interaction.new_value = fieldsElement.querySelector('.digital-new-value')?.value;
            break;
            
        case 'digital_object_delete':
            interaction.object_id = fieldsElement.querySelector('.digital-source-object')?.value;
            break;
    }
    
    return interaction;
}

function collectDisplayInteractionData(interactionType, fieldsElement) {
    const interaction = { type: interactionType };
    
    interaction.display_id = fieldsElement.querySelector('.display-select')?.value;
    
    switch (interactionType) {
        case 'display_element_show':
        case 'display_element_hide':
            interaction.element_id = fieldsElement.querySelector('.display-element-select')?.value;
            break;
            
        case 'display_element_click':
            interaction.element_id = fieldsElement.querySelector('.display-element-select')?.value;
            interaction.click_type = fieldsElement.querySelector('.click-type')?.value;
            break;
            
        case 'display_element_modify':
            interaction.element_id = fieldsElement.querySelector('.display-element-select')?.value;
            interaction.property = fieldsElement.querySelector('.display-property')?.value;
            interaction.new_value = fieldsElement.querySelector('.display-new-value')?.value;
            break;
            
        case 'display_window_open':
            interaction.window_title = fieldsElement.querySelector('.window-title')?.value;
            interaction.window_type = fieldsElement.querySelector('.window-type')?.value;
            break;
            
        case 'display_window_close':
            interaction.element_id = fieldsElement.querySelector('.display-element-select')?.value;
            break;
    }
    
    return interaction;
}

// Initialize the timeline extensions
function initializeTimelineExtensions() {
    console.log('TIMELINE-EXTENSIONS: Initializing digital and display interaction support');
    
    // Extend the task creation process
    extendTaskWithDigitalDisplayInteractions();
    
    // Hook into the existing task processing
    const originalProcessSimulationData = window.processSimulationData;
    if (typeof originalProcessSimulationData === 'function') {
        window.processSimulationData = function(simulationData) {
            // Add safety check for simulationData
            if (!simulationData) {
                console.error('TIMELINE-EXTENSIONS: simulationData is undefined');
                return { tasks: [] };
            }
            
            const result = originalProcessSimulationData(simulationData);
            
            // Process digital and display interactions for each task
            if (result.tasks) {
                result.tasks.forEach(task => {
                    processDigitalDisplayInteractions(task, 0); // Initialize
                });
            }
            
            return result;
        };
    }
    
    console.log('TIMELINE-EXTENSIONS: Initialization complete');
}

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for other modules to load first
    setTimeout(() => {
        initializeTimelineExtensions();
    }, 500);
});

// Export functions for global use
window.TimelineExtensions = {
    initializeTimelineExtensions,
    extendTaskWithDigitalDisplayInteractions,
    processDigitalDisplayInteractions,
    collectDigitalDisplayInteractionsFromTask
};