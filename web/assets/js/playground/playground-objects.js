// Playground Objects - Object and task management functionality
// Universal Automation Wiki - Simulation Playground

let interactionCounter = 0;

// Setup button event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other modules to load
    setTimeout(() => {
        const addObjectBtn = document.getElementById("add-object-btn");
        const addTaskBtn = document.getElementById("add-task-btn");
        
        if (addObjectBtn) {
            addObjectBtn.addEventListener("click", openAddObjectModal);
        }
        
        if (addTaskBtn) {
            addTaskBtn.addEventListener("click", openAddTaskModal);
        }
    }, 500);
});

// Open add object modal
function openAddObjectModal() {
    const modal = document.getElementById('add-object-modal');
    const typeSelect = document.getElementById('object-type-select');
    const fieldsContainer = document.getElementById('object-type-specific-fields');
    
    // Clear form
    modal.querySelectorAll('input, select').forEach(input => {
        input.value = '';
    });
    
    // Show modal
    modal.style.display = 'flex';
    
    // Setup type change handler
    typeSelect.addEventListener('change', function() {
        updateObjectTypeFields(this.value, fieldsContainer);
    });
    
    // Trigger initial update
    updateObjectTypeFields(typeSelect.value, fieldsContainer);
    
    // Setup close button and form submission for object modal
    const cancelBtn = document.getElementById('object-cancel-btn');
    const addBtn = document.getElementById('object-add-btn');
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.preventDefault();
            addObjectToSimulation();
        };
    }
}

function updateObjectTypeFields(type, container) {
    const context = getCurrentTimelineContext();
    const locationOptions = context.locations.map(loc => 
        `<option value="${loc.id}">${loc.name}</option>`
    ).join('');
    
    let fieldsHTML = '';
    
    switch (type) {
        case 'actor':
            fieldsHTML = `
                <div class="dialog-field">
                    <label>Role</label>
                    <input type="text" name="role" placeholder="e.g., Baker, Assistant">
                </div>
                <div class="dialog-field">
                    <label>Cost per Hour ($)</label>
                    <input type="number" name="cost_per_hour" min="0" step="0.01" placeholder="25.00">
                </div>
            `;
            break;
            
        case 'equipment':
            fieldsHTML = `
                <div class="dialog-field">
                    <label>Initial State</label>
                    <input type="text" name="state" placeholder="e.g., clean, available">
                </div>
                <div class="dialog-field">
                    <label>Capacity</label>
                    <input type="number" name="capacity" min="1" placeholder="1">
                </div>
            `;
            break;
            
        case 'resource':
            fieldsHTML = `
                <div class="dialog-field">
                    <label>Unit</label>
                    <input type="text" name="unit" placeholder="e.g., kg, liter, pieces">
                </div>
                <div class="dialog-field">
                    <label>Initial Quantity</label>
                    <input type="number" name="quantity" min="0" step="0.1" placeholder="10">
                </div>
            `;
            break;
            
        case 'product':
            fieldsHTML = `
                <div class="dialog-field">
                    <label>Unit</label>
                    <input type="text" name="unit" placeholder="e.g., batch, loaves, pieces">
                </div>
                <div class="dialog-field">
                    <label>Initial Quantity</label>
                    <input type="number" name="quantity" min="0" step="0.1" placeholder="0">
                </div>
            `;
            break;
            
        default:
            fieldsHTML = `
                <div class="dialog-field">
                    <label>Custom Properties (JSON)</label>
                    <textarea name="custom_properties" placeholder='{"property": "value"}'></textarea>
                </div>
            `;
    }
    
    // Add location field for all types
    fieldsHTML += `
        <div class="dialog-field">
            <label>Location</label>
            <select name="location">
                <option value="">Select location...</option>
                ${locationOptions}
            </select>
        </div>
    `;
    
    container.innerHTML = fieldsHTML;
}

