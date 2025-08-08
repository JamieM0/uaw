/**
 * Playground Dialogs Module
 * Handles dialog management system for adding tasks, actors, resources, and submission
 */

export class PlaygroundDialogs {
    constructor(core) {
        this.core = core;
        this.pageStructure = null;
        this.setupDialogEventListeners();
        this.loadPageStructure();
    }
    
    /**
     * Set up dialog-related event listeners
     */
    setupDialogEventListeners() {
        // Close dialog when clicking overlay
        document.addEventListener('click', (e) => {
            if (e.target.id === 'dialog-overlay') {
                this.closeDialog();
            }
        });
        
        // Close dialog on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDialog();
            }
        });
    }
    
    /**
     * Load page structure for submission dialog
     */
    async loadPageStructure() {
        try {
            const response = await fetch('/api/page-structure');
            if (response.ok) {
                this.pageStructure = await response.json();
                window.pageStructure = this.pageStructure; // For compatibility
                console.log("DIALOGS: Page structure loaded");
            }
        } catch (error) {
            console.warn("DIALOGS: Could not load page structure", error);
        }
    }
    
    /**
     * Open a generic dialog
     */
    openDialog(title, content) {
        let overlay = document.getElementById("dialog-overlay");
        
        // Create overlay if it doesn't exist
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dialog-overlay';
            overlay.className = 'dialog-overlay';
            overlay.innerHTML = `
                <div class="dialog" id="dialog-content">
                    <!-- Content will be inserted here -->
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        const dialogContent = document.getElementById("dialog-content");
        dialogContent.innerHTML = `
            <h3>${title}</h3>
            ${content}
        `;
        
        overlay.style.display = "flex";
        
        // Focus first input
        const firstInput = dialogContent.querySelector('input, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
    
    /**
     * Close the currently open dialog
     */
    closeDialog() {
        const overlay = document.getElementById("dialog-overlay");
        if (overlay) {
            overlay.style.display = "none";
        }
    }
    
    /**
     * Generate unique ID
     */
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Open add task dialog
     */
    openAddTaskDialog() {
        // Try to get existing data, fallback to empty arrays
        let actors = [];
        let resources = [];
        
        try {
            const simulation = this.core.editorManager.getCurrentJSON();
            actors = simulation?.simulation?.actors || [];
            resources = simulation?.simulation?.resources || [];
        } catch (e) {
            // If JSON is invalid or empty, use empty arrays
        }
        
        const actorOptions = actors
            .map(actor => `<option value="${actor.id}">${actor.role}</option>`)
            .join("");
        
        const resourceCheckboxes = resources
            .map(resource => `
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" value="${resource.id}" name="uses_resources">
                    ${resource.emoji} ${resource.name}
                </label>
            `).join("");
        
        const content = `
            <form class="dialog-form" onsubmit="return window.playgroundDialogs.addTask(event)">
                <div class="dialog-field">
                    <label>Task Name</label>
                    <input type="text" name="task_name" required placeholder="e.g., Mix dough">
                </div>
                <div class="dialog-field">
                    <label>Emoji</label>
                    <input type="text" name="emoji" placeholder="🥄" maxlength="2">
                </div>
                <div class="dialog-field">
                    <label>Assigned Actor</label>
                    <select name="actor_id" required>
                        <option value="">Select an actor...</option>
                        ${actorOptions}
                    </select>
                </div>
                <div class="dialog-field">
                    <label>Start Time</label>
                    <input type="time" name="start_time" required value="06:00">
                </div>
                <div class="dialog-field">
                    <label>Duration (minutes)</label>
                    <input type="number" name="duration" required min="1" value="30">
                </div>
                <div class="dialog-field">
                    <label>Uses Resources</label>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;">
                        ${resourceCheckboxes}
                    </div>
                </div>
                <div class="dialog-buttons">
                    <button type="button" class="btn-secondary" onclick="window.playgroundDialogs.closeDialog()">Cancel</button>
                    <button type="submit" class="btn-primary">Add Task</button>
                </div>
            </form>
        `;
        
        this.openDialog("Add New Task", content);
    }
    
    /**
     * Open add actor dialog
     */
    openAddActorDialog() {
        const content = `
            <form class="dialog-form" onsubmit="return window.playgroundDialogs.addActor(event)">
                <div class="dialog-field">
                    <label>Actor ID</label>
                    <input type="text" name="actor_id" required placeholder="e.g., chef, assistant" 
                           pattern="[a-z_]+" title="Use lowercase letters and underscores only">
                </div>
                <div class="dialog-field">
                    <label>Role/Title</label>
                    <input type="text" name="role" required placeholder="e.g., Head Chef">
                </div>
                <div class="dialog-field">
                    <label>Emoji</label>
                    <input type="text" name="emoji" placeholder="👨‍🍳" maxlength="2">
                </div>
                <div class="dialog-field">
                    <label>Skills (comma-separated)</label>
                    <input type="text" name="skills" placeholder="e.g., baking, food_prep, cleaning">
                </div>
                <div class="dialog-field">
                    <label>Shift Start</label>
                    <input type="time" name="shift_start" value="06:00">
                </div>
                <div class="dialog-field">
                    <label>Shift End</label>
                    <input type="time" name="shift_end" value="14:00">
                </div>
                <div class="dialog-buttons">
                    <button type="button" class="btn-secondary" onclick="window.playgroundDialogs.closeDialog()">Cancel</button>
                    <button type="submit" class="btn-primary">Add Actor</button>
                </div>
            </form>
        `;
        
        this.openDialog("Add New Actor", content);
    }
    
    /**
     * Open add resource dialog
     */
    openAddResourceDialog() {
        const content = `
            <form class="dialog-form" onsubmit="return window.playgroundDialogs.addResource(event)">
                <div class="dialog-field">
                    <label>Resource ID</label>
                    <input type="text" name="resource_id" required placeholder="e.g., mixing_bowl_large" 
                           pattern="[a-z_]+" title="Use lowercase letters and underscores only">
                </div>
                <div class="dialog-field">
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="e.g., Large Mixing Bowl">
                </div>
                <div class="dialog-field">
                    <label>Emoji</label>
                    <input type="text" name="emoji" placeholder="🥣" maxlength="2">
                </div>
                <div class="dialog-field">
                    <label>Type</label>
                    <select name="type" required>
                        <option value="">Select type...</option>
                        <option value="equipment">Equipment</option>
                        <option value="ingredient">Ingredient</option>
                        <option value="tool">Tool</option>
                        <option value="material">Material</option>
                        <option value="consumable">Consumable</option>
                    </select>
                </div>
                <div class="dialog-field">
                    <label>Initial State</label>
                    <select name="state">
                        <option value="available">Available</option>
                        <option value="clean">Clean</option>
                        <option value="dirty">Dirty</option>
                        <option value="in-use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                    </select>
                </div>
                <div class="dialog-field">
                    <label>Quantity (optional)</label>
                    <input type="number" name="quantity" min="0" placeholder="e.g., 5">
                </div>
                <div class="dialog-field">
                    <label>Unit (optional)</label>
                    <input type="text" name="unit" placeholder="e.g., kg, pieces, liters">
                </div>
                <div class="dialog-buttons">
                    <button type="button" class="btn-secondary" onclick="window.playgroundDialogs.closeDialog()">Cancel</button>
                    <button type="submit" class="btn-primary">Add Resource</button>
                </div>
            </form>
        `;
        
        this.openDialog("Add New Resource", content);
    }
    
    /**
     * Open submit dialog
     */
    openSubmitDialog() {
        const content = `
            <form class="dialog-form submit-dialog" onsubmit="return window.playgroundDialogs.handleSubmit(event)">
                <div class="cascade-container">
                    <div class="dialog-field">
                        <label>Domain</label>
                        <select name="domain" id="domain-select" required onchange="window.playgroundDialogs.updateSubcategories()">
                            <option value="">Select domain...</option>
                            <option value="food-production">Food Production</option>
                            <option value="manufacturing">Manufacturing</option>
                            <option value="healthcare">Healthcare</option>
                            <option value="transportation">Transportation</option>
                            <option value="technology">Technology</option>
                            <option value="entertainment">Entertainment</option>
                        </select>
                    </div>
                    
                    <div class="dialog-field cascade-dropdown" id="subcategory-field">
                        <label>Subcategory</label>
                        <select name="subcategory" id="subcategory-select" required onchange="window.playgroundDialogs.updatePages()">
                            <option value="">Select subcategory...</option>
                        </select>
                    </div>
                    
                    <div class="dialog-field cascade-dropdown" id="page-field">
                        <label>Page</label>
                        <select name="page" id="page-select" required onchange="window.playgroundDialogs.updatePreview()">
                            <option value="">Select page...</option>
                        </select>
                    </div>
                </div>
                
                <div id="path-preview" class="page-path-preview" style="display: none;">
                    Target path: <span id="preview-path"></span>
                </div>
                
                <div class="dialog-buttons">
                    <button type="button" class="btn-secondary" onclick="window.playgroundDialogs.closeDialog()">Cancel</button>
                    <button type="submit" class="btn-primary" id="submit-confirm-btn" disabled>Submit</button>
                </div>
            </form>
        `;
        
        this.openDialog("Submit Simulation", content);
    }
    
    /**
     * Add task from form submission
     */
    addTask(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const usesResources = Array.from(event.target.querySelectorAll('input[name="uses_resources"]:checked'))
            .map(checkbox => checkbox.value);
        
        const taskData = {
            id: this.generateId("task"),
            name: formData.get("task_name"),
            emoji: formData.get("emoji") || "📋",
            actor_id: formData.get("actor_id"),
            start_time: formData.get("start_time"),
            duration: parseInt(formData.get("duration")),
            uses_resources: usesResources,
            produces_resources: [],
            requires_resources: []
        };
        
        this.core.editorManager.addTask(taskData);
        this.closeDialog();
        
        return false; // Prevent form submission
    }
    
    /**
     * Add actor from form submission
     */
    addActor(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const skillsText = formData.get("skills") || "";
        const skills = skillsText.split(",").map(s => s.trim()).filter(s => s);
        
        const actorData = {
            id: formData.get("actor_id"),
            role: formData.get("role"),
            emoji: formData.get("emoji") || "👤",
            skills: skills,
            shift: {
                start: formData.get("shift_start") || "06:00",
                end: formData.get("shift_end") || "14:00"
            }
        };
        
        this.core.editorManager.addActor(actorData);
        this.closeDialog();
        
        return false; // Prevent form submission
    }
    
    /**
     * Add resource from form submission
     */
    addResource(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        const resourceData = {
            id: formData.get("resource_id"),
            name: formData.get("name"),
            emoji: formData.get("emoji") || "📦",
            type: formData.get("type"),
            state: formData.get("state") || "available"
        };
        
        // Add optional fields if provided
        const quantity = formData.get("quantity");
        if (quantity) {
            resourceData.quantity = parseInt(quantity);
        }
        
        const unit = formData.get("unit");
        if (unit) {
            resourceData.unit = unit;
        }
        
        this.core.editorManager.addResource(resourceData);
        this.closeDialog();
        
        return false; // Prevent form submission
    }
    
    /**
     * Update subcategories dropdown based on domain selection
     */
    updateSubcategories() {
        const domainSelect = document.getElementById("domain-select");
        const subcategorySelect = document.getElementById("subcategory-select");
        const subcategoryField = document.getElementById("subcategory-field");
        const pageField = document.getElementById("page-field");
        
        // Clear existing options
        subcategorySelect.innerHTML = '<option value="">Select subcategory...</option>';
        
        const selectedDomain = domainSelect.value;
        if (selectedDomain && this.pageStructure && this.pageStructure[selectedDomain]) {
            const subcategories = Object.keys(this.pageStructure[selectedDomain]);
            subcategories.forEach(subcategory => {
                const option = document.createElement("option");
                option.value = subcategory;
                option.textContent = this.cleanDisplayName(subcategory);
                subcategorySelect.appendChild(option);
            });
            
            subcategoryField.classList.add("visible");
        } else {
            subcategoryField.classList.remove("visible");
        }
        
        // Hide page field
        pageField.classList.remove("visible");
        this.updatePreview();
    }
    
    /**
     * Update pages dropdown based on subcategory selection
     */
    updatePages() {
        const domainSelect = document.getElementById("domain-select");
        const subcategorySelect = document.getElementById("subcategory-select");
        const pageSelect = document.getElementById("page-select");
        const pageField = document.getElementById("page-field");
        
        // Clear existing options
        pageSelect.innerHTML = '<option value="">Select page...</option>';
        
        const selectedDomain = domainSelect.value;
        const selectedSubcategory = subcategorySelect.value;
        
        if (selectedDomain && 
            selectedSubcategory && 
            this.pageStructure && 
            this.pageStructure[selectedDomain] && 
            this.pageStructure[selectedDomain][selectedSubcategory]) {
            
            const pages = this.pageStructure[selectedDomain][selectedSubcategory];
            pages.sort().forEach(page => {
                const option = document.createElement("option");
                option.value = page;
                option.textContent = this.cleanDisplayName(page);
                pageSelect.appendChild(option);
            });
            
            if (pages.length > 0) {
                pageField.classList.add("visible");
                
                // Auto-select if there's a good match for the current simulation
                const simulationData = this.core.getCurrentSimulationData();
                if (simulationData && 
                    selectedDomain === "food-production" && 
                    selectedSubcategory === "baking") {
                    
                    const breadmakingOption = pageSelect.querySelector('option[value="breadmaking"]');
                    if (breadmakingOption) {
                        pageSelect.value = "breadmaking";
                        this.updatePreview();
                    }
                }
            }
        } else {
            pageField.classList.remove("visible");
        }
        
        this.updatePreview();
    }
    
    /**
     * Update path preview
     */
    updatePreview() {
        const domainSelect = document.getElementById("domain-select");
        const subcategorySelect = document.getElementById("subcategory-select");
        const pageSelect = document.getElementById("page-select");
        const previewDiv = document.getElementById("path-preview");
        const previewPath = document.getElementById("preview-path");
        const submitBtn = document.getElementById("submit-confirm-btn");
        
        const domain = domainSelect.value;
        const subcategory = subcategorySelect.value;
        const page = pageSelect.value;
        
        if (domain && subcategory && page) {
            const fullPath = `${domain}/${subcategory}/${page}`;
            previewPath.textContent = fullPath;
            previewDiv.style.display = "block";
            submitBtn.disabled = false;
        } else {
            previewDiv.style.display = "none";
            submitBtn.disabled = true;
        }
    }
    
    /**
     * Handle submission form
     */
    handleSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const domain = formData.get("domain");
        const subcategory = formData.get("subcategory");
        const page = formData.get("page");
        
        const targetPath = `${domain}/${subcategory}/${page}`;
        
        // For now, just show an alert - actual submission logic would go here
        alert(
            `Simulation would be submitted to: ${targetPath}\n\n(Submission functionality not implemented yet)`
        );
        
        this.closeDialog();
        return false;
    }
    
    /**
     * Clean display name for UI
     */
    cleanDisplayName(name) {
        return name
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
}

// Make dialogs globally available for form handlers
window.playgroundDialogs = null;