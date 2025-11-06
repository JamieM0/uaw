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

// Store preserved field values when switching types
let preservedObjectFields = {};

// Open add object modal
function openAddObjectModal() {
    const modal = document.getElementById('add-object-modal');
    const typeSelect = document.getElementById('object-type-select');
    const fieldsContainer = document.getElementById('object-type-specific-fields');

    // Clear form and validation
    modal.querySelectorAll('input, select').forEach(input => {
        input.value = '';
        input.classList.remove('valid', 'invalid');
    });
    modal.querySelectorAll('.validation-icon').forEach(icon => {
        icon.classList.remove('valid', 'invalid');
    });
    modal.querySelectorAll('.field-error').forEach(error => {
        error.textContent = '';
    });

    // Reset preserved fields
    preservedObjectFields = {};

    // Show modal
    modal.style.display = 'flex';

    // Setup type change handler
    typeSelect.addEventListener('change', function() {
        preserveCommonObjectFields();
        updateObjectTypeFields(this.value, fieldsContainer);
        restoreCommonObjectFields();
        validateObjectForm();
    });

    // Trigger initial update
    updateObjectTypeFields(typeSelect.value, fieldsContainer);

    // Setup validation listeners
    setupObjectValidation();

    // Setup keyboard shortcuts
    setupObjectModalKeyboardShortcuts(modal);

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

    // Autofocus on first field
    setTimeout(() => {
        const firstInput = typeSelect;
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);

    // Initial validation
    validateObjectForm();
}

// Preserve common fields when switching object types
function preserveCommonObjectFields() {
    const idInput = document.getElementById('object-id-input');
    const nameInput = document.getElementById('object-name-input');
    const emojiInput = document.getElementById('object-emoji-input');

    preservedObjectFields = {
        id: idInput ? idInput.value : '',
        name: nameInput ? nameInput.value : '',
        emoji: emojiInput ? emojiInput.value : ''
    };
}

// Restore common fields after switching object types
function restoreCommonObjectFields() {
    const idInput = document.getElementById('object-id-input');
    const nameInput = document.getElementById('object-name-input');
    const emojiInput = document.getElementById('object-emoji-input');

    if (idInput && preservedObjectFields.id) {
        idInput.value = preservedObjectFields.id;
    }
    if (nameInput && preservedObjectFields.name) {
        nameInput.value = preservedObjectFields.name;
    }
    if (emojiInput && preservedObjectFields.emoji) {
        emojiInput.value = preservedObjectFields.emoji;
    }
}

// Setup keyboard shortcuts for object modal
function setupObjectModalKeyboardShortcuts(modal) {
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            modal.style.display = 'none';
            document.removeEventListener('keydown', keyHandler);
        } else if (e.key === 'Enter' && !e.shiftKey) {
            const addBtn = document.getElementById('object-add-btn');
            if (addBtn && !addBtn.disabled) {
                e.preventDefault();
                addObjectToSimulation();
                document.removeEventListener('keydown', keyHandler);
            }
        }
    };

    document.addEventListener('keydown', keyHandler);

    // Clean up listener when modal closes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style' && modal.style.display === 'none') {
                document.removeEventListener('keydown', keyHandler);
                observer.disconnect();
            }
        });
    });

    observer.observe(modal, { attributes: true });
}

// Setup validation listeners for object form
function setupObjectValidation() {
    const typeSelect = document.getElementById('object-type-select');
    const idInput = document.getElementById('object-id-input');
    const nameInput = document.getElementById('object-name-input');
    const emojiInput = document.getElementById('object-emoji-input');

    if (typeSelect) {
        typeSelect.addEventListener('change', validateObjectForm);
    }

    if (idInput) {
        idInput.addEventListener('input', debounce(() => {
            validateObjectId();
            validateObjectForm();
        }, 300));
    }

    if (nameInput) {
        nameInput.addEventListener('input', debounce(() => {
            validateObjectName();
            validateObjectForm();
        }, 300));
    }

    if (emojiInput) {
        emojiInput.addEventListener('input', debounce(() => {
            validateObjectEmoji();
            validateObjectForm();
        }, 300));
    }
}

