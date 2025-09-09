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

function getObjectTypeFieldsHTML(type, context, counter) {
    const locationOptions = context.locations.map(loc => 
        `<option value="${loc.id}">${loc.name}</option>`
    ).join('');
    
    let fieldsHTML = '';
    
    switch (type) {
        case 'actor':
            fieldsHTML = `
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" name="new_object_role_${counter}" placeholder="e.g., Baker, Assistant">
                </div>
                <div class="form-group">
                    <label>Cost per Hour ($)</label>
                    <input type="number" name="new_object_cost_per_hour_${counter}" min="0" step="0.01" placeholder="25.00">
                </div>
            `;
            break;
        case 'equipment':
            fieldsHTML = `
                <div class="form-group">
                    <label>Initial State</label>
                    <input type="text" name="new_object_state_${counter}" placeholder="e.g., clean, available">
                </div>
                <div class="form-group">
                    <label>Capacity</label>
                    <input type="number" name="new_object_capacity_${counter}" min="1" placeholder="1">
                </div>
            `;
            break;
        case 'resource':
            fieldsHTML = `
                <div class="form-group">
                    <label>Unit</label>
                    <input type="text" name="new_object_unit_${counter}" placeholder="e.g., kg, liter, pieces">
                </div>
                <div class="form-group">
                    <label>Initial Quantity</label>
                    <input type="number" name="new_object_quantity_${counter}" min="0" step="0.1" placeholder="10">
                </div>
            `;
            break;
        case 'product':
            fieldsHTML = `
                <div class="form-group">
                    <label>Unit</label>
                    <input type="text" name="new_object_unit_${counter}" placeholder="e.g., batch, loaves, pieces">
                </div>
                <div class="form-group">
                    <label>Initial Quantity</label>
                    <input type="number" name="new_object_quantity_${counter}" min="0" step="0.1" placeholder="0">
                </div>
            `;
            break;
    }
    
    fieldsHTML += `
        <div class="form-group">
            <label>Location</label>
            <select name="new_object_location_${counter}">
                <option value="">Select location...</option>
                ${locationOptions}
            </select>
        </div>
    `;
    
    return fieldsHTML;
}


function updateObjectTypeFields(type, container) {
    const context = getCurrentTimelineContext();
    container.innerHTML = getObjectTypeFieldsHTML(type, context, 'modal');
}

