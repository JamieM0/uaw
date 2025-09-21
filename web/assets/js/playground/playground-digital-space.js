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
    this.isResizing = false;
    this.isPreparingToResize = false;
        this.activeRectEl = null;
        this.selectedRectId = null;
        this.startCoords = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.currentDragPosition = { x: 0, y: 0 };
        this.initialMousePosition = { x: 0, y: 0 };
    this.resizeDirection = null; // 'n','s','e','w','ne','nw','se','sw'
    this.resizeStartRect = null; // {x,y,width,height}
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

        // Check if clicking on existing location first
        const clickedEl = e.target.closest('.digital-location-rect');
        if (clickedEl) {
            const locationId = clickedEl.dataset.locationId;
            this.selectLocation(locationId);
            // If near edge, prepare for resize; otherwise drag
            const dir = this.getResizeDirection(e, clickedEl, 12);
            if (dir) {
                this.prepareForResize(e, clickedEl, dir);
            } else {
                this.prepareForDrag(e, clickedEl);
            }
            return;
        }

        // Allow panning on canvas or world container (background areas)
        const isCanvas = e.target === this.canvas;
        const isWorld = e.target.classList.contains('digital-world');

        if (isCanvas || isWorld) {
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
        } else {
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

        // Disable animations during drawing for performance
        this.activeRectEl.style.transition = 'none';
        this.activeRectEl.style.transform = 'none';
        this.activeRectEl.style.boxShadow = 'none';
        document.body.classList.add('disable-animations');

        this.world.appendChild(this.activeRectEl);
    }

    getTopElementAt(clientX, clientY) {
        const elements = document.querySelectorAll('.digital-location-rect');
        let topElement = null;
        let maxZIndex = -1;

        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
                const zIndex = parseInt(getComputedStyle(el).zIndex) || 0;
                if (zIndex > maxZIndex) {
                    maxZIndex = zIndex;
                    topElement = el;
                }
            }
        });

        return topElement;
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

        // Hover cursor for resize affordance when idle
        if (!this.isDrawing && !this.isDragging && !this.isResizing && !this.isPreparingToDrag && !this.isPreparingToResize) {
            const hoveredEl = this.getTopElementAt(e.clientX, e.clientY);
            if (hoveredEl) {
                const dir = this.getResizeDirection(e, hoveredEl, 12);
                const cursorMap = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', sw: 'nesw-resize' };
                this.canvas.style.cursor = dir ? cursorMap[dir] : 'default';
            } else {
                this.canvas.style.cursor = 'default';
            }
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

            // Batch style updates for better performance
            this.activeRectEl.style.cssText += `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
        }

        // Check if we should start dragging based on mouse movement distance
        if (this.isPreparingToResize && this.activeRectEl) {
            const deltaX = e.clientX - this.initialMousePosition.x;
            const deltaY = e.clientY - this.initialMousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance > 5) {
                this.startResizing();
            }
        } else if (this.isResizing && this.activeRectEl) {
            this.performResize(e);
        } else if (this.isPreparingToDrag && this.activeRectEl) {
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

        if (this.isResizing) {
            this.finishResizing();
        } else if (this.isDragging) {
            this.finishDragging();
        } else if (this.isPreparingToDrag || this.isPreparingToResize) {
            // User clicked but didn't drag - just clean up preparation state
            this.isPreparingToDrag = false;
            this.isPreparingToResize = false;
            this.activeRectEl = null;
        }
    }

    // ----- Resize helpers (no labels/indicators) -----
    getResizeDirection(e, rectEl, threshold = 12) {
        const rect = rectEl.getBoundingClientRect();
        const nearLeft = (e.clientX - rect.left) <= threshold;
        const nearRight = (rect.right - e.clientX) <= threshold;
        const nearTop = (e.clientY - rect.top) <= threshold;
        const nearBottom = (rect.bottom - e.clientY) <= threshold;
        let dir = null;
        if (nearTop && nearLeft) dir = 'nw';
        else if (nearTop && nearRight) dir = 'ne';
        else if (nearBottom && nearLeft) dir = 'sw';
        else if (nearBottom && nearRight) dir = 'se';
        else if (nearLeft) dir = 'w';
        else if (nearRight) dir = 'e';
        else if (nearTop) dir = 'n';
        else if (nearBottom) dir = 's';
        return dir;
    }

    prepareForResize(e, rectEl, dir) {
        this.isPreparingToResize = true;
        this.activeRectEl = rectEl;
        this.resizeDirection = dir;
        this.initialMousePosition = { x: e.clientX, y: e.clientY };

        const startX = parseFloat(rectEl.style.left) || 0;
        const startY = parseFloat(rectEl.style.top) || 0;
        const startW = parseFloat(rectEl.style.width) || rectEl.offsetWidth;
        const startH = parseFloat(rectEl.style.height) || rectEl.offsetHeight;
        this.resizeStartRect = { x: startX, y: startY, width: startW, height: startH };

        const cursorMap = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', sw: 'nesw-resize' };
        this.canvas.style.cursor = cursorMap[dir] || 'default';
    }

    startResizing() {
        this.isResizing = true;
        this.isPreparingToResize = false;
        if (this.activeRectEl) {
            this.activeRectEl.style.transition = 'none';
            this.activeRectEl.classList.add('resizing');
        }
        document.body.classList.add('disable-animations');
    }

    performResize(e) {
        if (!this.activeRectEl || !this.resizeStartRect) return;
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.view.x) / this.view.scale;
        const mouseY = (e.clientY - rect.top - this.view.y) / this.view.scale;

        const minW = 10, minH = 10;
        const start = this.resizeStartRect;
        let newX = start.x, newY = start.y, newW = start.width, newH = start.height;
        const right = start.x + start.width;
        const bottom = start.y + start.height;
        const dir = this.resizeDirection;

        if (dir.includes('e')) newW = Math.max(minW, mouseX - start.x);
        if (dir.includes('s')) newH = Math.max(minH, mouseY - start.y);
        if (dir.includes('w')) { newX = Math.min(mouseX, right - minW); newW = Math.max(minW, right - newX); }
        if (dir.includes('n')) { newY = Math.min(mouseY, bottom - minH); newH = Math.max(minH, bottom - newY); }

        // Snap edges to other digital location edges if enabled
        if (this.applyResizeSnappingBounds) {
            const snapped = this.applyResizeSnappingBounds(this.activeRectEl, { x: newX, y: newY, width: newW, height: newH }, this.resizeDirection, this.snapSettings, '.digital-location-rect');
            newX = snapped.x; newY = snapped.y; newW = snapped.width; newH = snapped.height;
        }

        this.activeRectEl.style.left = newX + 'px';
        this.activeRectEl.style.top = newY + 'px';
        this.activeRectEl.style.width = newW + 'px';
        this.activeRectEl.style.height = newH + 'px';
    }

    // Snap bounds during resize similar to drag snapping
    applyResizeSnappingBounds(activeEl, bounds, dir, snapSettings, selector) {
        if (!snapSettings || (!snapSettings.xEnabled && !snapSettings.yEnabled)) return bounds;
        const tol = snapSettings.tolerance || 10;
        const targets = [];
        document.querySelectorAll(selector).forEach(el => {
            if (el === activeEl) return;
            const x = parseFloat(el.style.left) || 0;
            const y = parseFloat(el.style.top) || 0;
            const w = parseFloat(el.style.width) || el.offsetWidth;
            const h = parseFloat(el.style.height) || el.offsetHeight;
            targets.push({ left: x, right: x + w, top: y, bottom: y + h });
        });

        let { x, y, width, height } = bounds;
        const right = x + width;
        const bottom = y + height;

        if (snapSettings.xEnabled) {
            if (dir.includes('w')) {
                for (const t of targets) {
                    if (Math.abs(x - t.left) <= tol) { const nl = t.left; width = right - nl; x = nl; break; }
                    if (Math.abs(x - t.right) <= tol) { const nl = t.right; width = right - nl; x = nl; break; }
                }
            }
            if (dir.includes('e')) {
                for (const t of targets) {
                    if (Math.abs(right - t.left) <= tol) { width = t.left - x; break; }
                    if (Math.abs(right - t.right) <= tol) { width = t.right - x; break; }
                }
            }
        }

        if (snapSettings.yEnabled) {
            if (dir.includes('n')) {
                for (const t of targets) {
                    if (Math.abs(y - t.top) <= tol) { const nt = t.top; height = bottom - nt; y = nt; break; }
                    if (Math.abs(y - t.bottom) <= tol) { const nt = t.bottom; height = bottom - nt; y = nt; break; }
                }
            }
            if (dir.includes('s')) {
                for (const t of targets) {
                    if (Math.abs(bottom - t.top) <= tol) { height = t.top - y; break; }
                    if (Math.abs(bottom - t.bottom) <= tol) { height = t.bottom - y; break; }
                }
            }
        }

        width = Math.max(10, width);
        height = Math.max(10, height);
        return { x, y, width, height };
    }

    finishResizing() {
        if (!this.isResizing) return;
        if (this.activeRectEl) {
            this.activeRectEl.style.transition = '';
            this.activeRectEl.classList.remove('resizing');
        }
        document.body.classList.remove('disable-animations');

        const locationId = this.selectedRectId;
        const location = this.digitalLocations.find(l => l.id === locationId);
        if (location) {
            const newX = parseFloat(this.activeRectEl.style.left) || 0;
            const newY = parseFloat(this.activeRectEl.style.top) || 0;
            const newW = parseFloat(this.activeRectEl.style.width) || this.activeRectEl.offsetWidth;
            const newH = parseFloat(this.activeRectEl.style.height) || this.activeRectEl.offsetHeight;
            location.x = newX / this.pixelsPerMeter;
            location.y = newY / this.pixelsPerMeter;
            location.width = newW / this.pixelsPerMeter;
            location.height = newH / this.pixelsPerMeter;
            this.updateSimulationJson();
            this.renderPropertiesPanel();
        }

        this.isResizing = false;
        this.isPreparingToResize = false;
        this.resizeDirection = null;
        this.resizeStartRect = null;
        this.activeRectEl = null;
        this.canvas.style.cursor = 'default';
    }

    finishDrawing() {
        const bounds = this.activeRectEl.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        // Calculate size in meters
        const widthPx = parseFloat(this.activeRectEl.style.width);
        const heightPx = parseFloat(this.activeRectEl.style.height);

        // Re-enable animations after drawing
        document.body.classList.remove('disable-animations');

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
        
        // Add icon and label with object count
        const icon = this.getLocationIcon(location.storage_type);
        const objectCount = this.digitalObjects.filter(obj => obj.properties?.location_id === location.id).length;

        rectEl.innerHTML = `
            <div class="location-label">
                <span class="location-icon">${sanitizeHTML(icon)}</span>
                <span class="location-name">${sanitizeHTML(location.name)}</span>
                ${objectCount > 0 ? `<span class="object-count-badge">${objectCount}</span>` : ''}
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
                    <div class="section-header">
                        <div class="section-label">Digital Objects</div>
                        <button class="btn btn-sm add-object-btn" onclick="digitalSpaceEditor.createNewDigitalObject()" title="Add new digital object">+ Add</button>
                    </div>
                    <div class="digital-objects-list" id="digital-objects-list">
                        ${this.digitalObjects.length > 0 ? this.digitalObjects.map(obj => {
                            const locationId = obj.properties?.location_id;
                            const location = this.digitalLocations.find(loc => loc.id === locationId);
                            const locationName = location ? location.name : 'No Location';
                            const locationIcon = location ? this.getLocationIcon(location.storage_type) : '❓';
                            const sizeMB = obj.properties?.size_mb || 1;

                            return `
                                <div class="object-item enhanced" data-object-id="${obj.id}">
                                    <div class="object-header">
                                        <span class="object-icon">${this.getObjectIcon(obj.type)}</span>
                                        <span class="object-name clickable" onclick="digitalSpaceEditor.renameDigitalObject('${obj.id}')" title="Click to rename">${sanitizeHTML(obj.name)}</span>
                                        <button class="btn-danger-small" onclick="digitalSpaceEditor.deleteDigitalObject('${obj.id}')" title="Delete object">×</button>
                                    </div>
                                    <div class="object-details">
                                        <div class="object-detail-row">
                                            <span class="detail-label">Type:</span>
                                            <span class="detail-value">${obj.type}</span>
                                        </div>
                                        <div class="object-detail-row">
                                            <span class="detail-label">Location:</span>
                                            <span class="detail-value location-link" onclick="digitalSpaceEditor.selectLocationById('${locationId}')" title="Click to select location">
                                                ${locationIcon} ${sanitizeHTML(locationName)}
                                            </span>
                                        </div>
                                        <div class="object-detail-row">
                                            <span class="detail-label">Size:</span>
                                            <span class="detail-value">${sizeMB} MB</span>
                                        </div>
                                        ${obj.properties?.permissions ? `
                                            <div class="object-detail-row">
                                                <span class="detail-label">Access:</span>
                                                <span class="detail-value">${obj.properties.permissions}</span>
                                            </div>
                                        ` : ''}
                                        ${obj.properties?.encrypted ? `
                                            <div class="object-detail-row">
                                                <span class="detail-label">Security:</span>
                                                <span class="detail-value encrypted">🔒 Encrypted</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="object-actions">
                                        <button class="btn btn-xs" onclick="digitalSpaceEditor.showMoveObjectDialog('${obj.id}')" title="Move to different location">Move</button>
                                        <button class="btn btn-xs" onclick="digitalSpaceEditor.showEditObjectDialog('${obj.id}')" title="Edit object properties">Edit</button>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div class="empty-state">No digital objects yet. Click "Add" to create one.</div>'}
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

            // Render digital objects in their locations AFTER both locations and objects are loaded
            this.renderDigitalObjectsInLocations();
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

    renderDigitalObjectsInLocations() {
        // Clear existing object displays
        document.querySelectorAll('.digital-object-visual').forEach(el => el.remove());

        // Group objects by location
        const objectsByLocation = {};
        this.digitalObjects.forEach(obj => {
            const locationId = obj.properties?.location_id;
            if (locationId) {
                if (!objectsByLocation[locationId]) {
                    objectsByLocation[locationId] = [];
                }
                objectsByLocation[locationId].push(obj);
            }
        });

        // Render objects in each location
        Object.entries(objectsByLocation).forEach(([locationId, objects]) => {
            const locationEl = document.querySelector(`[data-location-id="${locationId}"]`);
            if (locationEl) {
                this.renderObjectsInLocation(locationEl, objects);
            }
        });
    }

    renderObjectsInLocation(locationEl, objects) {
        if (!objects || objects.length === 0) return;

        const locationRect = {
            width: parseFloat(locationEl.style.width) || 100,
            height: parseFloat(locationEl.style.height) || 100
        };

        // Calculate object size and grid layout
        const padding = 4;
        const maxObjectsPerRow = Math.floor(Math.sqrt(objects.length)) + 1;
        const availableWidth = locationRect.width - (padding * 2);
        const availableHeight = locationRect.height - (padding * 2);

        // Calculate object size - it should scale down as more objects are added
        const baseObjectSize = Math.min(24, Math.max(12, Math.min(availableWidth / maxObjectsPerRow, availableHeight / Math.ceil(objects.length / maxObjectsPerRow))));
        const objectSize = Math.max(8, baseObjectSize - 2); // Minimum size of 8px

        // Create a grid container for objects
        const objectContainer = document.createElement('div');
        objectContainer.className = 'digital-objects-container';
        objectContainer.style.cssText = `
            position: absolute;
            top: ${padding}px;
            left: ${padding}px;
            width: ${availableWidth}px;
            height: ${availableHeight}px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(${objectSize}px, 1fr));
            gap: 2px;
            align-content: start;
            pointer-events: none;
        `;

        // Create visual representation for each object
        objects.forEach(obj => {
            const objectEl = document.createElement('div');
            objectEl.className = 'digital-object-visual';
            objectEl.dataset.objectId = obj.id;
            objectEl.style.cssText = `
                width: ${objectSize}px;
                height: ${objectSize}px;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${Math.max(8, objectSize * 0.6)}px;
                cursor: grab;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                pointer-events: auto;
                user-select: none;
            `;

            // Add icon based on object type
            const icon = this.getObjectIcon(obj.type);
            objectEl.innerHTML = icon;

            // Enhanced tooltip with more information
            const sizeMB = obj.properties?.size_mb || 1;
            const permissions = obj.properties?.permissions || 'read_write';
            const encrypted = obj.properties?.encrypted ? ' 🔒' : '';
            const lastModified = obj.modified_time ? new Date(obj.modified_time).toLocaleDateString() : 'Unknown';

            objectEl.title = `${obj.name} (${obj.type})\nSize: ${sizeMB} MB\nPermissions: ${permissions}${encrypted}\nLast Modified: ${lastModified}\n\nDrag to move between locations`;

            // Add subtle visual feedback based on object properties
            if (obj.properties?.encrypted) {
                objectEl.style.border = '1px solid #28a745';
                objectEl.style.borderWidth = '2px';
            }

            if (obj.properties?.size_mb > 100) {
                objectEl.style.boxShadow = '0 1px 3px rgba(255, 193, 7, 0.3)';
            }

            // Add hover effect
            objectEl.addEventListener('mouseenter', () => {
                objectEl.style.transform = 'scale(1.1)';
                objectEl.style.zIndex = '10';
                objectEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            });

            objectEl.addEventListener('mouseleave', () => {
                if (!objectEl.classList.contains('dragging')) {
                    objectEl.style.transform = 'scale(1)';
                    objectEl.style.zIndex = '1';
                    objectEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                }
            });

            // Add drag functionality for moving between locations
            this.addObjectDragListeners(objectEl, obj);

            objectContainer.appendChild(objectEl);
        });

        locationEl.appendChild(objectContainer);
    }

    addObjectDragListeners(objectEl, digitalObject) {
        let isDragging = false;
        let dragStartPos = { x: 0, y: 0 };
        let dragOffset = { x: 0, y: 0 };

        const onMouseDown = (e) => {
            // Don't start dragging locations if clicking on digital objects
            e.stopPropagation();

            isDragging = false;
            dragStartPos = { x: e.clientX, y: e.clientY };

            const rect = objectEl.getBoundingClientRect();
            dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            const distance = Math.sqrt(
                Math.pow(e.clientX - dragStartPos.x, 2) +
                Math.pow(e.clientY - dragStartPos.y, 2)
            );

            if (distance > 5 && !isDragging) {
                // Start dragging
                isDragging = true;
                objectEl.classList.add('dragging');
                objectEl.style.position = 'fixed';
                objectEl.style.zIndex = '1000';
                objectEl.style.pointerEvents = 'none';
                objectEl.style.transform = 'scale(1.2)';
                objectEl.style.transition = 'none';
                document.body.style.cursor = 'grabbing';

                // Create highlight overlay for drop zones
                this.createDropZoneOverlays();
            }

            if (isDragging) {
                objectEl.style.left = (e.clientX - dragOffset.x) + 'px';
                objectEl.style.top = (e.clientY - dragOffset.y) + 'px';

                // Highlight potential drop zones
                this.highlightDropZone(e.clientX, e.clientY);
            }
        };

        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (isDragging) {
                // Find the drop target
                const dropTarget = this.findDropTarget(e.clientX, e.clientY);

                if (dropTarget && dropTarget !== digitalObject.properties?.location_id) {
                    // Move object to new location
                    this.moveDigitalObjectToLocation(digitalObject.id, dropTarget);
                    console.log(`DIGITAL-SPACE: Moved ${digitalObject.name} to ${this.getLocationName(dropTarget)}`);
                }

                // Clean up
                this.removeDropZoneOverlays();
                objectEl.classList.remove('dragging');
                objectEl.style.position = '';
                objectEl.style.zIndex = '';
                objectEl.style.pointerEvents = '';
                objectEl.style.transform = '';
                objectEl.style.transition = '';
                objectEl.style.left = '';
                objectEl.style.top = '';
                document.body.style.cursor = '';

                // Re-render objects in their new positions
                this.renderDigitalObjectsInLocations();
            }
        };

        objectEl.addEventListener('mousedown', onMouseDown);
    }

    createDropZoneOverlays() {
        // Remove existing overlays
        this.removeDropZoneOverlays();

        this.digitalLocations.forEach(location => {
            const locationEl = document.querySelector(`[data-location-id="${location.id}"]`);
            if (locationEl) {
                const overlay = document.createElement('div');
                overlay.className = 'drop-zone-overlay';
                overlay.dataset.locationId = location.id;

                const rect = locationEl.getBoundingClientRect();
                overlay.style.cssText = `
                    position: fixed;
                    left: ${rect.left}px;
                    top: ${rect.top}px;
                    width: ${rect.width}px;
                    height: ${rect.height}px;
                    border: 2px dashed #4CAF50;
                    background: rgba(76, 175, 80, 0.1);
                    pointer-events: none;
                    z-index: 999;
                    border-radius: 4px;
                    opacity: 0.7;
                `;

                document.body.appendChild(overlay);
            }
        });
    }

    removeDropZoneOverlays() {
        document.querySelectorAll('.drop-zone-overlay').forEach(el => el.remove());
    }

    highlightDropZone(clientX, clientY) {
        const overlays = document.querySelectorAll('.drop-zone-overlay');
        overlays.forEach(overlay => {
            const rect = overlay.getBoundingClientRect();
            const isOver = clientX >= rect.left && clientX <= rect.right &&
                          clientY >= rect.top && clientY <= rect.bottom;

            if (isOver) {
                overlay.style.background = 'rgba(76, 175, 80, 0.3)';
                overlay.style.borderColor = '#2E7D32';
            } else {
                overlay.style.background = 'rgba(76, 175, 80, 0.1)';
                overlay.style.borderColor = '#4CAF50';
            }
        });
    }

    findDropTarget(clientX, clientY) {
        const overlays = document.querySelectorAll('.drop-zone-overlay');
        for (const overlay of overlays) {
            const rect = overlay.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
                return overlay.dataset.locationId;
            }
        }
        return null;
    }

    moveDigitalObjectToLocation(objectId, newLocationId) {
        const object = this.digitalObjects.find(obj => obj.id === objectId);
        if (object) {
            object.properties.location_id = newLocationId;
            object.modified_time = new Date().toISOString();
            this.updateSimulationJson();
            this.renderPropertiesPanel();
        }
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
        }, 50); // 50ms debounce for better responsiveness
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
            // Only start new space key handling if this tab is active
            if (!this.isTabActive()) {
                return;
            }
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
        } else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+N or Cmd+N to create new digital object
            e.preventDefault();
            this.createNewDigitalObject();
        } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+L or Cmd+L to create new location
            e.preventDefault();
            this.isDrawing = true;
            this.canvas.style.cursor = 'crosshair';
            this.deselectAll();
        }
    }

    onKeyUp(e) {
        // Don't intercept space key if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }

        if (e.code === 'Space' && this.spaceKeyState.isDown) {
            // Always clean up space key state, but only trigger zoom-to-fit if tab is active
            const isTabCurrentlyActive = this.isTabActive();
            const holdDuration = Date.now() - this.spaceKeyState.downTime;
            
            // If it was a quick tap (< 150ms) and panning wasn't activated, trigger zoom-to-fit
            // But only if this tab is currently active
            if (holdDuration < 150 && !this.spaceKeyState.panActivated && isTabCurrentlyActive) {
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
        document.body.classList.add('disable-animations');

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
        document.body.classList.remove('disable-animations');
        
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
        if (this.digitalLocations.length === 0) {
            alert('Please create at least one digital location before adding digital objects.');
            return;
        }

        this.showDigitalObjectModal();
    }

    showDigitalObjectModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('add-digital-object-modal');
        if (!modal) {
            modal = this.createDigitalObjectModal();
            document.body.appendChild(modal);
        }

        // Reset form
        const form = modal.querySelector('form');
        if (form) form.reset();

        // Populate location dropdown
        const locationSelect = modal.querySelector('#digital-object-location-select');
        if (locationSelect) {
            locationSelect.innerHTML = '<option value="">Select a digital location...</option>';
            this.digitalLocations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = `${location.name} (${location.storage_type})`;
                locationSelect.appendChild(option);
            });
        }

        // Populate type dropdown
        const typeSelect = modal.querySelector('#digital-object-type-select');
        if (typeSelect) {
            typeSelect.innerHTML = `
                <option value="file">📄 File</option>
                <option value="folder">📁 Folder</option>
                <option value="database">🗃️ Database</option>
                <option value="application">💻 Application</option>
                <option value="service">⚙️ Service</option>
                <option value="process">🔄 Process</option>
                <option value="log">📋 Log</option>
                <option value="backup">💾 Backup</option>
                <option value="image">🖼️ Image</option>
                <option value="video">🎥 Video</option>
                <option value="audio">🎵 Audio</option>
                <option value="archive">📦 Archive</option>
            `;
        }

        modal.style.display = 'flex';
    }

    createDigitalObjectModal() {
        const modal = document.createElement('div');
        modal.id = 'add-digital-object-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Digital Object</h3>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').style.display='none'">&times;</button>
                </div>
                <form id="digital-object-form">
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="digital-object-name">Name: <span class="required">*</span></label>
                            <input type="text" id="digital-object-name" name="name" required placeholder="Enter object name..." />
                        </div>

                        <div class="form-group">
                            <label for="digital-object-type">Type: <span class="required">*</span></label>
                            <select id="digital-object-type-select" name="type" required>
                                <!-- Options populated dynamically -->
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="digital-object-location-select">Location: <span class="required">*</span></label>
                            <select id="digital-object-location-select" name="location_id" required>
                                <!-- Options populated dynamically -->
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="digital-object-size">Size (MB):</label>
                            <input type="number" id="digital-object-size" name="size_mb" min="0" step="0.1" value="1" />
                        </div>

                        <div class="form-group">
                            <label for="digital-object-permissions">Permissions:</label>
                            <select id="digital-object-permissions" name="permissions">
                                <option value="read_only">Read Only</option>
                                <option value="read_write" selected>Read/Write</option>
                                <option value="admin">Admin</option>
                                <option value="execute">Execute</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="digital-object-encrypted" name="encrypted" />
                                Encrypted
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').style.display='none'">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Object</button>
                    </div>
                </form>
            </div>
        `;

        // Setup form submission
        const form = modal.querySelector('#digital-object-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDigitalObjectFormSubmit(form);
        });

        return modal;
    }

    handleDigitalObjectFormSubmit(form) {
        const formData = new FormData(form);
        const name = formData.get('name').trim();
        const type = formData.get('type');
        const locationId = formData.get('location_id');
        const sizeMb = parseFloat(formData.get('size_mb')) || 1;
        const permissions = formData.get('permissions');
        const encrypted = formData.has('encrypted');

        if (!name || !type || !locationId) {
            alert('Please fill in all required fields.');
            return;
        }

        const objectId = 'digital_obj_' + Date.now();
        const newObject = {
            id: objectId,
            name: name,
            type: type,
            created_time: new Date().toISOString(),
            modified_time: new Date().toISOString(),
            properties: {
                location_id: locationId,
                size_mb: sizeMb,
                file_type: type === 'file' ? 'document' : type,
                permissions: permissions,
                encrypted: encrypted
            }
        };

        this.digitalObjects.push(newObject);
        this.renderDigitalObjectsInLocations();
        this.renderPropertiesPanel();
        this.updateSimulationJson();

        // Close modal
        document.getElementById('add-digital-object-modal').style.display = 'none';

        console.log(`DIGITAL-SPACE: Added digital object "${name}" to location "${this.getLocationName(locationId)}"`);
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
        this.renderDigitalObjectsInLocations();
        this.renderPropertiesPanel();
        this.updateSimulationJson();
    }

    deleteDigitalObject(objectId) {
        const index = this.digitalObjects.findIndex(obj => obj.id === objectId);
        if (index >= 0) {
            this.digitalObjects.splice(index, 1);
            this.renderDigitalObjectsInLocations();
            this.renderPropertiesPanel();
            this.updateSimulationJson();
        }
    }

    selectLocationById(locationId) {
        if (locationId && locationId !== 'undefined' && this.digitalLocations.find(loc => loc.id === locationId)) {
            this.selectLocation(locationId);
        }
    }

    showMoveObjectDialog(objectId) {
        const obj = this.digitalObjects.find(o => o.id === objectId);
        if (!obj) return;

        const currentLocationId = obj.properties?.location_id;
        const locations = this.digitalLocations.filter(loc => loc.id !== currentLocationId);
        if (locations.length === 0) {
            alert('No other locations available to move to.');
            return;
        }

        const locationOptions = locations.map(loc =>
            `<option value="${loc.id}">${loc.name} (${loc.storage_type})</option>`
        ).join('');

        const currentLocation = this.digitalLocations.find(loc => loc.id === currentLocationId);
        const currentLocationName = currentLocation ? currentLocation.name : 'Unknown';

        const modal = this.createQuickModal('Move Digital Object', `
            <p>Move <strong>${sanitizeHTML(obj.name)}</strong> from <em>${sanitizeHTML(currentLocationName)}</em> to:</p>
            <div class="form-group">
                <label>New Location:</label>
                <select id="move-location-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    ${locationOptions}
                </select>
            </div>
        `, [
            { text: 'Cancel', class: 'btn-secondary' },
            { text: 'Move', class: 'btn-primary', action: () => {
                const newLocationId = document.getElementById('move-location-select').value;
                if (newLocationId) {
                    this.moveDigitalObjectToLocation(objectId, newLocationId);
                }
            }}
        ]);
    }

    showEditObjectDialog(objectId) {
        const obj = this.digitalObjects.find(o => o.id === objectId);
        if (!obj) return;

        const modal = this.createQuickModal('Edit Digital Object', `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" id="edit-object-name" value="${sanitizeHTML(obj.name)}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div class="form-group">
                <label>Size (MB):</label>
                <input type="number" id="edit-object-size" value="${obj.properties?.size_mb || 1}" min="0" step="0.1" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div class="form-group">
                <label>Permissions:</label>
                <select id="edit-object-permissions" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="read_only" ${obj.properties?.permissions === 'read_only' ? 'selected' : ''}>Read Only</option>
                    <option value="read_write" ${obj.properties?.permissions === 'read_write' ? 'selected' : ''}>Read/Write</option>
                    <option value="admin" ${obj.properties?.permissions === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="execute" ${obj.properties?.permissions === 'execute' ? 'selected' : ''}>Execute</option>
                </select>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="edit-object-encrypted" ${obj.properties?.encrypted ? 'checked' : ''}>
                    Encrypted
                </label>
            </div>
        `, [
            { text: 'Cancel', class: 'btn-secondary' },
            { text: 'Save', class: 'btn-primary', action: () => {
                const name = document.getElementById('edit-object-name').value.trim();
                const size = parseFloat(document.getElementById('edit-object-size').value) || 1;
                const permissions = document.getElementById('edit-object-permissions').value;
                const encrypted = document.getElementById('edit-object-encrypted').checked;

                if (name) {
                    obj.name = name;
                    obj.properties.size_mb = size;
                    obj.properties.permissions = permissions;
                    obj.properties.encrypted = encrypted;
                    obj.modified_time = new Date().toISOString();

                    this.renderDigitalObjectsInLocations();
                    this.renderPropertiesPanel();
                    this.updateSimulationJson();
                }
            }}
        ]);
    }

    createQuickModal(title, content, buttons) {
        // Remove existing quick modal
        const existingModal = document.getElementById('quick-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'quick-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${buttons.map((btn, index) =>
                        `<button type="button" class="btn ${btn.class}" data-action="${index}">${btn.text}</button>`
                    ).join('')}
                </div>
            </div>
        `;

        // Setup button actions
        buttons.forEach((btn, index) => {
            if (btn.action) {
                const button = modal.querySelector(`[data-action="${index}"]`);
                button.addEventListener('click', () => {
                    btn.action();
                    modal.remove();
                });
            } else {
                const button = modal.querySelector(`[data-action="${index}"]`);
                button.addEventListener('click', () => modal.remove());
            }
        });

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        return modal;
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
        if (!locationId || locationId === 'undefined') return 'No Location';
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
        this.renderDigitalObjectsInLocations();

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

    isTabActive() {
        // Check if the digital-space tab is currently active
        const digitalSpaceTab = document.querySelector('[data-tab="digital-space"]');
        return digitalSpaceTab && digitalSpaceTab.classList.contains('active');
    }
}

// Utility function for HTML sanitization
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Export for global use
window.DigitalSpaceEditor = DigitalSpaceEditor;