// Validate object ID field
function validateObjectId() {
    const idInput = document.getElementById('object-id-input');
    const errorElement = document.getElementById('object-id-error');
    const validationIcon = idInput.parentElement.querySelector('.validation-icon');
    const id = idInput.value.trim();

    // Clear previous validation
    idInput.classList.remove('valid', 'invalid');
    validationIcon.classList.remove('valid', 'invalid');
    errorElement.textContent = '';

    if (!id) {
        idInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'ID is required';
        return false;
    }

    // Check format (lowercase, underscores, numbers)
    const validIdPattern = /^[a-z][a-z0-9_]*$/;
    if (!validIdPattern.test(id)) {
        idInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'ID must start with lowercase letter and contain only lowercase letters, numbers, and underscores';
        return false;
    }

    // Check for duplicates
    if (isObjectIdDuplicate(id)) {
        idInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'This ID already exists in the simulation';
        return false;
    }

    // Valid
    idInput.classList.add('valid');
    validationIcon.classList.add('valid');
    return true;
}

// Check if object ID already exists
function isObjectIdDuplicate(id) {
    try {
        const dayTypeEditor = window.activeDayTypeEditor;
        const effectiveEditor = dayTypeEditor || editor;
        const currentJson = JSON.parse(effectiveEditor.getValue());

        if (!currentJson.simulation || !currentJson.simulation.objects) {
            return false;
        }

        return currentJson.simulation.objects.some(obj => obj.id === id);
    } catch (error) {
        console.error('Error checking for duplicate ID:', error);
        return false;
    }
}

// Validate object name field
function validateObjectName() {
    const nameInput = document.getElementById('object-name-input');
    const errorElement = document.getElementById('object-name-error');
    const validationIcon = nameInput.parentElement.querySelector('.validation-icon');
    const name = nameInput.value.trim();

    // Clear previous validation
    nameInput.classList.remove('valid', 'invalid');
    validationIcon.classList.remove('valid', 'invalid');
    errorElement.textContent = '';

    if (!name) {
        nameInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'Name is required';
        return false;
    }

    if (name.length < 2) {
        nameInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'Name must be at least 2 characters';
        return false;
    }

    // Valid
    nameInput.classList.add('valid');
    validationIcon.classList.add('valid');
    return true;
}

// Validate emoji field
function validateObjectEmoji() {
    const emojiInput = document.getElementById('object-emoji-input');
    const errorElement = document.getElementById('object-emoji-error');
    const validationIcon = emojiInput.parentElement.querySelector('.validation-icon');
    const emoji = emojiInput.value;

    // Clear previous validation
    emojiInput.classList.remove('valid', 'invalid');
    validationIcon.classList.remove('valid', 'invalid');
    errorElement.textContent = '';

    // Emoji is optional
    if (!emoji) {
        return true;
    }

    // Check if it contains emoji characters
    const emojiPattern = /[\p{Emoji}\u200d]/u;
    if (!emojiPattern.test(emoji)) {
        emojiInput.classList.add('invalid');
        validationIcon.classList.add('invalid');
        errorElement.textContent = 'Please enter a valid emoji character';
        return false;
    }

    // Valid
    emojiInput.classList.add('valid');
    validationIcon.classList.add('valid');
    return true;
}

// Validate object type field
function validateObjectType() {
    const typeSelect = document.getElementById('object-type-select');
    const errorElement = document.getElementById('object-type-error');
    const type = typeSelect.value;

    // Clear previous validation
    typeSelect.classList.remove('valid', 'invalid');
    errorElement.textContent = '';

    if (!type) {
        typeSelect.classList.add('invalid');
        errorElement.textContent = 'Please select an object type';
        return false;
    }

    // Valid
    typeSelect.classList.add('valid');
    return true;
}

// Validate entire object form and update submit button state
function validateObjectForm() {
    const addBtn = document.getElementById('object-add-btn');

    const isTypeValid = validateObjectType();
    const isIdValid = validateObjectId();
    const isNameValid = validateObjectName();
    const isEmojiValid = validateObjectEmoji();

    const isFormValid = isTypeValid && isIdValid && isNameValid && isEmojiValid;

    if (addBtn) {
        addBtn.disabled = !isFormValid;
    }

    return isFormValid;
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
        case 'custom':
            fieldsHTML = `
                <div class="form-group">
                    <label>Custom Type Name</label>
                    <input type="text" name="new_object_custom_type_${counter}" placeholder="e.g., vehicle, document, sensor" required>
                </div>
                <div class="custom-properties-section">
                    <div class="section-header">
                        <label>Custom Properties</label>
                        <button type="button" class="btn-secondary btn-small" onclick="addCustomProperty('${counter}')">+ Add Property</button>
                    </div>
                    <div id="custom-properties-${counter}" class="custom-properties-container">
                        <!-- Custom properties will be added here -->
                    </div>
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

// Add custom property to custom object type
function addCustomProperty(counter) {
    const container = document.getElementById(`custom-properties-${counter}`);
    if (!container) return;

    const propertyCount = container.children.length;
    const propertyHTML = `
        <div class="custom-property-group">
            <div class="form-row">
                <div class="form-group">
                    <label>Property Name</label>
                    <input type="text" name="custom_property_name_${counter}_${propertyCount}" placeholder="e.g., status, capacity">
                </div>
                <div class="form-group">
                    <label>Property Type</label>
                    <select name="custom_property_type_${counter}_${propertyCount}">
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">True/False</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Initial Value</label>
                    <input type="text" name="custom_property_value_${counter}_${propertyCount}" placeholder="Initial value">
                </div>
                <div class="form-group-actions">
                    <button type="button" class="btn-remove" onclick="removeCustomProperty(this)">Remove</button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', propertyHTML);
}