// Open add task modal  
function openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    const actorSelect = document.getElementById('task-actor-select');
    const locationSelect = document.getElementById('task-location-select');
    const startTimeInput = document.getElementById('task-start-input');
    
    // Clear form
    modal.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    if (document.querySelector('input[name="time-input-mode"][value="duration"]')) {
        document.querySelector('input[name="time-input-mode"][value="duration"]').checked = true;
    }

    
    // Clear interactions
    document.getElementById('interactions-container').innerHTML = '';
    interactionCounter = 0;
    
    // Populate dropdowns from current simulation
    const context = getCurrentTimelineContext();
    
    // Populate actors/objects
    if (actorSelect) {
        actorSelect.innerHTML = '<option value="">Select actor/object...</option>';
        Object.entries(context.objectsByType).forEach(([type, objects]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = type.charAt(0).toUpperCase() + type.slice(1);
            objects.forEach(obj => {
                const option = document.createElement('option');
                option.value = obj.id;
                option.textContent = obj.name;
                optgroup.appendChild(option);
            });
            actorSelect.appendChild(optgroup);
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

    const checkedRadio = document.querySelector('input[name="time-input-mode"]:checked');
    if (checkedRadio) {
        checkedRadio.dispatchEvent(new Event('change'));
    }
}

// Add interaction
function addInteraction() {
    interactionCounter++;
    const container = document.getElementById('interactions-container');
    const context = getCurrentTimelineContext();
    
    const objectOptions = [];
    Object.entries(context.objectsByType).forEach(([type, objects]) => {
        const groupLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const options = objects.map(obj => `<option value="${obj.id}">${obj.name}</option>`).join('');
        objectOptions.push(`<optgroup label="${groupLabel}">${options}</optgroup>`);
    });
    
    // Add digital locations
    if (context.digitalLocations && context.digitalLocations.length > 0) {
        const digitalLocationOptions = context.digitalLocations.map(loc => 
            `<option value="${loc.id}">${loc.name} (Digital Location)</option>`
        ).join('');
        objectOptions.push(`<optgroup label="Digital Locations">${digitalLocationOptions}</optgroup>`);
    }
    
    // Add digital objects
    if (context.digitalObjects && context.digitalObjects.length > 0) {
        const digitalObjectOptions = context.digitalObjects.map(obj => 
            `<option value="${obj.id}">${obj.name} (Digital Object)</option>`
        ).join('');
        objectOptions.push(`<optgroup label="Digital Objects">${digitalObjectOptions}</optgroup>`);
    }
    
    // Add displays
    if (context.displays && context.displays.length > 0) {
        const displayOptions = context.displays.map(display => 
            `<option value="${display.id}">${display.name} (Display)</option>`
        ).join('');
        objectOptions.push(`<optgroup label="Displays">${displayOptions}</optgroup>`);
    }
    
    // Add display elements
    if (context.displayElements && context.displayElements.length > 0) {
        const displayElementOptions = context.displayElements.map(element => 
            `<option value="${element.id}">${element.content.value || element.type} (Display Element)</option>`
        ).join('');
        objectOptions.push(`<optgroup label="Display Elements">${displayElementOptions}</optgroup>`);
    }
    
    const interactionHTML = `
        <div class="interaction-group" id="interaction-${interactionCounter}">
            <div class="interaction-header">
                <h5>Interaction ${interactionCounter}</h5>
                <button type="button" class="btn-remove" onclick="removeInteraction(this)">Remove</button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Change Type</label>
                    <select name="interaction_change_type_${interactionCounter}" onchange="toggleInteractionFields(this)">
                        <option value="from_to">From/To</option>
                        <option value="delta">Delta</option>
                        <option value="add_object">Add Object</option>
                        <option value="remove_object">Remove Object</option>
                        <option value="move_digital_object">Move Digital Object</option>
                        <option value="move_display_element">Move Display Element</option>
                    </select>
                </div>
                <div class="form-group object-selection-group">
                    <label>Object</label>
                    <select name="interaction_object_${interactionCounter}" required>
                        <option value="">Select object...</option>
                        ${objectOptions.join('')}
                    </select>
                </div>
            </div>

            <div class="interaction-fields">
                <div class="form-row from-to-fields">
                    <div class="form-group">
                        <label>Property</label>
                        <input type="text" name="interaction_property_${interactionCounter}" placeholder="e.g., state, quantity">
                    </div>
                    <div class="form-group">
                        <label>From</label>
                        <input type="text" name="interaction_from_${interactionCounter}" placeholder="current value">
                    </div>
                    <div class="form-group">
                        <label>To</label>
                        <input type="text" name="interaction_to_${interactionCounter}" placeholder="new value">
                    </div>
                </div>

                <div class="form-row delta-fields" style="display: none;">
                    <div class="form-group">
                        <label>Property</label>
                        <input type="text" name="interaction_property_delta_${interactionCounter}" placeholder="e.g., quantity">
                    </div>
                    <div class="form-group">
                        <label>Delta</label>
                        <input type="number" name="interaction_delta_${interactionCounter}" placeholder="e.g., -1 or 5">
                    </div>
                </div>
                
                <div class="move-digital-object-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label>From Digital Location:</label>
                            <select name="from_digital_location_${interactionCounter}" class="from-location-select">
                                <option value="">Select source location...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>To Digital Location:</label>
                            <select name="to_digital_location_${interactionCounter}" class="to-location-select">
                                <option value="">Select target location...</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="move-display-element-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label>From Display:</label>
                            <select name="from_display_${interactionCounter}" class="from-display-select">
                                <option value="">Select source display...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>To Display:</label>
                            <select name="to_display_${interactionCounter}" class="to-display-select">
                                <option value="">Select target display...</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="add-object-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label>New Object Type</label>
                            <select name="new_object_type_${interactionCounter}" onchange="updateInteractionObjectTypeFields(this)">
                                <option value="">Select type...</option>
                                <option value="actor">Actor</option>
                                <option value="equipment">Equipment</option>
                                <option value="resource">Resource</option>
                                <option value="product">Product</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>New Object ID</label>
                            <input type="text" name="new_object_id_${interactionCounter}" placeholder="e.g., new_bread_loaf">
                        </div>
                        <div class="form-group">
                            <label>New Object Name</label>
                            <input type="text" name="new_object_name_${interactionCounter}" placeholder="e.g., Fresh Bread">
                        </div>
                         <div class="form-group">
                            <label>Emoji</label>
                            <input type="text" name="new_object_emoji_${interactionCounter}" placeholder="🍞" maxlength="2">
                        </div>
                    </div>
                    <div class="form-row type-specific-fields-container">
                        <!-- Type-specific fields will be injected here -->
                    </div>
                </div>
            </div>
            
            <div class="form-group revert-checkbox-group">
                <label class="inline-checkbox">
                    <input type="checkbox" name="revert_after_${interactionCounter}">
                    Revert After Task
                </label>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', interactionHTML);

    const newEmojiInput = container.querySelector(`input[name="new_object_emoji_${interactionCounter}"]`);
    if (newEmojiInput && window.emojiPicker) {
        window.emojiPicker.attachToInput(newEmojiInput, { autoOpen: true });
    }
}

function updateInteractionObjectTypeFields(selectElement) {
    const type = selectElement.value;
    const group = selectElement.closest('.interaction-group');
    const container = group.querySelector('.type-specific-fields-container');
    const counter = group.id.split('-')[1];
    const context = getCurrentTimelineContext();
    container.innerHTML = getObjectTypeFieldsHTML(type, context, counter);
}


function toggleInteractionFields(selectElement) {
    const group = selectElement.closest('.interaction-group');
    const objectSelection = group.querySelector('.object-selection-group');
    const fromTo = group.querySelector('.from-to-fields');
    const delta = group.querySelector('.delta-fields');
    const addObject = group.querySelector('.add-object-fields');
    const revertCheckbox = group.querySelector('.revert-checkbox-group');

    // Hide all by default
    objectSelection.style.display = 'none';
    fromTo.style.display = 'none';
    delta.style.display = 'none';
    addObject.style.display = 'none';
    revertCheckbox.style.display = 'block'; // Show by default
    
    // Hide new interaction fields
    const moveDigitalFields = group.querySelector('.move-digital-object-fields');
    const moveDisplayFields = group.querySelector('.move-display-element-fields');
    if (moveDigitalFields) moveDigitalFields.style.display = 'none';
    if (moveDisplayFields) moveDisplayFields.style.display = 'none';

    if (selectElement.value === 'from_to') {
        objectSelection.style.display = 'block';
        fromTo.style.display = 'flex';
    } else if (selectElement.value === 'delta') {
        objectSelection.style.display = 'block';
        delta.style.display = 'flex';
    } else if (selectElement.value === 'add_object') {
        addObject.style.display = 'block';
        revertCheckbox.style.display = 'none'; // Cannot revert adding an object
    } else if (selectElement.value === 'remove_object') {
        objectSelection.style.display = 'block';
    } else if (selectElement.value === 'move_digital_object') {
        objectSelection.style.display = 'block';
        if (moveDigitalFields) {
            moveDigitalFields.style.display = 'block';
            populateDigitalLocationOptions(moveDigitalFields);
        }
    } else if (selectElement.value === 'move_display_element') {
        objectSelection.style.display = 'block';
        if (moveDisplayFields) {
            moveDisplayFields.style.display = 'block';
            populateDisplayOptions(moveDisplayFields);
        }
    }
}

// Helper functions for populating move interaction dropdowns
function populateDigitalLocationOptions(moveFields) {
    const context = getCurrentTimelineContext();
    const fromSelect = moveFields.querySelector('.from-location-select');
    const toSelect = moveFields.querySelector('.to-location-select');
    
    if (fromSelect && toSelect && context.digitalLocations) {
        const options = context.digitalLocations.map(loc => 
            `<option value="${loc.id}">${loc.name}</option>`
        ).join('');
        
        fromSelect.innerHTML = '<option value="">Select source location...</option>' + options;
        toSelect.innerHTML = '<option value="">Select target location...</option>' + options;
    }
}

function populateDisplayOptions(moveFields) {
    const context = getCurrentTimelineContext();
    const fromSelect = moveFields.querySelector('.from-display-select');
    const toSelect = moveFields.querySelector('.to-display-select');
    
    if (fromSelect && toSelect && context.displays) {
        const options = context.displays.map(display => 
            `<option value="${display.id}">${display.name}</option>`
        ).join('');
        
        fromSelect.innerHTML = '<option value="">Select source display...</option>' + options;
        toSelect.innerHTML = '<option value="">Select target display...</option>' + options;
    }
}

// Remove interaction
function removeInteraction(button) {
    const interactionGroup = button.closest('.interaction-group');
    if (interactionGroup) {
        interactionGroup.remove();
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
        
        if (!objectType || !objectName) {
            alert('Please fill in object type and name');
            return;
        }
        
        const currentJson = JSON.parse(editor.getValue());
        const finalObjectId = objectId || getNextAvailableId(objectType, currentJson.simulation.objects || []);
        
        const properties = {};
        const fieldsContainer = document.getElementById('object-type-specific-fields');
        const inputs = fieldsContainer.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const name = input.name.replace('_modal', '');
            if (input.value && name) {
                if (input.type === 'number') {
                    properties[name] = parseFloat(input.value) || parseInt(input.value);
                } else {
                    properties[name] = input.value;
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
            newObject.properties.emoji = emoji;
        }
        
        // Add default indicator_property for common types
        if (objectType === 'resource') {
            newObject.indicator_property = ['quantity'];
        } else if (objectType === 'equipment') {
            newObject.indicator_property = ['state'];
        }
        
        if (!currentJson.simulation.objects) {
            currentJson.simulation.objects = [];
        }
        currentJson.simulation.objects.push(newObject);
        
        editor.setValue(JSON.stringify(currentJson, null, 2));
        modal.style.display = 'none';
        
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
        
        if (!taskId || !emoji || !actorId || !location || !startTime) {
            alert('Please fill in all required fields');
            return;
        }
        
        const currentJson = JSON.parse(editor.getValue());
        
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
        
        const interactionGroups = document.querySelectorAll('.interaction-group');
        interactionGroups.forEach(group => {
            const counter = group.id.split('-')[1];
            const changeType = group.querySelector(`select[name="interaction_change_type_${counter}"]`).value;
            const objectId = group.querySelector(`select[name="interaction_object_${counter}"]`).value;
            const revertAfter = group.querySelector(`input[name="revert_after_${counter}"]`).checked;

            const interaction = {
                revert_after: revertAfter
            };

            if (changeType === 'from_to' || changeType === 'delta' || changeType === 'remove_object') {
                if (!objectId) return;
                interaction.object_id = objectId;
            }

            if (changeType === 'from_to') {
                const property = group.querySelector(`input[name="interaction_property_${counter}"]`).value;
                const from = group.querySelector(`input[name="interaction_from_${counter}"]`).value;
                const to = group.querySelector(`input[name="interaction_to_${counter}"]`).value;
                if (property && to) {
                    interaction.property_changes = { [property]: { from: from || undefined, to: to } };
                    newTask.interactions.push(interaction);
                }
            } else if (changeType === 'delta') {
                const property = group.querySelector(`input[name="interaction_property_delta_${counter}"]`).value;
                const delta = group.querySelector(`input[name="interaction_delta_${counter}"]`).value;
                if (property && delta) {
                    interaction.property_changes = { [property]: { delta: parseFloat(delta) } };
                    newTask.interactions.push(interaction);
                }
            } else if (changeType === 'add_object') {
                const newObjectType = group.querySelector(`select[name="new_object_type_${counter}"]`).value;
                const newObjectId = group.querySelector(`input[name="new_object_id_${counter}"]`).value;
                const newObjectName = group.querySelector(`input[name="new_object_name_${counter}"]`).value;
                const newObjectEmoji = group.querySelector(`input[name="new_object_emoji_${counter}"]`).value;

                if (newObjectType && newObjectId && newObjectName) {
                    const newObject = {
                        id: newObjectId,
                        type: newObjectType,
                        name: newObjectName,
                        properties: {}
                    };
                    if (newObjectEmoji) newObject.properties.emoji = newObjectEmoji;

                    const propInputs = group.querySelectorAll('.type-specific-fields-container input, .type-specific-fields-container select');
                    propInputs.forEach(input => {
                        if (input.value && input.name) {
                            const propName = input.name.replace(`new_object_`, '').replace(`_${counter}`, '');
                            newObject.properties[propName] = input.value;
                        }
                    });
                    
                    interaction.add_objects = [newObject];
                    newTask.interactions.push(interaction);
                }
            } else if (changeType === 'remove_object') {
                interaction.remove_objects = [objectId];
                newTask.interactions.push(interaction);
            } else if (changeType === 'move_digital_object') {
                const fromLocationId = group.querySelector(`select[name="from_digital_location_${counter}"]`).value;
                const toLocationId = group.querySelector(`select[name="to_digital_location_${counter}"]`).value;
                if (objectId && fromLocationId && toLocationId) {
                    interaction.move_digital_object = {
                        object_id: objectId,
                        from_location_id: fromLocationId,
                        to_location_id: toLocationId
                    };
                    newTask.interactions.push(interaction);
                }
            } else if (changeType === 'move_display_element') {
                const fromDisplayId = group.querySelector(`select[name="from_display_${counter}"]`).value;
                const toDisplayId = group.querySelector(`select[name="to_display_${counter}"]`).value;
                if (objectId && fromDisplayId && toDisplayId) {
                    interaction.move_display_element = {
                        element_id: objectId,
                        from_display_id: fromDisplayId,
                        to_display_id: toDisplayId
                    };
                    newTask.interactions.push(interaction);
                }
            }
        });
        
        if (!currentJson.simulation.tasks) {
            currentJson.simulation.tasks = [];
        }
        currentJson.simulation.tasks.push(newTask);
        
        editor.setValue(JSON.stringify(currentJson, null, 2));
        document.getElementById('add-task-modal').style.display = 'none';
        
        if (autoRender) {
            renderSimulation();
        }
        
        showNotification(`Added task: ${taskId}`);
        
    } catch (error) {
        console.error('Error adding task:', error);
        alert(`Error adding task: ${error.message}`);
    }
}