// Open add task modal  
function openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    const actorSelect = document.getElementById('task-actor-select');
    const locationSelect = document.getElementById('task-location-select');
    const startTimeInput = document.getElementById('task-start-input');
    
    // Clear form
    modal.querySelectorAll('input, select').forEach(input => {
        if (input.type === 'checkbox') input.checked = false;
        else if (input.type === 'radio') {
            if (input.value === 'duration') input.checked = true;
            else input.checked = false;
        } else {
            input.value = '';
        }
    });
    
    // Clear interactions
    document.getElementById('interactions-container').innerHTML = '';
    interactionCounter = 0;
    
    // Populate dropdowns from current simulation
    const context = getCurrentTimelineContext();
    
    // Populate actors/objects
    if (actorSelect) {
        actorSelect.innerHTML = '<option value="">Select actor/object...</option>';
        Object.entries(context.objectsByType).forEach(([type, objects]) => {
            objects.forEach(obj => {
                const option = document.createElement('option');
                option.value = obj.id;
                option.textContent = `${obj.name} (${type})`;
                actorSelect.appendChild(option);
            });
        });
    }
    
    // Populate locations
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">Select location...</option>';
        context.locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.name;
            locationSelect.appendChild(option);
        });
    }
    
    // Set default start time
    if (startTimeInput) {
        startTimeInput.value = context.startTime;
    }
    
    // Setup time input toggle
    setupTimeInputToggle();
    
    modal.style.display = 'flex';
    
    // Setup close button and form submission for task modal
    const cancelBtn = document.getElementById('task-cancel-btn');
    const addBtn = document.getElementById('task-add-btn');
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.preventDefault();
            addTaskToSimulation();
        };
    }
    
    // Setup add interaction button
    const addInteractionBtn = document.getElementById('add-interaction-btn');
    if (addInteractionBtn) {
        addInteractionBtn.onclick = addInteraction;
    }
}

function setupTimeInputToggle() {
    const radioButtons = document.querySelectorAll('input[name="time-input-mode"]');
    const durationField = document.getElementById('duration-input-group');
    const endTimeField = document.getElementById('end-time-input-group');
    
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'duration') {
                durationField.style.display = 'block';
                endTimeField.style.display = 'none';
            } else {
                durationField.style.display = 'none';
                endTimeField.style.display = 'block';
            }
        });
    });
}