// Remove custom property
function removeCustomProperty(button) {
    const propertyGroup = button.closest('.custom-property-group');
    if (propertyGroup) {
        propertyGroup.remove();
    }
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

    // Setup task time change listener for interaction 'from' values
    setupTaskTimeChangeListener();

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
        // Reset button text to "Add" for add mode
        addBtn.textContent = 'Add Task';
        // Clear any existing mode data
        modal.dataset.mode = 'add';
        modal.dataset.taskId = '';

        addBtn.onclick = (e) => {
            e.preventDefault();
            saveTaskToSimulation(); // Use unified save function
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

// Open edit task modal
function openEditTaskModal(task) {
    const modal = document.getElementById('add-task-modal');
    const actorSelect = document.getElementById('task-actor-select');
    const locationSelect = document.getElementById('task-location-select');
    const startTimeInput = document.getElementById('task-start-input');
    const taskIdInput = document.getElementById('task-id-input');
    const taskEmojiInput = document.getElementById('task-emoji-input');
    const taskDurationInput = document.getElementById('task-duration-input');
    const taskEndTimeInput = document.getElementById('task-end-time-input');

    // Clear form first
    modal.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });

    // Set mode to duration input by default
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

    // Populate form with existing task data
    if (taskIdInput) taskIdInput.value = task.id || '';
    if (taskEmojiInput) taskEmojiInput.value = task.emoji || '';
    if (actorSelect) actorSelect.value = task.actor_id || '';
    if (locationSelect) locationSelect.value = task.location || '';
    if (startTimeInput) startTimeInput.value = task.start || '';
    if (taskDurationInput) taskDurationInput.value = task.duration || '';

    // Calculate end time if needed
    if (task.start && task.duration) {
        const startMinutes = parseTimeToMinutes(task.start);
        const endMinutes = startMinutes + (task.duration || 0);
        const endTime = minutesToTimeString(endMinutes);
        if (taskEndTimeInput) taskEndTimeInput.value = endTime;
    }

    // Populate interactions if they exist
    if (task.interactions && task.interactions.length > 0) {
        task.interactions.forEach(interaction => {
            addInteraction();
            const lastInteractionGroup = document.querySelector('.interaction-group:last-child');
            if (lastInteractionGroup) {
                const counter = lastInteractionGroup.id.split('-')[1];

                // Determine interaction type and populate fields
                if (interaction.property_changes) {
                    const propertyName = Object.keys(interaction.property_changes)[0];
                    const changeData = interaction.property_changes[propertyName];

                    if (changeData.hasOwnProperty('from') && changeData.hasOwnProperty('to')) {
                        // From/To interaction
                        const changeTypeSelect = lastInteractionGroup.querySelector(`select[name="interaction_change_type_${counter}"]`);
                        const objectSelect = lastInteractionGroup.querySelector(`select[name="interaction_object_${counter}"]`);
                        const propertySelect = lastInteractionGroup.querySelector(`select[name="interaction_property_${counter}"]`);
                        const fromInput = lastInteractionGroup.querySelector(`input[name="interaction_from_${counter}"]`);
                        const toInput = lastInteractionGroup.querySelector(`input[name="interaction_to_${counter}"]`);

                        if (changeTypeSelect) changeTypeSelect.value = 'from_to';
                        if (objectSelect) {
                            objectSelect.value = interaction.object_id || '';
                            // Trigger property dropdown update
                            updateInteractionPropertyOptions(objectSelect);
                        }
                        if (propertySelect) {
                            // Wait for property options to be populated, then set value
                            setTimeout(() => {
                                propertySelect.value = propertyName;
                                // Trigger from value update
                                updatePropertyFromValue(propertySelect);
                            }, 50);
                        }
                        if (fromInput) fromInput.value = changeData.from || '';
                        if (toInput) toInput.value = changeData.to || '';

                        toggleInteractionFields(changeTypeSelect);
                    } else if (changeData.hasOwnProperty('delta')) {
                        // Delta interaction
                        const changeTypeSelect = lastInteractionGroup.querySelector(`select[name="interaction_change_type_${counter}"]`);
                        const objectSelect = lastInteractionGroup.querySelector(`select[name="interaction_object_${counter}"]`);
                        const propertyInput = lastInteractionGroup.querySelector(`input[name="interaction_property_delta_${counter}"]`);
                        const deltaInput = lastInteractionGroup.querySelector(`input[name="interaction_delta_${counter}"]`);

                        if (changeTypeSelect) changeTypeSelect.value = 'delta';
                        if (objectSelect) objectSelect.value = interaction.object_id || '';
                        if (propertyInput) propertyInput.value = propertyName;
                        if (deltaInput) deltaInput.value = changeData.delta || '';

                        toggleInteractionFields(changeTypeSelect);
                    }
                } else if (interaction.add_objects) {
                    // Add object interaction
                    const changeTypeSelect = lastInteractionGroup.querySelector(`select[name="interaction_change_type_${counter}"]`);
                    if (changeTypeSelect) {
                        changeTypeSelect.value = 'add_object';
                        toggleInteractionFields(changeTypeSelect);

                        const addedObject = interaction.add_objects[0];
                        if (addedObject) {
                            const newObjectTypeSelect = lastInteractionGroup.querySelector(`select[name="new_object_type_${counter}"]`);
                            const newObjectIdInput = lastInteractionGroup.querySelector(`input[name="new_object_id_${counter}"]`);
                            const newObjectNameInput = lastInteractionGroup.querySelector(`input[name="new_object_name_${counter}"]`);
                            const newObjectEmojiInput = lastInteractionGroup.querySelector(`input[name="new_object_emoji_${counter}"]`);

                            if (newObjectTypeSelect) newObjectTypeSelect.value = addedObject.type || '';
                            if (newObjectIdInput) newObjectIdInput.value = addedObject.id || '';
                            if (newObjectNameInput) newObjectNameInput.value = addedObject.name || '';
                            if (newObjectEmojiInput) newObjectEmojiInput.value = addedObject.properties?.emoji || '';

                            // Trigger type-specific fields update
                            if (newObjectTypeSelect) {
                                updateInteractionObjectTypeFields(newObjectTypeSelect);

                                // Populate type-specific properties
                                if (addedObject.properties) {
                                    Object.entries(addedObject.properties).forEach(([key, value]) => {
                                        if (key !== 'emoji') {
                                            const propertyInput = lastInteractionGroup.querySelector(`input[name="new_object_${key}_${counter}"], select[name="new_object_${key}_${counter}"]`);
                                            if (propertyInput) propertyInput.value = value;
                                        }
                                    });
                                }
                            }
                        }
                    }
                } else if (interaction.remove_objects) {
                    // Remove object interaction
                    const changeTypeSelect = lastInteractionGroup.querySelector(`select[name="interaction_change_type_${counter}"]`);
                    const objectSelect = lastInteractionGroup.querySelector(`select[name="interaction_object_${counter}"]`);

                    if (changeTypeSelect) changeTypeSelect.value = 'remove_object';
                    if (objectSelect) objectSelect.value = interaction.remove_objects[0] || '';

                    toggleInteractionFields(changeTypeSelect);
                }

                // Set revert after checkbox
                const revertCheckbox = lastInteractionGroup.querySelector(`input[name="revert_after_${counter}"]`);
                if (revertCheckbox) revertCheckbox.checked = !!interaction.revert_after;
            }
        });
    }

    // Setup time input toggle
    setupTimeInputToggle();

    // Setup task time change listener for interaction 'from' values
    setupTaskTimeChangeListener();

    // Set the modal to edit mode
    modal.dataset.mode = 'edit';
    modal.dataset.taskId = task.id;

    modal.style.display = 'flex';

    // Setup close button and form submission for task modal
    const cancelBtn = document.getElementById('task-cancel-btn');
    const addBtn = document.getElementById('task-add-btn');

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            modal.dataset.mode = '';
            modal.dataset.taskId = '';
        };
    }

    if (addBtn) {
        // Change button text to "Save" for edit mode
        addBtn.textContent = 'Save';
        addBtn.onclick = (e) => {
            e.preventDefault();
            saveTaskToSimulation(); // Use a new function that handles both add and edit
        };
    }

    // Setup add interaction button
    const addInteractionBtn = document.getElementById('add-interaction-btn');
    if (addInteractionBtn) {
        addInteractionBtn.onclick = addInteraction;
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

    // Add physical locations
    if (context.locations && context.locations.length > 0) {
        const locationOptions = context.locations.map(loc =>
            `<option value="${loc.id}">${loc.name} (Physical Location)</option>`
        ).join('');
        objectOptions.push(`<optgroup label="Physical Locations">${locationOptions}</optgroup>`);
    }

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
                    <select name="interaction_object_${interactionCounter}" onchange="updateInteractionPropertyOptions(this)" required>
                        <option value="">Select object...</option>
                        ${objectOptions.join('')}
                    </select>
                </div>
            </div>

            <div class="interaction-fields">
                <div class="form-row from-to-fields">
                    <div class="form-group">
                        <label>Property</label>
                        <select name="interaction_property_${interactionCounter}" onchange="updatePropertyFromValue(this)" required>
                            <option value="">Select property...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>From</label>
                        <input type="text" name="interaction_from_${interactionCounter}" placeholder="current value" readonly>
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
                                <option value="custom">Custom</option>
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

// Update property options when object selection changes
function updateInteractionPropertyOptions(objectSelectElement) {
    const group = objectSelectElement.closest('.interaction-group');
    const propertySelect = group.querySelector('.from-to-fields select[name^="interaction_property_"]');
    const fromInput = group.querySelector('.from-to-fields input[name^="interaction_from_"]');

    if (!propertySelect || !fromInput) return;

    const objectId = objectSelectElement.value;
    propertySelect.innerHTML = '<option value="">Select property...</option>';
    fromInput.value = '';

    if (!objectId) return;

    try {
        const context = getCurrentTimelineContext();

        // Find the selected object across all object types
        let selectedObject = null;
        Object.values(context.objectsByType).forEach(objects => {
            const found = objects.find(obj => obj.id === objectId);
            if (found) selectedObject = found;
        });

        // Also check other object types (locations, digital objects, etc.)
        if (!selectedObject) {
            // Check locations
            const allLocations = [...(context.locations || []), ...(context.digitalLocations || [])];
            selectedObject = allLocations.find(obj => obj.id === objectId);

            // Check digital objects
            if (!selectedObject) {
                selectedObject = (context.digitalObjects || []).find(obj => obj.id === objectId);
            }

            // Check displays
            if (!selectedObject) {
                selectedObject = (context.displays || []).find(obj => obj.id === objectId);
            }

            // Check display elements
            if (!selectedObject) {
                selectedObject = (context.displayElements || []).find(obj => obj.id === objectId);
            }
        }

        if (selectedObject && selectedObject.properties) {
            // Populate property dropdown with object's properties
            Object.keys(selectedObject.properties).forEach(propertyName => {
                const option = document.createElement('option');
                option.value = propertyName;
                option.textContent = propertyName;
                propertySelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error updating property options:', error);
    }
}

// Update 'from' value when property selection changes
function updatePropertyFromValue(propertySelectElement) {
    const group = propertySelectElement.closest('.interaction-group');
    const objectSelect = group.querySelector('select[name^="interaction_object_"]');
    const fromInput = group.querySelector('input[name^="interaction_from_"]');

    if (!objectSelect || !fromInput) return;

    const objectId = objectSelect.value;
    const propertyName = propertySelectElement.value;

    fromInput.value = '';

    if (!objectId || !propertyName) return;

    try {
        // Get the current property value at the task's start time
        const currentValue = getPropertyValueAtTaskTime(objectId, propertyName);
        fromInput.value = currentValue !== null ? currentValue : '';

    } catch (error) {
        console.error('Error updating property from value:', error);
    }
}

// Get property value for an object at the current task's start time
function getPropertyValueAtTaskTime(objectId, propertyName) {
    try {
        const context = getCurrentTimelineContext();

        // Get the task start time from the modal
        const startTimeInput = document.getElementById('task-start-input');
        const taskStartTime = startTimeInput ? startTimeInput.value : context.startTime;

        // Find the object
        let targetObject = null;
        Object.values(context.objectsByType).forEach(objects => {
            const found = objects.find(obj => obj.id === objectId);
            if (found) targetObject = found;
        });

        // Also check other object types
        if (!targetObject) {
            const allLocations = [...(context.locations || []), ...(context.digitalLocations || [])];
            targetObject = allLocations.find(obj => obj.id === objectId);

            if (!targetObject) {
                targetObject = (context.digitalObjects || []).find(obj => obj.id === objectId);
            }

            if (!targetObject) {
                targetObject = (context.displays || []).find(obj => obj.id === objectId);
            }

            if (!targetObject) {
                targetObject = (context.displayElements || []).find(obj => obj.id === objectId);
            }
        }

        if (!targetObject || !targetObject.properties) {
            return null;
        }

        // Get the initial property value
        let currentValue = targetObject.properties[propertyName];

        // Check if any tasks that start before this task time modify this property
        const simulation = getCurrentSimulationData();
        if (simulation && simulation.simulation && simulation.simulation.tasks) {
            const taskStartMinutes = parseTimeToMinutes(taskStartTime);

            // Get tasks that complete before our task starts, sorted by time
            const earlierTasks = simulation.simulation.tasks
                .filter(task => {
                    const taskStart = parseTimeToMinutes(task.start);
                    const taskEnd = taskStart + (task.duration || 0);
                    return taskEnd <= taskStartMinutes;
                })
                .sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));

            // Apply property changes from earlier tasks
            for (const task of earlierTasks) {
                if (task.interactions) {
                    for (const interaction of task.interactions) {
                        if (interaction.object_id === objectId &&
                            interaction.property_changes &&
                            interaction.property_changes[propertyName]) {

                            const change = interaction.property_changes[propertyName];

                            if (change.hasOwnProperty('to')) {
                                // From/To change
                                currentValue = change.to;
                            } else if (change.hasOwnProperty('delta')) {
                                // Delta change
                                if (typeof currentValue === 'number') {
                                    currentValue += change.delta;
                                }
                            }
                        }
                    }
                }
            }
        }

        return currentValue;

    } catch (error) {
        console.error('Error getting property value at task time:', error);
        return null;
    }
}

// Setup listener for task time changes to update interaction 'from' values
function setupTaskTimeChangeListener() {
    const startTimeInput = document.getElementById('task-start-input');
    const durationInput = document.getElementById('task-duration-input');
    const endTimeInput = document.getElementById('task-end-time-input');

    if (startTimeInput) {
        startTimeInput.addEventListener('change', updateAllInteractionFromValues);
        startTimeInput.addEventListener('input', debounce(updateAllInteractionFromValues, 300));
    }

    if (durationInput) {
        durationInput.addEventListener('change', updateAllInteractionFromValues);
        durationInput.addEventListener('input', debounce(updateAllInteractionFromValues, 300));
    }

    if (endTimeInput) {
        endTimeInput.addEventListener('change', updateAllInteractionFromValues);
        endTimeInput.addEventListener('input', debounce(updateAllInteractionFromValues, 300));
    }
}

// Update all interaction 'from' values when task time changes
function updateAllInteractionFromValues() {
    const interactionGroups = document.querySelectorAll('.interaction-group');

    interactionGroups.forEach(group => {
        const objectSelect = group.querySelector('select[name^="interaction_object_"]');
        const propertySelect = group.querySelector('.from-to-fields select[name^="interaction_property_"]');
        const fromInput = group.querySelector('.from-to-fields input[name^="interaction_from_"]');

        if (objectSelect && propertySelect && fromInput &&
            objectSelect.value && propertySelect.value) {

            try {
                const currentValue = getPropertyValueAtTaskTime(objectSelect.value, propertySelect.value);
                fromInput.value = currentValue !== null ? currentValue : '';
            } catch (error) {
                console.error('Error updating interaction from value:', error);
            }
        }
    });
}

// Add object to simulation
function addObjectToSimulation() {
    try {
        const modal = document.getElementById('add-object-modal');
        const addBtn = document.getElementById('object-add-btn');
        const btnText = addBtn.querySelector('.btn-text');
        const btnSpinner = addBtn.querySelector('.btn-spinner');

        // Show loading state
        addBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';

        const objectType = document.getElementById('object-type-select').value;
        const objectName = document.getElementById('object-name-input').value.trim();
        const objectId = document.getElementById('object-id-input').value.trim();
        const emoji = document.getElementById('object-emoji-input').value;

        if (!objectType || !objectName) {
            alert('Please fill in object type and name');
            // Reset button state
            btnText.style.display = 'inline-block';
            btnSpinner.style.display = 'none';
            addBtn.disabled = false;
            return;
        }

        // Check if we're in day type editing mode
        const dayTypeEditor = window.activeDayTypeEditor;
        const effectiveEditor = dayTypeEditor || editor;

        const currentJson = JSON.parse(effectiveEditor.getValue());

        const finalObjectId = objectId || getNextAvailableId(objectType, currentJson.simulation.objects || []);

        const properties = {};
        let finalObjectType = objectType;

        if (objectType === 'custom') {
            // Handle custom object type
            const customTypeInput = document.querySelector('input[name^="new_object_custom_type_"]');
            if (customTypeInput && customTypeInput.value) {
                finalObjectType = customTypeInput.value;
            } else {
                alert('Please specify a custom type name');
                return;
            }

            // Process custom properties
            const customPropertiesContainer = document.querySelector('.custom-properties-container');
            if (customPropertiesContainer) {
                const propertyGroups = customPropertiesContainer.querySelectorAll('.custom-property-group');
                propertyGroups.forEach(group => {
                    const nameInput = group.querySelector('input[name^="custom_property_name_"]');
                    const typeSelect = group.querySelector('select[name^="custom_property_type_"]');
                    const valueInput = group.querySelector('input[name^="custom_property_value_"]');

                    if (nameInput && nameInput.value && valueInput && valueInput.value) {
                        const propertyName = nameInput.value;
                        const propertyType = typeSelect ? typeSelect.value : 'text';
                        let propertyValue = valueInput.value;

                        // Convert value based on type
                        if (propertyType === 'number' && propertyValue) {
                            propertyValue = parseFloat(propertyValue) || parseInt(propertyValue) || 0;
                        } else if (propertyType === 'boolean' && propertyValue) {
                            propertyValue = propertyValue.toLowerCase() === 'true' || propertyValue === '1';
                        }

                        properties[propertyName] = propertyValue;
                    }
                });
            }
        } else {
            // Handle standard object types
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
        }

        const newObject = {
            id: finalObjectId,
            type: finalObjectType,
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

        // Use the effective editor (wrapper if in day type mode, otherwise Monaco)
        effectiveEditor.setValue(JSON.stringify(currentJson, null, 2));
        modal.style.display = 'none';

        // Re-render the simulation to show the new object
        // When in day type mode, we need to manually trigger a re-render
        // because the editor change event might not fire properly
        if (autoRender) {
            if (dayTypeEditor) {
                // Force a re-render in day type mode
                setTimeout(() => {
                    // Set flag to prevent hiding multi-period UI during render
                    window.renderingSingleDayFromMultiPeriod = true;
                    if (typeof window.renderSimulation === 'function') {
                        window.renderSimulation(true);
                    }
                    // Restore breadcrumbs after rendering in multi-day mode
                    if (window.multiPeriodViewController) {
                        window.multiPeriodViewController.renderBreadcrumbs();
                    }
                }, 100);
            } else {
                renderSimulation();
            }
        }

        showNotification(`Added ${objectType}: ${objectName}`);

        // Reset button state
        setTimeout(() => {
            const btnText = document.getElementById('object-add-btn').querySelector('.btn-text');
            const btnSpinner = document.getElementById('object-add-btn').querySelector('.btn-spinner');
            btnText.style.display = 'inline-block';
            btnSpinner.style.display = 'none';
        }, 100);

    } catch (error) {
        console.error('Error adding object:', error);
        alert(`Error adding object: ${error.message}`);

        // Reset button state on error
        const addBtn = document.getElementById('object-add-btn');
        const btnText = addBtn.querySelector('.btn-text');
        const btnSpinner = addBtn.querySelector('.btn-spinner');
        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
        addBtn.disabled = false;
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

        if (!taskId || !emoji || !actorId || !startTime) {
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
                const property = group.querySelector(`select[name="interaction_property_${counter}"]`).value;
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

// Unified save task function that handles both add and edit modes
function saveTaskToSimulation() {
    try {
        const modal = document.getElementById('add-task-modal');
        const isEditMode = modal.dataset.mode === 'edit';
        const editTaskId = modal.dataset.taskId;

        const taskId = document.getElementById('task-id-input').value || generateUniqueId('task');
        const emoji = document.getElementById('task-emoji-input').value || '📋';
        const actorId = document.getElementById('task-actor-select').value;
        const location = document.getElementById('task-location-select').value;
        const startTime = document.getElementById('task-start-input').value;

        if (!taskId || !emoji || !actorId || !startTime) {
            alert('Please fill in all required fields');
            return;
        }

        // Check if we're in day type editing mode
        const dayTypeEditor = window.activeDayTypeEditor;
        const effectiveEditor = dayTypeEditor || editor;

        const currentJson = JSON.parse(effectiveEditor.getValue());

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

        // Process interactions (same logic as before)
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
                const property = group.querySelector(`select[name="interaction_property_${counter}"]`).value;
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
                    let finalInteractionObjectType = newObjectType;
                    const newObjectProperties = {};

                    if (newObjectEmoji) newObjectProperties.emoji = newObjectEmoji;

                    if (newObjectType === 'custom') {
                        // Handle custom object type in interactions
                        const customTypeInput = group.querySelector(`input[name="new_object_custom_type_${counter}"]`);
                        if (customTypeInput && customTypeInput.value) {
                            finalInteractionObjectType = customTypeInput.value;
                        }

                        // Process custom properties for interactions
                        const customPropertiesContainer = group.querySelector(`#custom-properties-${counter}`);
                        if (customPropertiesContainer) {
                            const propertyGroups = customPropertiesContainer.querySelectorAll('.custom-property-group');
                            propertyGroups.forEach(propGroup => {
                                const nameInput = propGroup.querySelector('input[name^="custom_property_name_"]');
                                const typeSelect = propGroup.querySelector('select[name^="custom_property_type_"]');
                                const valueInput = propGroup.querySelector('input[name^="custom_property_value_"]');

                                if (nameInput && nameInput.value && valueInput && valueInput.value) {
                                    const propertyName = nameInput.value;
                                    const propertyType = typeSelect ? typeSelect.value : 'text';
                                    let propertyValue = valueInput.value;

                                    // Convert value based on type
                                    if (propertyType === 'number' && propertyValue) {
                                        propertyValue = parseFloat(propertyValue) || parseInt(propertyValue) || 0;
                                    } else if (propertyType === 'boolean' && propertyValue) {
                                        propertyValue = propertyValue.toLowerCase() === 'true' || propertyValue === '1';
                                    }

                                    newObjectProperties[propertyName] = propertyValue;
                                }
                            });
                        }
                    } else {
                        // Handle standard object types in interactions
                        const propInputs = group.querySelectorAll('.type-specific-fields-container input, .type-specific-fields-container select');
                        propInputs.forEach(input => {
                            if (input.value && input.name) {
                                const propName = input.name.replace(`new_object_`, '').replace(`_${counter}`, '');
                                newObjectProperties[propName] = input.value;
                            }
                        });
                    }

                    const newObject = {
                        id: newObjectId,
                        type: finalInteractionObjectType,
                        name: newObjectName,
                        properties: newObjectProperties
                    };

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

        if (isEditMode && editTaskId) {
            // Edit mode: Find and replace existing task
            const taskIndex = currentJson.simulation.tasks.findIndex(t => t.id === editTaskId);
            if (taskIndex !== -1) {
                currentJson.simulation.tasks[taskIndex] = newTask;
                showNotification(`Updated task: ${taskId}`);
            } else {
                console.error(`Task ${editTaskId} not found for editing`);
                alert(`Error: Task ${editTaskId} not found for editing`);
                return;
            }
        } else {
            // Add mode: Add new task
            currentJson.simulation.tasks.push(newTask);
            showNotification(`Added task: ${taskId}`);
        }

        // Use the effective editor (wrapper if in day type mode, otherwise Monaco)
        effectiveEditor.setValue(JSON.stringify(currentJson, null, 2));
        modal.style.display = 'none';

        // Clear mode data
        modal.dataset.mode = '';
        modal.dataset.taskId = '';

        // Re-render the simulation to show the new/updated task
        if (autoRender) {
            if (dayTypeEditor) {
                // Force a re-render in day type mode
                setTimeout(() => {
                    // Set flag to prevent hiding multi-period UI during render
                    window.renderingSingleDayFromMultiPeriod = true;
                    if (typeof window.renderSimulation === 'function') {
                        window.renderSimulation(true);
                    }
                    // Restore breadcrumbs after rendering in multi-day mode
                    if (window.multiPeriodViewController) {
                        window.multiPeriodViewController.renderBreadcrumbs();
                    }
                }, 100);
            } else {
                renderSimulation();
            }
        }

    } catch (error) {
        console.error('Error saving task:', error);
        alert(`Error saving task: ${error.message}`);
    }
}