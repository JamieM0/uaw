// Digital Space Editor - Models digital environments, objects, and storage locations
class DigitalSpaceEditor {
    constructor() {
        this.canvas = null;
        this.propsPanel = null;
        this.monacoEditor = null;
        
        this.pixelsPerMeter = 20;
        this.isDrawing = false;
        this.isDragging = false;
        this.isPreparingToDrag = false;
        this.activeRectEl = null;
        this.selectedRectId = null;
        this.startCoords = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.currentDragPosition = { x: 0, y: 0 };
        this.initialMousePosition = { x: 0, y: 0 };
        this.digitalLocations = [];
        this.digitalObjects = [];

        this.isUpdatingJson = false;
        this.hasInitiallyLoaded = false;
        this.world = null;
        
        // Cache for performance optimization
        this.canvasRect = null;
        
        // Debouncing for JSON updates
        this.updateSimulationJsonTimeout = null;
        
        // Layer management
        this.activeLayer = 'all';
        this.availableLayers = new Set();
        
        // Snapping options
        this.snapSettings = {
            xEnabled: false,
            zEnabled: false,
            tolerance: 10
        };

        this.view = {
            scale: 1,
            x: 0,
            y: 0,
            isPanning: false,
            lastPan: { x: 0, y: 0 },
            scrollSensitivity: 1.0
        };
        
        // Space key timing for quick tap detection
        this.spaceKeyState = {
            isDown: false,
            downTime: 0,
            panActivated: false
        };
    }

    initialize(canvasEl, propsPanelEl, editor) {
        console.log("DIGITAL-SPACE: Initializing digital space editor");
        this.canvas = canvasEl;
        this.propsPanel = propsPanelEl;
        this.monacoEditor = editor;
        
        // Create world container
        this.world = document.createElement('div');
        this.world.className = 'digital-world';
        this.canvas.appendChild(this.world);
        
        this.setupEventListeners();
        this.loadFromSimulation();
        
        // Listen for editor changes to reload digital space data
        if (this.monacoEditor && this.monacoEditor.onDidChangeModelContent) {
            this.monacoEditor.onDidChangeModelContent(() => {
                // Only reload if we're not currently updating the JSON ourselves
                if (!this.isUpdatingJson) {
                    setTimeout(() => {
                        this.loadFromSimulation();
                        // Re-render properties panel to update digital objects list
                        this.renderPropertiesPanel();
                    }, 50); // Small delay to ensure JSON has been processed
                }
            });
        }
        
        console.log("DIGITAL-SPACE: Initialization complete");
    }

    setupEventListeners() {
        // Drawing button
        const addLocationBtn = document.getElementById('add-digital-location-btn');
        if (addLocationBtn) {
            addLocationBtn.addEventListener('click', () => {
                this.isDrawing = true;
                this.canvas.style.cursor = 'crosshair';
                this.deselectAll();
            });
        }

        // Add digital object button
        const addObjectBtn = document.getElementById('add-digital-object-btn');
        if (addObjectBtn) {
            addObjectBtn.addEventListener('click', () => {
                this.createNewDigitalObject();
            });
        }
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
        this.canvas.addEventListener('wheel', this.onCanvasWheel.bind(this), { passive: false });
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Cache canvas bounds on resize and initial load
        this.updateCanvasRect();
        window.addEventListener('resize', () => this.updateCanvasRect());

        // Zoom controls
        const zoomInBtn = document.getElementById('digital-zoom-in-btn');
        const zoomOutBtn = document.getElementById('digital-zoom-out-btn');
        const zoomFitBtn = document.getElementById('digital-zoom-fit-btn');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => this.zoomToFit());
        
        // Layer filtering
        const layerFilter = document.getElementById('digital-layer-filter');
        if (layerFilter) {
            layerFilter.addEventListener('change', (e) => {
                this.activeLayer = e.target.value;
                this.applyLayerFilter();
            });
        }