// Add interaction
function addInteraction() {
    interactionCounter++;
    const container = document.getElementById('interactions-container');
    const context = getCurrentTimelineContext();
    
    const objectOptions = [];
    Object.entries(context.objectsByType).forEach(([type, objects]) => {
        objects.forEach(obj => {
            objectOptions.push(`<option value="${obj.id}">${obj.name} (${type})</option>`);
        });
    });
    
    const interactionHTML = `
        <div class="interaction-group" id="interaction-${interactionCounter}">
            <div class="interaction-header">
                <h4>Interaction ${interactionCounter}</h4>
                <button type="button" class="btn-danger-small" onclick="removeInteraction(this)">×</button>
            </div>
            
            <div class="dialog-field">
                <label>Object</label>
                <select name="interaction_object_${interactionCounter}" required>
                    <option value="">Select object...</option>
                    ${objectOptions.join('')}
                </select>
            </div>
            
            <div class="dialog-field">
                <label>Property Changes</label>
                <div class="property-changes-container" id="properties-${interactionCounter}">
                    <button type="button" class="btn-secondary-small" onclick="addPropertyChange(this, null)">Add Property Change</button>
                </div>
            </div>
            
            <div class="dialog-field">
                <label>
                    <input type="checkbox" name="revert_after_${interactionCounter}">
                    Revert after task completes
                </label>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', interactionHTML);
}

// Remove interaction
function removeInteraction(button) {
    const interactionGroup = button.closest('.interaction-group');
    if (interactionGroup) {
        interactionGroup.remove();
    }
}

// Add property change
function addPropertyChange(buttonOrContainer, objectOptions = null) {
    const container = buttonOrContainer.classList?.contains('property-changes-container') 
        ? buttonOrContainer 
        : buttonOrContainer.closest('.property-changes-container');
    
    if (!container) return;
    
    const changeId = Date.now() + Math.random();
    
    const changeHTML = `
        <div class="property-change" id="change-${changeId}">
            <div class="property-change-row">
                <select name="change_type_${changeId}">
                    <option value="simple">Simple Change</option>
                    <option value="delta">Delta Change</option>
                    <option value="add_object">Add Object</option>
                </select>
                
                <input type="text" name="property_name_${changeId}" placeholder="Property name">
                
                <div class="property-value-fields" id="value-fields-${changeId}">
                    <input type="text" name="from_value_${changeId}" placeholder="From">
                    <input type="text" name="to_value_${changeId}" placeholder="To">
                </div>
                
                <div class="property-add-object-fields" id="add-object-fields-${changeId}" style="display: none;">
                    <input type="text" name="new_object_id_${changeId}" placeholder="New object ID">
                    <input type="text" name="new_object_name_${changeId}" placeholder="Object name">
                </div>
                
                <button type="button" class="btn-danger-small" onclick="removePropertyChange(this)">×</button>
            </div>
        </div>
    `;
    
    // Find the button and insert before it
    const addButton = container.querySelector('button');
    if (addButton) {
        addButton.insertAdjacentHTML('beforebegin', changeHTML);
    } else {
        container.insertAdjacentHTML('beforeend', changeHTML);
    }
    
    // Setup change type handler
    const changeTypeSelect = document.querySelector(`select[name="change_type_${changeId}"]`);
    const valueFields = document.getElementById(`value-fields-${changeId}`);
    const addObjectFields = document.getElementById(`add-object-fields-${changeId}`);
    
    changeTypeSelect.addEventListener('change', function() {
        const changeDiv = this.closest('.property-change');
        const addObjectFields = changeDiv.querySelector('.property-add-object-fields');
        const valueFields = changeDiv.querySelector('.property-value-fields');
        
        if (this.value === 'add_object') {
            valueFields.style.display = 'none';
            addObjectFields.style.display = 'block';
        } else {
            valueFields.style.display = 'block';
            addObjectFields.style.display = 'none';
        }
        
        // Update placeholders based on change type
        const fromInput = valueFields.querySelector('input[name*="from_value"]');
        const toInput = valueFields.querySelector('input[name*="to_value"]');
        
        if (this.value === 'delta') {
            fromInput.style.display = 'none';
            toInput.placeholder = 'Delta value (e.g., -1, +5)';
        } else {
            fromInput.style.display = 'block';
            fromInput.placeholder = 'From';
            toInput.placeholder = 'To';
        }
    });
}

// Remove property change
function removePropertyChange(button) {
    const propertyChange = button.closest('.property-change');
    if (propertyChange) {
        propertyChange.remove();
    }
}

// Add object to simulation
function addObjectToSimulation() {
    try {
        const modal = document.getElementById('add-object-modal');
        const objectType = document.getElementById('object-type-select').value;
        const objectName = document.getElementById('object-name-input').value;
        const objectId = document.getElementById('object-id-input').value;
        const emoji = document.getElementById('object-emoji-input').value;
        const location = document.getElementById('object-location-input').value;
        const currentJson = JSON.parse(editor.getValue());
        
        
        if (!objectType || !objectName) {
            alert('Please fill in object type and name');
            return;
        }
        const finalObjectId = objectId || getNextAvailableId(objectType, currentJson.simulation.objects || []);
        
        // Build properties object based on type
        const properties = { location };
        
        // Get type-specific fields from the dynamically generated form fields
        const fieldsContainer = document.getElementById('object-type-specific-fields');
        const inputs = fieldsContainer.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.value && input.name) {
                if (input.type === 'number') {
                    properties[input.name] = parseFloat(input.value) || parseInt(input.value);
                } else {
                    properties[input.name] = input.value;
                }
            }
        });
        
        const newObject = {
            id: finalObjectId,
            type: objectType,
            name: objectName,
            properties: properties
        };
        
        if (emoji) {
            newObject.emoji = emoji;
        }
        
        // Add to simulation
        if (!currentJson.simulation.objects) {
            currentJson.simulation.objects = [];
        }
        currentJson.simulation.objects.push(newObject);
        
        // Update editor
        editor.setValue(JSON.stringify(currentJson, null, 2));
        
        // Close modal
        document.getElementById('add-object-modal').style.display = 'none';
        
        // Re-render if auto-render is on
        if (autoRender) {
            renderSimulation();
        }
        
        showNotification(`Added ${objectType}: ${objectName}`);
        
    } catch (error) {
        console.error('Error adding object:', error);
        alert(`Error adding object: ${error.message}`);
    }
}

// Add task to simulation
function addTaskToSimulation() {
    try {
        const taskId = document.getElementById('task-id-input').value || generateUniqueId('task');
        const emoji = document.getElementById('task-emoji-input').value || '📋';
        const actorId = document.getElementById('task-actor-select').value;
        const location = document.getElementById('task-location-select').value;
        const startTime = document.getElementById('task-start-input').value;
        
        if (!emoji || !actorId || !location || !startTime) {
            alert('Please fill in all required fields');
            return;
        }
        const currentJson = JSON.parse(editor.getValue());
        
        
        // Calculate duration or end time
        let duration;
        const timeInputMode = document.querySelector('input[name="time-input-mode"]:checked').value;
        if (timeInputMode === 'duration') {
            duration = parseInt(document.getElementById('task-duration-input').value);
        } else {
            const endTime = document.getElementById('task-end-time-input').value;
            const startMinutes = parseTimeToMinutes(startTime);
            const endMinutes = parseTimeToMinutes(endTime);
            duration = endMinutes - startMinutes;
        }
        
        if (!duration || duration <= 0) {
            alert('Please provide a valid duration');
            return;
        }
        
        // Build task object
        const newTask = {
            id: taskId,
            emoji: emoji,
            actor_id: actorId,
            start: startTime,
            duration: duration,
            location: location,
            depends_on: [],
            interactions: []
        };
        
        // Process interactions
        const interactionGroups = document.querySelectorAll('.interaction-group');
        interactionGroups.forEach((group, index) => {
            const interactionCounter = group.id.split('-')[1];
            const objectSelect = group.querySelector(`select[name="interaction_object_${interactionCounter}"]`);
            const revertCheckbox = group.querySelector(`input[name="revert_after_${interactionCounter}"]`);
            const objectId = objectSelect ? objectSelect.value : null;
            const revertAfter = revertCheckbox ? revertCheckbox.checked : false;
            
            if (!objectId) return;
            
            const interaction = {
                object_id: objectId,
                property_changes: {},
                revert_after: revertAfter
            };
            
            // Process property changes for this interaction
            const propertyChanges = group.querySelectorAll('.property-change');
            propertyChanges.forEach(change => {
                const changeId = change.id.split('-')[1];
                const changeTypeSelect = change.querySelector(`select[name="change_type_${changeId}"]`);
                const propertyNameInput = change.querySelector(`input[name="property_name_${changeId}"]`);
                const changeType = changeTypeSelect ? changeTypeSelect.value : null;
                const propertyName = propertyNameInput ? propertyNameInput.value : null;
                
                if (!propertyName) return;
                
                if (changeType === 'add_object') {
                    // Handle add object
                    const newObjectIdInput = change.querySelector(`input[name="new_object_id_${changeId}"]`);
                    const newObjectNameInput = change.querySelector(`input[name="new_object_name_${changeId}"]`);
                    const newObjectId = newObjectIdInput ? newObjectIdInput.value : null;
                    const newObjectName = newObjectNameInput ? newObjectNameInput.value : null;
                    
                    if (newObjectId && newObjectName) {
                        if (!interaction.add_objects) interaction.add_objects = [];
                        interaction.add_objects.push({
                            id: newObjectId,
                            type: 'product', // Default type for dynamically added objects
                            name: newObjectName,
                            properties: { location: location }
                        });
                    }
                } else if (changeType === 'delta') {
                    // Handle delta change
                    const toValueInput = change.querySelector(`input[name="to_value_${changeId}"]`);
                    const deltaValue = toValueInput ? toValueInput.value : null;
                    if (deltaValue !== null && deltaValue !== '') {
                        interaction.property_changes[propertyName] = { delta: parseFloat(deltaValue) || deltaValue };
                    }
                } else {
                    // Handle simple from/to change
                    const fromValueInput = change.querySelector(`input[name="from_value_${changeId}"]`);
                    const toValueInput = change.querySelector(`input[name="to_value_${changeId}"]`);
                    const fromValue = fromValueInput ? fromValueInput.value : null;
                    const toValue = toValueInput ? toValueInput.value : null;
                    if (toValue !== null && toValue !== '') {
                        interaction.property_changes[propertyName] = { 
                            from: fromValue || undefined, 
                            to: parseFloat(toValue) || toValue 
                        };
                    }
                }
            });
            
            newTask.interactions.push(interaction);
        });
        
        // Add to simulation
        if (!currentJson.simulation.tasks) {
            currentJson.simulation.tasks = [];
        }
        currentJson.simulation.tasks.push(newTask);
        
        // Update editor
        editor.setValue(JSON.stringify(currentJson, null, 2));
        
        // Close modal
        document.getElementById('add-task-modal').style.display = 'none';
        
        // Re-render if auto-render is on
        if (autoRender) {
            renderSimulation();
        }
        
        showNotification(`Added task: ${taskId}`);
        
    } catch (error) {
        console.error('Error adding task:', error);
        alert(`Error adding task: ${error.message}`);
    }
}