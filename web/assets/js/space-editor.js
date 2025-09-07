class SpaceEditor {
    constructor(canvasEl, propsPanelEl, editor) {
        console.log("SPACE-EDITOR: Constructor called.");
        this.canvas = canvasEl;
        this.propsPanel = propsPanelEl;
        this.monacoEditor = editor;
        
        this.pixelsPerMeter = 20;
        this.isDrawing = false;
        this.isDragging = false;
        this.activeRectEl = null;
        this.selectedRectId = null;
        this.startCoords = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.currentDragPosition = { x: 0, y: 0 };
        this.locations = [];

        this.isUpdatingJson = false;
        this.hasInitiallyLoaded = false;
        this.world = document.createElement('div');
        this.world.className = 'space-world';
        this.canvas.appendChild(this.world);
        
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
            scrollSensitivity: 1
        };

        this.init();
        console.log("SPACE-EDITOR: Constructor finished.");
    }

    init() {
        document.getElementById('add-location-btn').addEventListener('click', () => {
            this.isDrawing = true;
            this.canvas.style.cursor = 'crosshair';
            this.deselectAll();
        });
        
        // Replace canvas listeners with these new ones
        this.canvas.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
        this.canvas.addEventListener('wheel', this.onCanvasWheel.bind(this), { passive: false });
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        // Zoom button controls
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomFitBtn = document.getElementById('zoom-fit-btn');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (zoomFitBtn) {
            zoomFitBtn.addEventListener('click', () => this.zoomToFit());
        }
        
        // Layer filtering
        const layerFilter = document.getElementById('layer-filter');
        if (layerFilter) {
            layerFilter.addEventListener('change', (e) => {
                this.activeLayer = e.target.value;
                this.applyLayerFilter();
            });
        }
        
        // Snapping options - initialize from current checkbox states
        const snapXCheckbox = document.getElementById('snap-x-enabled');
        const snapZCheckbox = document.getElementById('snap-z-enabled');
        const snapToleranceInput = document.getElementById('snap-tolerance');
        
        if (snapXCheckbox) {
            // Initialize from current checkbox state
            this.snapSettings.xEnabled = snapXCheckbox.checked;
            snapXCheckbox.addEventListener('change', (e) => {
                this.snapSettings.xEnabled = e.target.checked;
            });
        }
        
        if (snapZCheckbox) {
            // Initialize from current checkbox state
            this.snapSettings.zEnabled = snapZCheckbox.checked;
            snapZCheckbox.addEventListener('change', (e) => {
                this.snapSettings.zEnabled = e.target.checked;
            });
        }
        
        if (snapToleranceInput) {
            // Initialize from current input value
            this.snapSettings.tolerance = parseInt(snapToleranceInput.value) || 10;
            snapToleranceInput.addEventListener('change', (e) => {
                this.snapSettings.tolerance = parseInt(e.target.value);
            });
        }

        const scrollSensitivitySlider = document.getElementById('space-scroll-sensitivity');
        if (scrollSensitivitySlider) {
            this.view.scrollSensitivity = parseFloat(scrollSensitivitySlider.value);
            scrollSensitivitySlider.addEventListener('input', (e) => {
                this.view.scrollSensitivity = parseFloat(e.target.value);
            });
        }
    }

    updateViewTransform() {
        this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    }

    nudgeSelectedRectangle(keyCode) {
        if (!this.selectedRectId) return;
        
        const loc = this.locations.find(l => l.id === this.selectedRectId);
        const rectEl = document.querySelector(`.location-rect[data-id="${this.selectedRectId}"]`);
        
        if (!loc || !rectEl) return;
        
        // Calculate nudge distance - smaller increments for precision
        // Use 1 pixel at 1x zoom, but scale with zoom level for consistency
        const nudgeDistance = Math.max(1, Math.round(5 / this.view.scale));
        
        let deltaX = 0;
        let deltaY = 0;
        
        switch(keyCode) {
            case 'ArrowUp':
                deltaY = -nudgeDistance;
                break;
            case 'ArrowDown':
                deltaY = nudgeDistance;
                break;
            case 'ArrowLeft':
                deltaX = -nudgeDistance;
                break;
            case 'ArrowRight':
                deltaX = nudgeDistance;
                break;
        }
        
        // Update location data
        loc.shape.x += deltaX;
        loc.shape.y += deltaY;
        
        // Update visual element
        rectEl.style.left = `${loc.shape.x}px`;
        rectEl.style.top = `${loc.shape.y}px`;
        
        // Update hierarchical display and JSON
        this.updateHierarchicalDisplay();
        this.updateJson();
    }

    ensureContentVisible() {
        // Public method to ensure content is visible - useful for tutorials
        if (this.locations.length > 0) {
            this.view.scale = 1;
            this.view.x = 0;
            this.view.y = 0;
            this.updateViewTransform();
            this.zoomToFit();
        }
    }

    resetViewForNewContent() {
        // Reset the initially loaded flag so next loadLayout will zoom to fit
        this.hasInitiallyLoaded = false;
    }

    zoomToFit() {
        if (this.locations.length === 0) return;

        const padding = 50; // 50px padding around the content
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.locations.forEach(loc => {
            minX = Math.min(minX, loc.shape.x);
            minY = Math.min(minY, loc.shape.y);
            maxX = Math.max(maxX, loc.shape.x + loc.shape.width);
            maxY = Math.max(maxY, loc.shape.y + loc.shape.height);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const canvasWidth = this.canvas.clientWidth;
        const canvasHeight = this.canvas.clientHeight;

        const scaleX = canvasWidth / (contentWidth + padding * 2);
        const scaleY = canvasHeight / (contentHeight + padding * 2);
        this.view.scale = Math.min(scaleX, scaleY, 1); // Cap max zoom at 1x

        this.view.x = (canvasWidth / 2) - (contentWidth / 2 + minX) * this.view.scale;
        this.view.y = (canvasHeight / 2) - (contentHeight / 2 + minY) * this.view.scale;

        this.updateViewTransform();
    }

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
        
        this.updateViewTransform();
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
        
        this.updateViewTransform();
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
        const baseSpeed = 0.02; // Much slower base speed
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
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.view.x = mouseX - (mouseX - this.view.x) * (this.view.scale / oldScale);
        this.view.y = mouseY - (mouseY - this.view.y) * (this.view.scale / oldScale);
        
        this.updateViewTransform();
    }

    onKeyDown(e) {
        // Don't intercept keys if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        // Handle space key for panning
        if (e.code === 'Space' && !this.view.isPanning) {
            e.preventDefault();
            this.view.isPanning = true;
            this.canvas.style.cursor = 'grab';
            return;
        }
        
        // Handle arrow keys for nudging selected rectangles
        if (this.selectedRectId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
            this.nudgeSelectedRectangle(e.code);
            return;
        }
    }
    
    onKeyUp(e) {
        // Don't intercept space key if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        if (e.code === 'Space') {
            this.view.isPanning = false;
            // Set cursor based on current mode
            this.canvas.style.cursor = this.isDrawing ? 'crosshair' : 'default';
        }
    }

    loadLayout(layoutData, forceZoomToFit = false) {
        console.log("SPACE-EDITOR: loadLayout() called.", layoutData, "forceZoomToFit:", forceZoomToFit);

        const wasDrawing = this.isDrawing;

        if (!layoutData || !layoutData.locations) {
            console.warn("SPACE-EDITOR: loadLayout called with invalid or empty layoutData. Canvas will be blank.");
            this.locations = [];
            this.canvas.innerHTML = ''; // Clear canvas if no layout
            this.world = document.createElement('div'); // Recreate world
            this.world.className = 'space-world';
            this.canvas.appendChild(this.world);
            this.updateViewTransform(); // Reset view
            this.renderPropertiesPanel();
            return;
        }

        this.locations = layoutData.locations || [];
        this.pixelsPerMeter = layoutData.meta?.pixels_per_unit || 20;
        
        // Ensure all locations have depth property for 3D support
        this.locations.forEach(loc => {
            if (!loc.shape.depth) {
                loc.shape.depth = 50; // Default depth
            }
            if (!loc.layer) {
                loc.layer = "ground"; // Default layer (string)
            }
            // Initialize transition layers for transition zones
            if (loc.isTransition && !loc.transitionLayers) {
                loc.transitionLayers = [loc.layer || "ground"];
            }
        });
        
        console.log(`SPACE-EDITOR: Loading ${this.locations.length} locations with scale ${this.pixelsPerMeter} px/m.`);

        this.world.innerHTML = ''; // Clear only the world container
        this.locations.forEach(loc => this.createRectElement(loc));
        this.updateLayerDropdown();
        this.applyLayerFilter();
        this.updateHierarchicalDisplay();
        this.renderPropertiesPanel();
       
        if (this.locations.length > 0) {
            // Reset view and zoom to fit on initial load or when explicitly requested
            if (!this.hasInitiallyLoaded || forceZoomToFit) {
                this.view.scale = 1;
                this.view.x = 0;
                this.view.y = 0;
                this.updateViewTransform();
                this.zoomToFit();
                this.hasInitiallyLoaded = true;
            } else {
                // Just update the transform without resetting position/scale
                this.updateViewTransform();
            }
        } else {
            // Ensure transform is applied even with no locations
            this.updateViewTransform();
        }

        //Restore drawing state
        this.isDrawing = wasDrawing;
        if (this.isDrawing) {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    createRectElement(loc) {
        const rectEl = document.createElement('div');
        rectEl.className = 'location-rect';
        rectEl.dataset.id = loc.id;
        rectEl.textContent = loc.name || loc.id;
        rectEl.addEventListener('mousedown', (e) => this.onRectMouseDown(e, loc.id));
        
        // Apply 3D transformation
        this.apply3DTransform(rectEl, loc);
        
        // Adjust text size to fit within rectangle
        this.adjustTextSize(rectEl);
        
        this.world.appendChild(rectEl);
        return rectEl;
    }

    updateLayerDropdown() {
        const layerFilter = document.getElementById('layer-filter');
        if (!layerFilter) return;

        // Collect all unique layers
        this.availableLayers.clear();
        this.locations.forEach(loc => {
            if (loc.isTransition && loc.transitionLayers) {
                // Add all layers from transition zones
                loc.transitionLayers.forEach(layer => this.availableLayers.add(layer));
            } else {
                // Add single layer from regular locations
                this.availableLayers.add(loc.layer || 0);
            }
        });

        // Preserve current selection
        const currentValue = layerFilter.value;
        
        // Rebuild dropdown
        layerFilter.innerHTML = '<option value="all">All Layers</option>';
        
        const sortedLayers = Array.from(this.availableLayers).sort();
        sortedLayers.forEach(layer => {
            const option = document.createElement('option');
            option.value = layer;
            option.textContent = layer;
            layerFilter.appendChild(option);
        });

        // Restore selection if it still exists
        if (Array.from(layerFilter.options).some(opt => opt.value === currentValue)) {
            layerFilter.value = currentValue;
        } else {
            layerFilter.value = 'all';
            this.activeLayer = 'all';
        }
    }

    applyLayerFilter() {
        this.locations.forEach(loc => {
            const rectEl = document.querySelector(`.location-rect[data-id="${loc.id}"]`);
            if (!rectEl) return;

            let shouldShow = false;
            
            if (this.activeLayer === 'all') {
                shouldShow = true;
            } else {
                if (loc.isTransition && loc.transitionLayers) {
                    // For transition zones, show if the active layer is in the transition layers
                    shouldShow = loc.transitionLayers.includes(this.activeLayer);
                } else {
                    // For regular locations, use the single layer
                    const locationLayer = loc.layer || "ground";
                    shouldShow = locationLayer === this.activeLayer;
                }
            }
            
            rectEl.style.display = shouldShow ? 'flex' : 'none';
        });
    }

    populateParentDropdown(currentLocationId) {
        const parentSelect = document.getElementById('prop-parent');
        if (!parentSelect) return;

        const currentLocation = this.locations.find(l => l.id === currentLocationId);
        
        // Clear existing options except the first one
        parentSelect.innerHTML = '<option value="">None (Root)</option>';
        
        // Add all other locations as potential parents, excluding self and descendants
        this.locations.forEach(loc => {
            if (loc.id === currentLocationId) return; // Can't be parent of self
            if (this.isDescendantOf(currentLocationId, loc.id)) return; // Prevent circular references
            
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.name || loc.id;
            if (currentLocation && currentLocation.parentId === loc.id) {
                option.selected = true;
            }
            parentSelect.appendChild(option);
        });
    }

    isDescendantOf(ancestorId, potentialDescendantId) {
        let currentId = potentialDescendantId;
        const visited = new Set();

        while (currentId) {
            if (visited.has(currentId)) {
                console.error("Circular dependency detected in hierarchy involving ID:", currentId);
                return true; // Prevent selection to avoid deepening the cycle
            }
            visited.add(currentId);

            const location = this.locations.find(l => l.id === currentId);
            if (!location || !location.parentId) break;
            
            if (location.parentId === ancestorId) return true;
            currentId = location.parentId;
        }
        return false;
    }

    updateHierarchicalDisplay() {
        // Add visual indicators for hierarchy - connecting lines or indentation
        this.locations.forEach(loc => {
            const rectEl = document.querySelector(`.location-rect[data-id="${loc.id}"]`);
            if (!rectEl) return;
            
            // Remove existing hierarchy classes
            rectEl.classList.remove('has-parent', 'has-children');
            
            // Add hierarchy indicators
            if (loc.parentId) {
                rectEl.classList.add('has-parent');
            }
            
            const hasChildren = this.locations.some(l => l.parentId === loc.id);
            if (hasChildren) {
                rectEl.classList.add('has-children');
            }
            
            // Update z-index for hierarchy (children appear above parents)
            const hierarchyDepth = this.getHierarchyDepth(loc.id);
            const layerZIndex = this.getLayerZIndex(loc.layer || "ground");
            const baseZIndex = Math.floor((loc.shape.y + loc.shape.x) / 10) + layerZIndex * 1000;
            rectEl.style.zIndex = baseZIndex + hierarchyDepth * 10;
        });
    }

    getHierarchyDepth(locationId) {
        let depth = 0;
        let currentId = locationId;
        
        while (currentId) {
            const location = this.locations.find(l => l.id === currentId);
            if (!location || !location.parentId) break;
            
            depth++;
            currentId = location.parentId;
            
            // Prevent infinite loops
            if (depth > 10) break;
        }
        
        return depth;
    }

    getLayerZIndex(layerName) {
        // Convert string layer names to numeric z-index values for proper stacking
        // Create a sorted array of all unique layer names and use index as z-value
        const sortedLayers = Array.from(this.availableLayers).sort();
        const index = sortedLayers.indexOf(layerName);
        return index >= 0 ? index : 0;
    }

    applySnapping(proposedX, proposedY) {
        if (!this.activeRectEl || (!this.snapSettings.xEnabled && !this.snapSettings.zEnabled)) {
            return { x: proposedX, y: proposedY };
        }

        let snappedX = proposedX;
        let snappedY = proposedY;
        
        const activeWidth = parseInt(this.activeRectEl.style.width) || 0;
        const activeHeight = parseInt(this.activeRectEl.style.height) || 0;
        
        // Get snap targets from other rectangles
        const snapTargets = [];
        document.querySelectorAll('.location-rect').forEach(rect => {
            if (rect === this.activeRectEl) return;
            
            const targetX = parseInt(rect.style.left) || 0;
            const targetY = parseInt(rect.style.top) || 0;
            const targetWidth = parseInt(rect.style.width) || 0;
            const targetHeight = parseInt(rect.style.height) || 0;
            
            snapTargets.push({
                left: targetX,
                right: targetX + targetWidth,
                top: targetY,
                bottom: targetY + targetHeight
            });
        });

        // X-axis snapping (length alignment)
        if (this.snapSettings.xEnabled) {
            for (const target of snapTargets) {
                // Snap left edge to left edge
                if (Math.abs(proposedX - target.left) < this.snapSettings.tolerance) {
                    snappedX = target.left;
                    break;
                }
                // Snap left edge to right edge
                if (Math.abs(proposedX - target.right) < this.snapSettings.tolerance) {
                    snappedX = target.right;
                    break;
                }
                // Snap right edge to left edge
                if (Math.abs((proposedX + activeWidth) - target.left) < this.snapSettings.tolerance) {
                    snappedX = target.left - activeWidth;
                    break;
                }
                // Snap right edge to right edge
                if (Math.abs((proposedX + activeWidth) - target.right) < this.snapSettings.tolerance) {
                    snappedX = target.right - activeWidth;
                    break;
                }
            }
        }

        // Z-axis snapping (width alignment) - using Y coordinates for the 2D representation
        if (this.snapSettings.zEnabled) {
            for (const target of snapTargets) {
                // Snap top edge to top edge
                if (Math.abs(proposedY - target.top) < this.snapSettings.tolerance) {
                    snappedY = target.top;
                    break;
                }
                // Snap top edge to bottom edge
                if (Math.abs(proposedY - target.bottom) < this.snapSettings.tolerance) {
                    snappedY = target.bottom;
                    break;
                }
                // Snap bottom edge to top edge
                if (Math.abs((proposedY + activeHeight) - target.top) < this.snapSettings.tolerance) {
                    snappedY = target.top - activeHeight;
                    break;
                }
                // Snap bottom edge to bottom edge
                if (Math.abs((proposedY + activeHeight) - target.bottom) < this.snapSettings.tolerance) {
                    snappedY = target.bottom - activeHeight;
                    break;
                }
            }
        }

        return { x: snappedX, y: snappedY };
    }

    populateConnectedLocations(loc) {
        const connectedDiv = document.getElementById('connected-locations-list');
        const addBtn = document.getElementById('add-connection-btn');
        
        if (!connectedDiv || !addBtn) return;
        
        // Clear existing connections
        connectedDiv.innerHTML = '';
        
        // Display current connections
        if (loc.connectedLocations) {
            loc.connectedLocations.forEach((connectionId, index) => {
                const connectedLoc = this.locations.find(l => l.id === connectionId);
                const connectionDiv = document.createElement('div');
                connectionDiv.className = 'connection-item';
                connectionDiv.innerHTML = `
                    <span>${connectedLoc ? connectedLoc.name : connectionId}</span>
                    <button type="button" class="remove-connection" data-index="${index}">×</button>
                `;
                connectedDiv.appendChild(connectionDiv);
            });
        }
        
        // Add connection button handler
        addBtn.onclick = () => {
            this.showConnectionSelector(loc);
        };
        
        // Remove connection handlers
        connectedDiv.querySelectorAll('.remove-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                loc.connectedLocations.splice(index, 1);
                this.populateConnectedLocations(loc);
                this.updateJson();
            });
        });
    }

    showConnectionSelector(loc) {
        const availableLocations = this.locations.filter(l => 
            l.id !== loc.id && 
            !(loc.connectedLocations || []).includes(l.id)
        );
        
        if (availableLocations.length === 0) {
            alert('No available locations to connect to.');
            return;
        }
        
        const locationName = prompt(
            'Enter the name/ID of the location to connect:\n' + 
            availableLocations.map(l => `• ${l.name || l.id}`).join('\n')
        );
        
        if (locationName) {
            const targetLoc = availableLocations.find(l => 
                (l.name && l.name.toLowerCase() === locationName.toLowerCase()) ||
                l.id.toLowerCase() === locationName.toLowerCase()
            );
            
            if (targetLoc) {
                if (!loc.connectedLocations) loc.connectedLocations = [];
                loc.connectedLocations.push(targetLoc.id);
                this.populateConnectedLocations(loc);
                this.updateJson();
            } else {
                alert('Location not found.');
            }
        }
    }

    populateTransitionLayersDropdown(loc) {
        const transitionLayersSelect = document.getElementById('prop-transition-layers');
        if (!transitionLayersSelect) return;
        
        // Clear existing options
        transitionLayersSelect.innerHTML = '';
        
        // Get all available layers from the layer dropdown
        const sortedLayers = Array.from(this.availableLayers).sort();
        
        // Add all layer options
        sortedLayers.forEach(layer => {
            const option = document.createElement('option');
            option.value = layer;
            option.textContent = layer;
            
            // Select if it's in the location's transition layers
            if (loc.transitionLayers && loc.transitionLayers.includes(layer)) {
                option.selected = true;
            }
            
            transitionLayersSelect.appendChild(option);
        });
        
        // Remove any existing event listeners by cloning the element
        const newTransitionLayersSelect = transitionLayersSelect.cloneNode(true);
        transitionLayersSelect.parentNode.replaceChild(newTransitionLayersSelect, transitionLayersSelect);
        
        // Add event listener for changes
        newTransitionLayersSelect.addEventListener('change', (e) => {
            const selectedOptions = Array.from(e.target.selectedOptions);
            loc.transitionLayers = selectedOptions.map(option => option.value);
            
            // Update the visual representation
            this.updateRectElement(loc);
            this.updateJson();
        });
    }
    
    updateJson() {
        try {
            this.isUpdatingJson = true;
            const fullSim = JSON.parse(this.monacoEditor.getValue());
            if (!fullSim.simulation) fullSim.simulation = {};
            fullSim.simulation.layout = {
                meta: { units: 'meters', pixels_per_unit: this.pixelsPerMeter },
                locations: this.locations
            };
            this.monacoEditor.setValue(JSON.stringify(fullSim, null, 2));
            setTimeout(() => { this.isUpdatingJson = false; }, 5);
        } catch(e) { 
            this.isUpdatingJson = false;
            console.error("Failed to update JSON from Space Editor:", e);
        }
    }

    onCanvasMouseDown(e) {
        if (this.view.isPanning) {
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Only allow drawing/panning on the canvas itself or the world container
        if (e.target !== this.canvas && !e.target.classList.contains('space-world')) return;

        if (this.isDrawing) {
            // Convert screen coordinates to world coordinates
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Transform to world coordinates accounting for zoom and pan
            const worldX = (screenX - this.view.x) / this.view.scale;
            const worldY = (screenY - this.view.y) / this.view.scale;

            this.startCoords = { x: worldX, y: worldY };

            this.activeRectEl = document.createElement('div');
            this.activeRectEl.className = 'location-rect selected';
            this.activeRectEl.style.left = `${worldX}px`;
            this.activeRectEl.style.top = `${worldY}px`;
            this.activeRectEl.style.width = '0px';
            this.activeRectEl.style.height = '0px';

            this.world.appendChild(this.activeRectEl);
        } else {
            // Start background panning when not in drawing mode
            this.view.isPanning = true;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            this.deselectAll();
        }
    }
    
    onRectMouseDown(e, id) {
        e.stopPropagation();
        
        // Immediately clear any previous states
        this.isDrawing = false;
        this.canvas.classList.remove('is-dragging');
        
        // Clear any lingering collision states
        document.querySelectorAll('.location-rect.colliding').forEach(el => {
            el.classList.remove('colliding');
        });
        
        // Set up new drag state
        this.isDragging = true;
        this.canvas.classList.add('is-dragging');
        this.activeRectEl = e.target;
        this.selectedRectId = id;
        
        // Calculate drag offset in world coordinates for proper alignment
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldMouseX = (screenX - this.view.x) / this.view.scale;
        const worldMouseY = (screenY - this.view.y) / this.view.scale;
        const rectWorldX = parseInt(this.activeRectEl.style.left) || 0;
        const rectWorldY = parseInt(this.activeRectEl.style.top) || 0;
        
        this.dragOffset = {
            x: worldMouseX - rectWorldX,
            y: worldMouseY - rectWorldY
        };

        // Initialize currentDragPosition to the starting position of the drag
        this.currentDragPosition = { x: rectWorldX, y: rectWorldY };
        
        this.selectRect(id);
    }

    onMouseMove(e) {
        // Handle Panning
        if (this.view.isPanning) {
            const dx = e.clientX - this.view.lastPan.x;
            const dy = e.clientY - this.view.lastPan.y;
            this.view.x += dx;
            this.view.y += dy;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.updateViewTransform();
            return;
        }

        // Handle Drawing a new rectangle
        if (this.isDrawing && this.activeRectEl) {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Transform to world coordinates
            const worldX = (screenX - this.view.x) / this.view.scale;
            const worldY = (screenY - this.view.y) / this.view.scale;

            const width = Math.abs(worldX - this.startCoords.x);
            const height = Math.abs(worldY - this.startCoords.y);
            const left = Math.min(worldX, this.startCoords.x);
            const top = Math.min(worldY, this.startCoords.y);

            this.activeRectEl.style.width = `${width}px`;
            this.activeRectEl.style.height = `${height}px`;
            this.activeRectEl.style.left = `${left}px`;
            this.activeRectEl.style.top = `${top}px`;
        }
        // Handle Dragging an existing rectangle
        else if (this.isDragging && this.activeRectEl) {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            let worldX = (screenX - this.view.x) / this.view.scale;
            let worldY = (screenY - this.view.y) / this.view.scale;

            const proposedX = worldX - this.dragOffset.x;
            const proposedY = worldY - this.dragOffset.y;

            // Apply snapping
            const snappedPosition = this.applySnapping(proposedX, proposedY);

            // Store the current drag position for proper mouse up handling
            this.currentDragPosition = { x: snappedPosition.x, y: snappedPosition.y };

            this.activeRectEl.style.left = `${snappedPosition.x}px`;
            this.activeRectEl.style.top = `${snappedPosition.y}px`;
            this.checkCollisions();
        }
    }
    
    onMouseUp(e) {
        if (this.view.isPanning && !this.isDrawing && !this.isDragging) {
            this.view.isPanning = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Finalize drawing a new rectangle
        if (this.isDrawing && this.activeRectEl) {
            this.isDrawing = false;
            this.canvas.style.cursor = 'default';
            
            const width = parseInt(this.activeRectEl.style.width);
            const height = parseInt(this.activeRectEl.style.height);

            // Do not create a new location if the drawn rectangle is too small
            if (width < 5 || height < 5) {
                this.activeRectEl.remove();
                this.activeRectEl = null;
                return;
            }

            const newId = `location_${Date.now()}`;
            const newName = `New Location ${this.locations.length + 1}`;
            const newLocation = {
                id: newId,
                name: newName,
                shape: {
                    type: 'rect',
                    x: parseInt(this.activeRectEl.style.left),
                    y: parseInt(this.activeRectEl.style.top),
                    width: width,      // X = length (LEFT-RIGHT) 
                    height: height,    // Z = width (UP-DOWN)
                    depth: 50         // Y = height (vertical space, not rendered)
                }
            };
            this.locations.push(newLocation);
            this.activeRectEl.dataset.id = newId;
            this.activeRectEl.textContent = newName;
            this.activeRectEl.addEventListener('mousedown', (ev) => this.onRectMouseDown(ev, newId));
            
            // Adjust text size for the newly created rectangle
            this.adjustTextSize(this.activeRectEl);
            
            this.selectRect(newId);
            this.updateLayerDropdown();
            this.applyLayerFilter();
            this.updateJson();
        } 
        // Finalize dragging an existing rectangle
        else if (this.isDragging && this.activeRectEl) {
            // Commit the position using the stored drag position to prevent jumping
            const loc = this.locations.find(l => l.id === this.selectedRectId);
            if (loc) {
                loc.shape.x = this.currentDragPosition.x;
                loc.shape.y = this.currentDragPosition.y;
            }
            
            // Clear all dragging states immediately
            this.isDragging = false;
            this.canvas.classList.remove('is-dragging');
            
            // Remove any collision styling immediately and fix border style without delay
            if (this.activeRectEl) {
                this.activeRectEl.classList.remove('colliding');
                // Force immediate border style update by re-applying selection class
                this.activeRectEl.classList.remove('selected');
                this.activeRectEl.classList.add('selected');
            }
            
            // Update JSON after position is committed
            this.updateJson();
        }
        
        // Clear activeRectEl reference
        this.activeRectEl = null;
    }

    selectRect(id) {
        // Clear previous selection immediately
        document.querySelectorAll('.location-rect.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        this.selectedRectId = id;
        
        // Apply new selection immediately
        const newSelectedEl = document.querySelector(`.location-rect[data-id="${id}"]`);
        if (newSelectedEl) {
            newSelectedEl.classList.add('selected');
        }
        
        this.renderPropertiesPanel();
    }
    
    deselectAll() {
        this.selectedRectId = null;
        document.querySelectorAll('.location-rect.selected').forEach(el => el.classList.remove('selected'));
        this.renderPropertiesPanel();
    }
    
    checkCollisions() {
        if (!this.activeRectEl) return;
        let isColliding = false;
        const activeRect = this.activeRectEl.getBoundingClientRect();
        const activeWorldRect = this.getWorldBounds(this.activeRectEl);
        
        document.querySelectorAll('.location-rect').forEach(rect => {
            if (rect === this.activeRectEl) return;
            const staticWorldRect = this.getWorldBounds(rect);
            
            // Check for overlap in world coordinates
            if (!(activeWorldRect.right <= staticWorldRect.left || 
                  activeWorldRect.left >= staticWorldRect.right || 
                  activeWorldRect.bottom <= staticWorldRect.top || 
                  activeWorldRect.top >= staticWorldRect.bottom)) {
                isColliding = true;
            }
        });
        
        this.activeRectEl.classList.toggle('colliding', isColliding);
    }

    getWorldBounds(element) {
        const left = parseInt(element.style.left) || 0;
        const top = parseInt(element.style.top) || 0;
        const width = parseInt(element.style.width) || 0;
        const height = parseInt(element.style.height) || 0;
        
        return {
            left: left,
            top: top,
            right: left + width,
            bottom: top + height
        };
    }
    
        renderPropertiesPanel() {
        if (!this.selectedRectId) {
            this.propsPanel.innerHTML = `<p class="placeholder">Select a location, or click '+ Add' to draw a new one.</p>`;
            return;
        }
        const loc = this.locations.find(l => l.id === this.selectedRectId);
        if (!loc) return;

        const lengthM = (loc.shape.width / this.pixelsPerMeter).toFixed(2);  // X = length (LEFT-RIGHT)
        const widthM = (loc.shape.height / this.pixelsPerMeter).toFixed(2);  // Z = width (UP-DOWN in 2D view)
        const heightM = ((loc.shape.depth || 50) / this.pixelsPerMeter).toFixed(2);  // Y = height (vertical space, not rendered)
        
        // Convert position pixels to meters
        const posXM = (loc.shape.x / this.pixelsPerMeter).toFixed(2);
        const posYM = (0 / this.pixelsPerMeter).toFixed(2); // Y position is always 0 in 2D view
        const posZM = (loc.shape.y / this.pixelsPerMeter).toFixed(2); // Z position maps to CSS top
        
        this.propsPanel.innerHTML = `
            <div class="prop-field">
                <label for="prop-name">Name</label>
                <input type="text" id="prop-name" value="${loc.name || ''}">
            </div>
            
            <div class="prop-section">
                <label class="section-label">Position</label>
                <div class="inline-inputs">
                    <div class="inline-input-group">
                        <label for="prop-pos-x">X</label>
                        <input type="number" id="prop-pos-x" value="${posXM}" step="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="prop-pos-y">Y</label>
                        <input type="number" id="prop-pos-y" value="${posYM}" step="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="prop-pos-z">Z</label>
                        <input type="number" id="prop-pos-z" value="${posZM}" step="0.1">
                    </div>
                </div>
            </div>
            
            <div class="prop-section">
                <label class="section-label">Dimensions (m)</label>
                <div class="inline-inputs">
                    <div class="inline-input-group">
                        <label for="prop-length">Length (X)</label>
                        <input type="number" id="prop-length" value="${lengthM}" step="0.1" min="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="prop-height">Height (Y)</label>
                        <input type="number" id="prop-height" value="${heightM}" step="0.1" min="0.1">
                    </div>
                    <div class="inline-input-group">
                        <label for="prop-width">Width (Z)</label>
                        <input type="number" id="prop-width" value="${widthM}" step="0.1" min="0.1">
                    </div>
                </div>
            </div>
            <div class="prop-field" style="display: ${loc.isTransition ? 'none' : 'block'};" id="single-layer-field">
                <label for="prop-layer">Layer</label>
                <input type="text" id="prop-layer" value="${loc.layer || 'ground'}">
            </div>
            <div class="prop-field">
                <label for="prop-parent">Parent Location</label>
                <select id="prop-parent">
                    <option value="">None (Root)</option>
                </select>
            </div>
            <div class="prop-field">
                <label for="prop-transition">Transition Zone</label>
                <input type="checkbox" id="prop-transition" ${loc.isTransition ? 'checked' : ''}>
                <small>Allows occupancy of multiple locations simultaneously</small>
            </div>
            <div class="prop-field" style="display: ${loc.isTransition ? 'block' : 'none'};" id="transition-layers-field">
                <label for="prop-transition-layers">Layers</label>
                <select id="prop-transition-layers" multiple style="height: 120px;">
                    <!-- Layer options will be populated here -->
                </select>
                <small>Hold Ctrl/Cmd to select multiple layers</small>
            </div>
            <div class="prop-field" style="display: ${loc.isTransition ? 'block' : 'none'};" id="connected-locations-field">
                <label for="prop-connected">Connected Locations</label>
                <div id="connected-locations-list">
                    <!-- Connected locations will be populated here -->
                </div>
                <button type="button" id="add-connection-btn" class="btn btn-sm">+ Add Connection</button>
            </div>
            <div class="prop-field">
                <label for="prop-id">ID (Auto-generated)</label>
                <input type="text" id="prop-id" value="${loc.id}" readonly>
            </div>
        `;
        
        const nameInput = document.getElementById('prop-name');
        const idInput = document.getElementById('prop-id');
        
        // Populate parent dropdown
        this.populateParentDropdown(loc.id);

        nameInput.addEventListener('input', e => {
            const newName = e.target.value;
            
            // Only update the visual label immediately, don't modify the data model yet
            const rectEl = document.querySelector(`.location-rect[data-id="${this.selectedRectId}"]`);
            if (rectEl) {
                rectEl.textContent = newName || loc.id; // Show text immediately or fallback to original ID
                this.adjustTextSize(rectEl);
            }
        });
        
        // Update the data model and JSON only when user stops editing or presses enter
        const updateNameData = () => {
            const newName = nameInput.value;
            const newId = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            
            loc.name = newName;
            loc.id = newId;
            
            const rectEl = document.querySelector(`.location-rect[data-id="${this.selectedRectId}"]`);
            if (rectEl) {
                rectEl.textContent = newName || newId;
                rectEl.dataset.id = newId;
                this.adjustTextSize(rectEl);
            }
            this.selectedRectId = newId;
            idInput.value = newId;
            this.updateJson();
        };
        
        nameInput.addEventListener('blur', updateNameData);
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.target.blur(); // This will trigger the blur event and updateNameData
            }
        });
        
        // Position event listeners
        document.getElementById('prop-pos-x').addEventListener('change', e => {
            const newPosXM = parseFloat(e.target.value);
            loc.shape.x = newPosXM * this.pixelsPerMeter;  // X position maps to CSS left
            this.updateRectElement(loc);
            this.updateJson();
        });

        document.getElementById('prop-pos-y').addEventListener('change', e => {
            // Y position is not used in the 2D view but could be stored for 3D compatibility
            // For now, this doesn't affect the visual representation
            const newPosYM = parseFloat(e.target.value);
            // Could store in loc.shape.z if needed for 3D compatibility in the future
        });

        document.getElementById('prop-pos-z').addEventListener('change', e => {
            const newPosZM = parseFloat(e.target.value);
            loc.shape.y = newPosZM * this.pixelsPerMeter;  // Z position maps to CSS top
            this.updateRectElement(loc);
            this.updateJson();
        });

        // Dimension event listeners
        document.getElementById('prop-length').addEventListener('change', e => {
            const newLengthM = parseFloat(e.target.value);
            if (this.locations.length === 1) {
                this.pixelsPerMeter = loc.shape.width / newLengthM;
            }
            loc.shape.width = newLengthM * this.pixelsPerMeter;  // X = length (LEFT-RIGHT) maps to CSS width
            loc.shape.height = parseFloat(document.getElementById('prop-width').value) * this.pixelsPerMeter;  // Z = width (UP-DOWN) maps to CSS height
            loc.shape.depth = parseFloat(document.getElementById('prop-height').value) * this.pixelsPerMeter;  // Y = height (vertical space)
            this.updateRectElement(loc);
            this.updateJson();
        });

        document.getElementById('prop-height').addEventListener('change', e => {
            const newHeightM = parseFloat(e.target.value);
            loc.shape.depth = newHeightM * this.pixelsPerMeter;  // Y = height (vertical space, not rendered)
            this.updateJson();
        });

        document.getElementById('prop-width').addEventListener('change', e => {
            const newWidthM = parseFloat(e.target.value);
            loc.shape.height = newWidthM * this.pixelsPerMeter;  // Z = width (UP-DOWN) maps to CSS height
            this.updateRectElement(loc);
            this.updateJson();
        });

        document.getElementById('prop-layer').addEventListener('change', e => {
            const newLayer = e.target.value.trim() || 'ground';
            loc.layer = newLayer;
            this.updateRectElement(loc);
            this.updateLayerDropdown();
            this.applyLayerFilter();
            this.updateJson();
        });

        document.getElementById('prop-parent').addEventListener('change', e => {
            const newParentId = e.target.value || null;
            loc.parentId = newParentId;
            this.updateHierarchicalDisplay();
            this.updateJson();
        });

        document.getElementById('prop-transition').addEventListener('change', e => {
            loc.isTransition = e.target.checked;
            if (loc.isTransition && !loc.connectedLocations) {
                loc.connectedLocations = [];
            }
            if (loc.isTransition && !loc.transitionLayers) {
                loc.transitionLayers = [loc.layer || "ground"];
            }
            document.getElementById('single-layer-field').style.display = loc.isTransition ? 'none' : 'block';
            document.getElementById('transition-layers-field').style.display = loc.isTransition ? 'block' : 'none';
            document.getElementById('connected-locations-field').style.display = loc.isTransition ? 'block' : 'none';
            if (loc.isTransition) {
                this.populateTransitionLayersDropdown(loc);
            }
            this.updateRectElement(loc);
            this.updateJson();
        });

        // Populate connected locations and transition layers if it's a transition zone
        if (loc.isTransition) {
            this.populateConnectedLocations(loc);
            this.populateTransitionLayersDropdown(loc);
        }
    }

    updateRectElement(loc) {
        const rectEl = document.querySelector(`.location-rect[data-id="${loc.id}"]`);
        if (!rectEl) return;

        // Update 3D positioning and styling
        this.apply3DTransform(rectEl, loc);
        
        // Re-adjust text size after rectangle update
        this.adjustTextSize(rectEl);
    }

    apply3DTransform(rectEl, loc) {
        // Set base position (top-left corner is fixed)
        rectEl.style.left = `${loc.shape.x}px`;
        rectEl.style.top = `${loc.shape.y}px`;
        rectEl.style.width = `${loc.shape.width}px`;
        rectEl.style.height = `${loc.shape.height}px`;
        
        // Set position and remove shadows
        rectEl.style.position = 'absolute';
        rectEl.style.boxShadow = 'none';
        
        // Add depth visualization class for 3D borders
        rectEl.classList.add('cube-3d');
        
        // Add transition zone styling
        if (loc.isTransition) {
            rectEl.classList.add('transition-zone');
        } else {
            rectEl.classList.remove('transition-zone');
        }
        
        // Set z-index based on position for proper layering
        const layerZIndex = this.getLayerZIndex(loc.layer || "ground");
        const zIndex = Math.floor((loc.shape.y + loc.shape.x) / 10) + layerZIndex * 1000;
        rectEl.style.zIndex = zIndex;
    }

    adjustTextSize(rectEl) {
        // Skip if no text content
        if (!rectEl.textContent || rectEl.textContent.trim() === '') {
            return;
        }

        // Use setTimeout to ensure the element is fully rendered
        setTimeout(() => {
            // Get the available space inside the rectangle (accounting for padding)
            const availableWidth = rectEl.offsetWidth - 10; // 5px padding on each side
            const availableHeight = rectEl.offsetHeight;
            
            if (availableWidth <= 0 || availableHeight <= 0) {
                return;
            }

            // Start with a reasonable font size and work our way down
            let fontSize = 16;
            
            // Create a temporary element to measure text dimensions
            const tempEl = document.createElement('span');
            tempEl.style.visibility = 'hidden';
            tempEl.style.position = 'absolute';
            tempEl.style.whiteSpace = 'nowrap';
            tempEl.style.fontFamily = getComputedStyle(rectEl).fontFamily || 'Inter, sans-serif';
            tempEl.style.fontWeight = getComputedStyle(rectEl).fontWeight || '600';
            tempEl.textContent = rectEl.textContent;
            document.body.appendChild(tempEl);

            // Decrease font size until text fits within the available width
            while (fontSize > 6) { // Set minimum font size to 6px
                tempEl.style.fontSize = fontSize + 'px';
                
                if (tempEl.offsetWidth <= availableWidth && tempEl.offsetHeight <= availableHeight) {
                    break;
                }
                
                fontSize--;
            }

            // Apply the calculated font size
            rectEl.style.fontSize = fontSize + 'px';
            
            // Clean up temporary element
            document.body.removeChild(tempEl);
        }, 0);
    }

}