        const scrollSensitivitySlider = document.getElementById('digital-scroll-sensitivity');
        if (scrollSensitivitySlider) {
            this.view.scrollSensitivity = parseFloat(scrollSensitivitySlider.value);
            scrollSensitivitySlider.addEventListener('input', (e) => {
                this.view.scrollSensitivity = parseFloat(e.target.value);
            });
        }
    }

    updateCanvasRect() {
        if (this.canvas) {
            this.canvasRect = this.canvas.getBoundingClientRect();
        }
    }

    onCanvasMouseDown(e) {
        if (this.view.isPanning) {
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Only allow drawing/panning on the canvas itself or the world container
        if (e.target !== this.canvas && !e.target.classList.contains('digital-world')) {
            // Check if clicking on existing location
            const clickedEl = e.target.closest('.digital-location-rect');
            if (clickedEl) {
                const locationId = clickedEl.dataset.locationId;
                this.selectLocation(locationId);
                this.prepareForDrag(e, clickedEl);
                return;
            }
        }

        // Update rect cache for accuracy during interaction
        this.updateCanvasRect();
        const x = (e.clientX - this.canvasRect.left - this.view.x) / this.view.scale;
        const y = (e.clientY - this.canvasRect.top - this.view.y) / this.view.scale;

        if (this.isDrawing) {
            this.startDrawing(x, y);
        } else {
            // Start background panning when not in drawing mode
            this.view.isPanning = true;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            document.body.classList.add('digital-space-panning');
            document.body.classList.add('disable-animations');
            this.deselectAll();
        }
    }

    startDrawing(x, y) {
        this.startCoords = { x, y };
        
        // Create temporary rectangle
        this.activeRectEl = document.createElement('div');
        this.activeRectEl.className = 'digital-location-rect drawing';
        this.activeRectEl.style.left = x + 'px';
        this.activeRectEl.style.top = y + 'px';
        this.activeRectEl.style.width = '0px';
        this.activeRectEl.style.height = '0px';
        this.world.appendChild(this.activeRectEl);
    }

    onMouseMove(e) {
        if (this.view.isPanning) {
            const deltaX = e.clientX - this.view.lastPan.x;
            const deltaY = e.clientY - this.view.lastPan.y;
            this.view.x += deltaX;
            this.view.y += deltaY;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.updateViewTransform();
            return;
        }

        if (this.isDrawing && this.activeRectEl) {
            // Use cached canvas rect with fallback
            const rect = this.canvasRect || this.canvas.getBoundingClientRect();
            const currentX = (e.clientX - rect.left - this.view.x) / this.view.scale;
            const currentY = (e.clientY - rect.top - this.view.y) / this.view.scale;

            const width = Math.abs(currentX - this.startCoords.x);
            const height = Math.abs(currentY - this.startCoords.y);
            const left = Math.min(this.startCoords.x, currentX);
            const top = Math.min(this.startCoords.y, currentY);

            this.activeRectEl.style.left = left + 'px';
            this.activeRectEl.style.top = top + 'px';
            this.activeRectEl.style.width = width + 'px';
            this.activeRectEl.style.height = height + 'px';
        }

        // Check if we should start dragging based on mouse movement distance
        if (this.isPreparingToDrag && this.activeRectEl) {
            const deltaX = e.clientX - this.initialMousePosition.x;
            const deltaY = e.clientY - this.initialMousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Start dragging if mouse has moved more than 5 pixels
            if (distance > 5) {
                this.startDragging(this.activeRectEl);
            }
        }

        if (this.isDragging && this.activeRectEl) {
            // Use cached canvas rect with fallback
            const rect = this.canvasRect || this.canvas.getBoundingClientRect();
            const newX = (e.clientX - rect.left - this.view.x) / this.view.scale - this.dragOffset.x;
            const newY = (e.clientY - rect.top - this.view.y) / this.view.scale - this.dragOffset.y;

            this.currentDragPosition = { x: newX, y: newY };
            this.activeRectEl.style.left = newX + 'px';
            this.activeRectEl.style.top = newY + 'px';
        }
    }

    onMouseUp(e) {
        if (this.view.isPanning) {
            this.view.isPanning = false;
            this.canvas.style.cursor = 'default';
            document.body.classList.remove('digital-space-panning');
            document.body.classList.remove('disable-animations');
            return;
        }

        if (this.isDrawing && this.activeRectEl) {
            this.finishDrawing();
        }

        if (this.isDragging) {
            this.finishDragging();
        } else if (this.isPreparingToDrag) {
            // User clicked but didn't drag - just clean up preparation state
            this.isPreparingToDrag = false;
            this.activeRectEl = null;
        }
    }

    finishDrawing() {
        const bounds = this.activeRectEl.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // Calculate size in meters
        const widthPx = parseFloat(this.activeRectEl.style.width);
        const heightPx = parseFloat(this.activeRectEl.style.height);
        
        if (widthPx < 20 || heightPx < 20) {
            // Too small, cancel
            this.world.removeChild(this.activeRectEl);
            this.activeRectEl = null;
            this.isDrawing = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Create new digital location
        const locationId = 'digital_location_' + Date.now();
        const location = {
            id: locationId,
            name: 'New Digital Location',
            type: 'storage',
            layer: 1,
            x: parseFloat(this.activeRectEl.style.left) / this.pixelsPerMeter,
            y: parseFloat(this.activeRectEl.style.top) / this.pixelsPerMeter,
            z: 0,
            width: widthPx / this.pixelsPerMeter,
            height: heightPx / this.pixelsPerMeter,
            depth: 1,
            parent_id: null,
            physical_object_id: null,
            capacity_gb: 1000,
            storage_type: 'file_system'
        };

        this.digitalLocations.push(location);
        this.renderLocation(location);
        this.selectLocation(locationId);
        this.updateSimulationJson();

        // Cleanup
        this.world.removeChild(this.activeRectEl);
        this.activeRectEl = null;
        this.isDrawing = false;
        this.canvas.style.cursor = 'default';
    }

    renderLocation(location) {
        const existingEl = document.querySelector(`[data-location-id="${location.id}"]`);
        if (existingEl) {
            existingEl.remove();
        }

        const rectEl = document.createElement('div');
        rectEl.className = 'digital-location-rect';
        rectEl.dataset.locationId = location.id;
        rectEl.style.left = (location.x * this.pixelsPerMeter) + 'px';
        rectEl.style.top = (location.y * this.pixelsPerMeter) + 'px';
        rectEl.style.width = (location.width * this.pixelsPerMeter) + 'px';
        rectEl.style.height = (location.height * this.pixelsPerMeter) + 'px';
        
        // Add visual styling based on type
        rectEl.style.border = '2px solid #4CAF50';
        rectEl.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        
        // Add icon and label
        const icon = this.getLocationIcon(location.storage_type);
        rectEl.innerHTML = `
            <div class="location-label">
                <span class="location-icon">${sanitizeHTML(icon)}</span>
                <span class="location-name">${sanitizeHTML(location.name)}</span>
            </div>
        `;
        
        this.world.appendChild(rectEl);
    }

    getLocationIcon(storageType) {
        const icons = {
            'file_system': '💾',
            'database': '🗄️',
            'cloud': '☁️',
            'cache': '⚡',
            'backup': '💿',
            'network': '🌐',
            'server': '🖥️'
        };
        return icons[storageType] || '💾';
    }

    selectLocation(locationId) {
        // Remove selection from other elements
        document.querySelectorAll('.digital-location-rect.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select the clicked location
        const locationEl = document.querySelector(`[data-location-id="${locationId}"]`);
        if (locationEl) {
            locationEl.classList.add('selected');
        }
        
        this.selectedRectId = locationId;
        this.renderPropertiesPanel();
    }

    renderPropertiesPanel() {
        // Check if editor is initialized
        if (!this.propsPanel) {
            return;
        }
        
        if (!this.selectedRectId) {
            this.propsPanel.innerHTML = `
                <p class="placeholder">Select a digital location, or click '+ Add Location' to create a new storage area.</p>
                
                <div class="prop-section">
                    <div class="section-label">Digital Objects</div>
                    <div class="digital-objects-list" id="digital-objects-list">
                        ${this.digitalObjects.map(obj => `
                            <div class="object-item" data-object-id="${obj.id}">
                                <span class="object-icon">${this.getObjectIcon(obj.type)}</span>
                                <span class="object-name clickable" onclick="digitalSpaceEditor.renameDigitalObject('${obj.id}')" title="Click to rename">${obj.name}</span>
                                <span class="object-location">${this.getLocationName(obj.location_id)}</span>
                                <button class="btn-danger-small" onclick="digitalSpaceEditor.deleteDigitalObject('${obj.id}')">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            return;
        }

        const location = this.digitalLocations.find(l => l.id === this.selectedRectId);
        if (!location) return;

        this.propsPanel.innerHTML = `
            <div class="prop-section">
                <label class="section-label">Location Properties</label>
                
                <div class="prop-field">
                    <label for="digital-location-name">Name:</label>
                    <input type="text" id="digital-location-name" value="${location.name}">
                </div>
                
                <div class="prop-field">
                    <label for="digital-storage-type">Storage Type:</label>
                    <select id="digital-storage-type">
                        <option value="file_system" ${location.storage_type === 'file_system' ? 'selected' : ''}>💾 File System</option>
                        <option value="database" ${location.storage_type === 'database' ? 'selected' : ''}>🗄️ Database</option>
                        <option value="cloud" ${location.storage_type === 'cloud' ? 'selected' : ''}>☁️ Cloud Storage</option>
                        <option value="cache" ${location.storage_type === 'cache' ? 'selected' : ''}>⚡ Cache</option>
                        <option value="backup" ${location.storage_type === 'backup' ? 'selected' : ''}>💿 Backup Storage</option>
                        <option value="network" ${location.storage_type === 'network' ? 'selected' : ''}>🌐 Network Storage</option>
                        <option value="server" ${location.storage_type === 'server' ? 'selected' : ''}>🖥️ Server</option>
                    </select>
                </div>
                
                <div class="prop-field">
                    <label for="digital-capacity">Capacity (GB):</label>
                    <input type="number" id="digital-capacity" value="${location.capacity_gb}" min="1" step="100">
                </div>
                
                <div class="prop-field">
                    <label for="digital-parent">Parent Location:</label>
                    <select id="digital-parent">
                        <option value="">None (Root Level)</option>
                        ${this.digitalLocations.filter(l => l.id !== location.id).map(l => 
                            `<option value="${l.id}" ${location.parent_id === l.id ? 'selected' : ''}>${l.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="prop-field">
                    <label for="digital-physical-link">Linked Physical Object:</label>
                    <input type="text" id="digital-physical-link" value="${location.physical_object_id || ''}" placeholder="e.g., server_rack_01">
                    <small style="color: var(--text-light); font-size: 0.75rem;">Links this digital location to a physical object</small>
                </div>
                
                <div class="inline-inputs" style="margin-top: 1rem;">
                    <div class="inline-input-group">
                        <label for="digital-width">Width</label>
                        <input type="number" id="digital-width" value="${location.width.toFixed(2)}" step="0.1" min="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="digital-height">Height</label>
                        <input type="number" id="digital-height" value="${location.height.toFixed(2)}" step="0.1" min="0.1">
                    </div>
                </div>
                <div class="inline-inputs">
                    <div class="inline-input-group">
                        <label for="digital-x">X (m)</label>
                        <input type="number" id="digital-x" value="${location.x.toFixed(2)}" step="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="digital-y">Y (m)</label>
                        <input type="number" id="digital-y" value="${location.y.toFixed(2)}" step="0.1">
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <button type="button" class="btn-danger" id="delete-digital-location" style="width: 100%;">Delete Location</button>
            </div>
        `;

        this.setupPropertyListeners();
    }

    setupPropertyListeners() {
        const location = this.digitalLocations.find(l => l.id === this.selectedRectId);
        if (!location) return;

        // Name
        const nameInput = document.getElementById('digital-location-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                location.name = e.target.value;
                this.renderLocation(location);
                this.updateSimulationJson();
            });
        }

        // Storage type
        const typeSelect = document.getElementById('digital-storage-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                location.storage_type = e.target.value;
                this.renderLocation(location);
                this.updateSimulationJson();
            });
        }

        // Capacity
        const capacityInput = document.getElementById('digital-capacity');
        if (capacityInput) {
            capacityInput.addEventListener('input', (e) => {
                location.capacity_gb = parseFloat(e.target.value) || 1000;
                this.updateSimulationJson();
            });
        }

        // Parent
        const parentSelect = document.getElementById('digital-parent');
        if (parentSelect) {
            parentSelect.addEventListener('change', (e) => {
                location.parent_id = e.target.value || null;
                this.updateSimulationJson();
            });
        }

        // Physical link
        const linkInput = document.getElementById('digital-physical-link');
        if (linkInput) {
            linkInput.addEventListener('input', (e) => {
                location.physical_object_id = e.target.value || null;
                this.updateSimulationJson();
            });
        }

        // Position and size
        ['x', 'y', 'width', 'height'].forEach(prop => {
            const input = document.getElementById(`digital-${prop}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value) || 0;
                    location[prop] = Math.max(value, prop.includes('width') || prop.includes('height') ? 0.1 : -1000);
                    this.renderLocation(location);
                    this.updateSimulationJson();
                });
            }
        });

        // Delete button
        const deleteBtn = document.getElementById('delete-digital-location');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteLocation(location.id);
            });
        }
    }

    deleteLocation(locationId) {
        const index = this.digitalLocations.findIndex(l => l.id === locationId);
        if (index >= 0) {
            this.digitalLocations.splice(index, 1);
            const rectEl = document.querySelector(`[data-location-id="${locationId}"]`);
            if (rectEl) rectEl.remove();
            this.deselectAll();
            this.updateSimulationJson();
        }
    }

    deselectAll() {
        document.querySelectorAll('.digital-location-rect.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedRectId = null;
        this.renderPropertiesPanel();
    }

    loadFromSimulation() {
        if (!this.monacoEditor) return;

        try {
            const jsonText = this.monacoEditor.getValue();
            if (!jsonText || jsonText.trim() === '') {
                console.warn('DIGITAL-SPACE: No simulation data available');
                return;
            }
            const simulation = JSON.parse(jsonText);
            
            // Load digital locations
            if (simulation.digital_space && simulation.digital_space.digital_locations) {
                this.digitalLocations = [...simulation.digital_space.digital_locations];
                this.renderAllLocations();
                
                // Reset view and zoom to fit on initial load (like Space Editor)
                if (this.digitalLocations.length > 0 && !this.hasInitiallyLoaded) {
                    this.view.scale = 1;
                    this.view.x = 0;
                    this.view.y = 0;
                    this.updateViewTransform();
                    this.zoomToFit();
                    this.hasInitiallyLoaded = true;
                }
            }
            
            // Load digital objects
            if (simulation.digital_space && simulation.digital_space.digital_objects) {
                this.digitalObjects = [...simulation.digital_space.digital_objects];
            }
        } catch (e) {
            console.log("DIGITAL-SPACE: Could not parse JSON for digital space");
        }
    }

    renderAllLocations() {
        // Clear existing
        this.world.innerHTML = '';
        
        // Render all locations
        this.digitalLocations.forEach(location => {
            this.renderLocation(location);
        });
    }

    updateSimulationJson() {
        if (this.isUpdatingJson || !this.monacoEditor) return;
        
        // Debounce to prevent excessive updates and infinite loops
        if (this.updateSimulationJsonTimeout) {
            clearTimeout(this.updateSimulationJsonTimeout);
        }
        
        this.updateSimulationJsonTimeout = setTimeout(() => {
            try {
                const jsonText = this.monacoEditor.getValue();
                const simulation = JSON.parse(jsonText);
                
                // Ensure digital_space structure exists
                if (!simulation.digital_space) {
                    simulation.digital_space = {};
                }
                
                // Update digital locations
                simulation.digital_space.digital_locations = this.digitalLocations;
                simulation.digital_space.digital_objects = this.digitalObjects;
                
                this.isUpdatingJson = true;
                this.monacoEditor.setValue(JSON.stringify(simulation, null, 2));
                this.isUpdatingJson = false;
            } catch (e) {
                console.error("DIGITAL-SPACE: Error updating simulation JSON:", e);
            }
        }, 100); // 100ms debounce
    }

    // Zoom and view methods (adapted from space editor)
    zoomIn() {
        const zoomFactor = 1.2; // 20% zoom in
        const canvasRect = this.canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        const oldScale = this.view.scale;
        this.view.scale = Math.min(5, this.view.scale * zoomFactor); // Cap max zoom at 5x
        
        // Zoom towards the center
        this.view.x = centerX - (centerX - this.view.x) * (this.view.scale / oldScale);
        this.view.y = centerY - (centerY - this.view.y) * (this.view.scale / oldScale);
        
        // Disable transitions during zoom to prevent blinking
        document.body.classList.add('disable-animations');
        this.updateViewTransform();
        // Re-enable transitions after a brief delay
        setTimeout(() => {
            document.body.classList.remove('disable-animations');
        }, 10);
    }

    zoomOut() {
        const zoomFactor = 0.833; // ~20% zoom out (1/1.2)
        const canvasRect = this.canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        const oldScale = this.view.scale;
        this.view.scale = Math.max(0.1, this.view.scale * zoomFactor); // Cap min zoom at 0.1x
        
        // Zoom towards the center
        this.view.x = centerX - (centerX - this.view.x) * (this.view.scale / oldScale);
        this.view.y = centerY - (centerY - this.view.y) * (this.view.scale / oldScale);
        
        // Disable transitions during zoom to prevent blinking
        document.body.classList.add('disable-animations');
        this.updateViewTransform();
        // Re-enable transitions after a brief delay
        setTimeout(() => {
            document.body.classList.remove('disable-animations');
        }, 10);
    }

    zoomToFit() {
        if (this.digitalLocations.length === 0) {
            this.view.scale = 1;
            this.view.x = 0;
            this.view.y = 0;
            // Disable transitions during zoom to prevent blinking
            document.body.classList.add('disable-animations');
            this.updateViewTransform();
            setTimeout(() => {
                document.body.classList.remove('disable-animations');
            }, 10);
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.digitalLocations.forEach(location => {
            minX = Math.min(minX, location.x * this.pixelsPerMeter);
            minY = Math.min(minY, location.y * this.pixelsPerMeter);
            maxX = Math.max(maxX, (location.x + location.width) * this.pixelsPerMeter);
            maxY = Math.max(maxY, (location.y + location.height) * this.pixelsPerMeter);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const canvasRect = this.canvas.getBoundingClientRect();
        const padding = 50;

        const scaleX = (canvasRect.width - padding * 2) / contentWidth;
        const scaleY = (canvasRect.height - padding * 2) / contentHeight;
        this.view.scale = Math.min(scaleX, scaleY, 2);

        this.view.x = (canvasRect.width - contentWidth * this.view.scale) / 2 - minX * this.view.scale;
        this.view.y = (canvasRect.height - contentHeight * this.view.scale) / 2 - minY * this.view.scale;

        // Disable transitions during zoom to prevent blinking
        document.body.classList.add('disable-animations');
        this.updateViewTransform();
        setTimeout(() => {
            document.body.classList.remove('disable-animations');
        }, 10);
    }

    updateViewTransform() {
        if (this.world) {
            this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
            // Update CSS custom property for dynamic font scaling
            this.world.style.setProperty('--current-zoom-scale', this.view.scale);
            // Update font-specific zoom scale with slower increase curve (40% reduction)
            const fontZoomScale = Math.pow(this.view.scale, 0.6);
            this.world.style.setProperty('--current-font-zoom-scale', fontZoomScale);
        }
    }

    onCanvasWheel(e) {
        e.preventDefault();
        
        // Detect scroll magnitude - different devices send different deltaY values
        const rawDelta = Math.abs(e.deltaY);
        const isTrackpad = rawDelta < 50; // Trackpads typically send smaller values
        const isMouse = rawDelta >= 100;   // Mice typically send larger values
        
        // Normalize delta magnitude to a reasonable range
        let normalizedDelta = Math.min(rawDelta / 100, 3); // Cap at 3x for very sensitive mice
        if (isTrackpad) {
            normalizedDelta = Math.min(rawDelta / 10, 1); // More gentle for trackpads
        }
        
        const direction = e.deltaY > 0 ? -1 : 1;
        const oldScale = this.view.scale;
        
        // Adaptive zoom speed based on current zoom level
        // At 1x zoom: base speed, at higher zooms: slower, at lower zooms: faster
        const baseSpeed = 0.014; // Reduced by 30% from space editor's 0.02 for gentler zoom
        const adaptiveSpeed = baseSpeed * Math.pow(this.view.scale, 0.3); // Gentle scaling curve
        
        // Calculate zoom step with maximum limits
        let zoomStep = direction * adaptiveSpeed * normalizedDelta;
        
        // Maximum zoom step limits to prevent dramatic jumps
        const maxStep = this.view.scale * 0.15; // Never change more than 15% of current scale
        zoomStep = Math.max(-maxStep, Math.min(maxStep, zoomStep));
        
        // Apply exponential zoom curve for smoother feel
        if (direction > 0) {
            // Zooming in: multiplicative
            this.view.scale = Math.min(5, this.view.scale * (1 + Math.abs(zoomStep)));
        } else {
            // Zooming out: multiplicative
            this.view.scale = Math.max(0.1, this.view.scale / (1 + Math.abs(zoomStep)));
        }
        
        // Zoom towards the cursor
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.view.x = mouseX - (mouseX - this.view.x) * (this.view.scale / oldScale);
        this.view.y = mouseY - (mouseY - this.view.y) * (this.view.scale / oldScale);
        
        // Disable transitions during mouse wheel zoom to prevent blinking
        document.body.classList.add('disable-animations');
        this.updateViewTransform();
        // Use a very short timeout to re-enable transitions quickly
        setTimeout(() => {
            document.body.classList.remove('disable-animations');
        }, 5);
    }

    onKeyDown(e) {
        // Don't intercept keys if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        // Handle space key for panning or zoom-to-fit
        if (e.code === 'Space' && !this.spaceKeyState.isDown) {
            e.preventDefault();
            this.spaceKeyState.isDown = true;
            this.spaceKeyState.downTime = Date.now();
            this.spaceKeyState.panActivated = false;
            
            // Start panning after a short delay to allow for quick taps
            setTimeout(() => {
                if (this.spaceKeyState.isDown && !this.view.isPanning) {
                    this.view.isPanning = true;
                    this.spaceKeyState.panActivated = true;
                    this.canvas.style.cursor = 'grab';
                    document.body.classList.add('digital-space-panning');
                    document.body.classList.add('disable-animations');
                }
            }, 150); // 150ms delay to detect quick taps
            return;
        }
        
        if (e.key === 'Delete' && this.selectedRectId) {
            this.deleteLocation(this.selectedRectId);
        }
    }

    onKeyUp(e) {
        // Don't intercept space key if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        if (e.code === 'Space' && this.spaceKeyState.isDown) {
            const holdDuration = Date.now() - this.spaceKeyState.downTime;
            
            // If it was a quick tap (< 150ms) and panning wasn't activated, trigger zoom-to-fit
            if (holdDuration < 150 && !this.spaceKeyState.panActivated) {
                this.zoomToFit();
            }
            
            // Clean up panning state regardless
            this.view.isPanning = false;
            this.spaceKeyState.isDown = false;
            this.spaceKeyState.panActivated = false;
            document.body.classList.remove('digital-space-panning');
            this.canvas.style.cursor = this.isDrawing ? 'crosshair' : 'default';
            document.body.classList.remove('disable-animations');
        }
    }

    prepareForDrag(e, rectEl) {
        this.isPreparingToDrag = true;
        this.activeRectEl = rectEl;
        this.initialMousePosition = { x: e.clientX, y: e.clientY };

        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.view.x) / this.view.scale;
        const mouseY = (e.clientY - rect.top - this.view.y) / this.view.scale;
        const rectX = parseFloat(rectEl.style.left) || 0;
        const rectY = parseFloat(rectEl.style.top) || 0;

        this.dragOffset = {
            x: mouseX - rectX,
            y: mouseY - rectY
        };
    }

    startDragging(rectEl) {
        this.isDragging = true;
        this.isPreparingToDrag = false;

        // Disable ALL CSS animations/transitions during dragging for performance
        rectEl.style.transition = 'none';
        rectEl.style.transform = 'none';
        rectEl.style.boxShadow = 'none';
        rectEl.classList.add('dragging');

        this.canvas.style.cursor = 'move';
    }

    finishDragging() {
        if (!this.isDragging || !this.selectedRectId) return;
        
        // Re-enable CSS styling after dragging
        if (this.activeRectEl) {
            this.activeRectEl.style.transition = '';
            this.activeRectEl.style.transform = '';
            this.activeRectEl.style.boxShadow = '';
            this.activeRectEl.classList.remove('dragging');
        }
        
        const location = this.digitalLocations.find(l => l.id === this.selectedRectId);
        if (location) {
            location.x = this.currentDragPosition.x / this.pixelsPerMeter;
            location.y = this.currentDragPosition.y / this.pixelsPerMeter;
            this.updateSimulationJson();
            this.renderPropertiesPanel();
        }
        
        this.isDragging = false;
        this.isPreparingToDrag = false;
        this.activeRectEl = null;
        this.canvas.style.cursor = 'default';
    }

    createNewDigitalObject() {
        // Prompt user for object name
        const objectName = prompt('Enter a name for the digital object:', 'New Digital Object');
        
        // If user cancels or enters empty name, don't create object
        if (!objectName || objectName.trim() === '') {
            return;
        }

        const objectId = 'digital_obj_' + Date.now();
        const newObject = {
            id: objectId,
            name: objectName.trim(),
            type: 'file',
            location_id: this.digitalLocations.length > 0 ? this.digitalLocations[0].id : null,
            size_mb: 1,
            created_time: new Date().toISOString(),
            modified_time: new Date().toISOString(),
            properties: {
                file_type: 'document',
                permissions: 'read_write',
                encrypted: false
            }
        };

        this.digitalObjects.push(newObject);
        this.renderPropertiesPanel();
        this.updateSimulationJson();
    }

    renameDigitalObject(objectId) {
        const object = this.digitalObjects.find(obj => obj.id === objectId);
        if (!object) return;

        const newName = prompt('Enter a new name for the digital object:', object.name);
        
        // If user cancels or enters empty name, don't rename
        if (!newName || newName.trim() === '') {
            return;
        }

        object.name = newName.trim();
        object.modified_time = new Date().toISOString();
        this.renderPropertiesPanel();
        this.updateSimulationJson();
    }

    deleteDigitalObject(objectId) {
        const index = this.digitalObjects.findIndex(obj => obj.id === objectId);
        if (index >= 0) {
            this.digitalObjects.splice(index, 1);
            this.renderPropertiesPanel();
            this.updateSimulationJson();
        }
    }

    getObjectIcon(objectType) {
        const icons = {
            'file': '📄',
            'folder': '📁',
            'database': '🗃️',
            'application': '💻',
            'service': '⚙️',
            'process': '🔄',
            'log': '📋',
            'backup': '💾',
            'image': '🖼️',
            'video': '🎥',
            'audio': '🎵',
            'archive': '📦'
        };
        return icons[objectType] || '📄';
    }

    getLocationName(locationId) {
        if (!locationId) return 'No Location';
        const location = this.digitalLocations.find(l => l.id === locationId);
        return location ? location.name : 'Unknown Location';
    }

    applyLayerFilter() {
        // Layer filtering logic if needed
        console.log("DIGITAL-SPACE: Layer filter applied:", this.activeLayer);
    }

    refreshFromSimulation() {
        // Called by simulation player when digital objects might have moved
        // Refresh the digital objects list and re-render properties if needed
        this.loadFromSimulation();
        
        // If properties panel is showing the digital objects list, refresh it
        if (!this.selectedRectId) {
            this.renderPropertiesPanel();
        }
    }

    cleanup() {
        // Remove event listeners and clean up resources
        if (this.world) {
            this.world.remove();
            this.world = null;
        }
    }
}

// Export for global use
window.DigitalSpaceEditor = DigitalSpaceEditor;