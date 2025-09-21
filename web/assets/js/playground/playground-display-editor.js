// Display Editor - Models digital display interfaces with overlapping UI elements
class DisplayEditor {
    constructor() {
        this.canvas = null;
        this.propsPanel = null;
        this.monacoEditor = null;
        
        this.isDrawing = false;
        this.isDrawingDisplay = false;
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
    this.resizeTargetType = null; // 'element' | 'viewport'
    this.resizeLabelEl = null; // size indicator during resize
        this.displays = [];
        this.activeDisplayId = null;

        this.isUpdatingJson = false;
        this.hasInitiallyLoaded = false;
        this.isUpdatingProperties = false;
        this.world = null;
        this.showGrid = true;
        
        // Cache for performance optimization
        this.canvasRect = null;

        // Debouncing for JSON updates
        this.updateSimulationJsonTimeout = null;

        
        this.view = {
            scale: 1,
            x: 0,
            y: 0,
            isPanning: false,
            lastPan: { x: 0, y: 0 },
            scrollSensitivity: 2.5
        };
        
        // Space key timing for quick tap detection
        this.spaceKeyState = {
            isDown: false,
            downTime: 0,
            panActivated: false
        };

        // Snapping options
        this.snapSettings = {
            xEnabled: false,
            yEnabled: false,
            tolerance: 10
        };

        // UI element types and their properties
        this.elementTypes = {
            'window': { icon: '🪟', canHaveChildren: true, defaultWidth: 400, defaultHeight: 300 },
            'button': { icon: '🔘', canHaveChildren: false, defaultWidth: 80, defaultHeight: 30 },
            'textbox': { icon: '📝', canHaveChildren: false, defaultWidth: 150, defaultHeight: 25 },
            'label': { icon: '🏷️', canHaveChildren: false, defaultWidth: 100, defaultHeight: 20 },
            'panel': { icon: '📋', canHaveChildren: true, defaultWidth: 200, defaultHeight: 150 },
            'menu': { icon: '📋', canHaveChildren: true, defaultWidth: 120, defaultHeight: 200 },
            'dialog': { icon: '💭', canHaveChildren: true, defaultWidth: 300, defaultHeight: 200 }
        };
    }

    initialize(canvasEl, propsPanelEl, editor) {
        console.log("DISPLAY-EDITOR: Initializing display editor");
        this.canvas = canvasEl;
        this.propsPanel = propsPanelEl;
        this.monacoEditor = editor;
        
        // Create world container
        this.world = document.createElement('div');
        this.world.className = 'display-world';
        this.canvas.appendChild(this.world);
        
        this.setupEventListeners();
        this.loadFromSimulation();
        
        // Listen for editor changes to reload display data
        if (this.monacoEditor && this.monacoEditor.onDidChangeModelContent) {
            this.monacoEditor.onDidChangeModelContent(() => {
                // Only reload if we're not currently updating the JSON ourselves
                if (!this.isUpdatingJson && !this.isUpdatingProperties) {
                    setTimeout(() => {
                        this.loadFromSimulation();
                        // Re-render properties panel to update elements list
                        this.renderPropertiesPanel();
                    }, 50); // Small delay to ensure JSON has been processed
                }
            });
        }
        
        console.log("DISPLAY-EDITOR: Initialization complete");
    }

    setupEventListeners() {
        // Display management
        const addDisplayBtn = document.getElementById('add-display-btn');
        if (addDisplayBtn) {
            addDisplayBtn.addEventListener('click', () => this.createNewDisplay());
        }

        const displaySelect = document.getElementById('display-select');
        if (displaySelect) {
            displaySelect.addEventListener('change', (e) => {
                this.activeDisplayId = e.target.value;
                this.renderActiveDisplay();
            });
        }
        
        // Element creation
        const addElementBtn = document.getElementById('add-display-element-btn');
        if (addElementBtn) {
            addElementBtn.addEventListener('click', () => {
                this.isDrawing = true;
                this.canvas.style.cursor = 'crosshair';
                this.deselectAll();
            });
        }

        // Quick element buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('element-quick-btn')) {
                const elementType = e.target.dataset.elementType;
                this.createQuickElement(elementType);
            }
        });

        // Grid toggle
        const showGridCheckbox = document.getElementById('display-show-grid');
        if (showGridCheckbox) {
            showGridCheckbox.addEventListener('change', (e) => {
                this.showGrid = e.target.checked;
                this.updateGridVisibility();
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
        const zoomInBtn = document.getElementById('display-zoom-in-btn');
        const zoomOutBtn = document.getElementById('display-zoom-out-btn');
        const zoomFitBtn = document.getElementById('display-zoom-fit-btn');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => this.zoomToFit());

        const scrollSensitivitySlider = document.getElementById('display-scroll-sensitivity');
        if (scrollSensitivitySlider) {
            this.view.scrollSensitivity = parseFloat(scrollSensitivitySlider.value);
            scrollSensitivitySlider.addEventListener('input', (e) => {
                this.view.scrollSensitivity = parseFloat(e.target.value);
            });
        }

        // Snapping options
        const snapXCheckbox = document.getElementById('display-snap-x-enabled');
        const snapYCheckbox = document.getElementById('display-snap-y-enabled');
        const snapToleranceInput = document.getElementById('display-snap-tolerance');
        
        if (snapXCheckbox) {
            this.snapSettings.xEnabled = snapXCheckbox.checked;
            snapXCheckbox.addEventListener('change', (e) => {
                this.snapSettings.xEnabled = e.target.checked;
            });
        }
        
        if (snapYCheckbox) {
            this.snapSettings.yEnabled = snapYCheckbox.checked;
            snapYCheckbox.addEventListener('change', (e) => {
                this.snapSettings.yEnabled = e.target.checked;
            });
        }
        
        if (snapToleranceInput) {
            this.snapSettings.tolerance = parseInt(snapToleranceInput.value) || 10;
            snapToleranceInput.addEventListener('change', (e) => {
                this.snapSettings.tolerance = parseInt(e.target.value);
            });
        }
    }

    createNewDisplay() {
        this.isDrawingDisplay = true;
        this.canvas.style.cursor = 'crosshair';
        this.deselectAll();
    }

    createQuickElement(elementType) {
        if (!this.getActiveDisplay()) {
            alert('Please create or select a display first.');
            return;
        }

        const typeInfo = this.elementTypes[elementType] || this.elementTypes.button;
        const elementId = 'element_' + Date.now();
        const element = {
            id: elementId,
            type: elementType,
            bounds: {
                x: 50 + Math.random() * 100,
                y: 50 + Math.random() * 100,
                width: typeInfo.defaultWidth,
                height: typeInfo.defaultHeight
            },
            z_index: this.getNextZIndex(),
            parent_id: null,
            content: {
                type: 'text',
                value: elementType.charAt(0).toUpperCase() + elementType.slice(1),
                alignment: 'center'
            },
            properties: {
                visible: true,
                clickable: elementType === 'button' || elementType === 'textbox',
                background: elementType === 'button' ? '#007bff' : '#f0f0f0',
                border: elementType === 'button' ? '#0056b3' : '#cccccc',
                text_color: elementType === 'button' ? '#ffffff' : '#333333',
                layout: 'stretch'
            }
        };

        const activeDisplay = this.getActiveDisplay();
        activeDisplay.rectangles.push(element);
        this.renderElement(element);
        this.selectElement(elementId);
        this.updateSimulationJson();
    }

    updateGridVisibility() {
        if (this.canvas) {
            if (this.showGrid) {
                this.canvas.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)';
                this.canvas.style.backgroundSize = '20px 20px';
            } else {
                this.canvas.style.backgroundImage = 'none';
                this.canvas.style.backgroundSize = 'auto';
            }
        }
    }

    updateDisplaySelect() {
        const displaySelect = document.getElementById('display-select');
        if (!displaySelect) return;

        displaySelect.innerHTML = this.displays.map(display => 
            `<option value="${display.id}" ${display.id === this.activeDisplayId ? 'selected' : ''}>
                ${display.name}
            </option>`
        ).join('');
    }

    updateCanvasRect() {
        if (this.canvas) {
            this.canvasRect = this.canvas.getBoundingClientRect();
        }
    }

    onCanvasMouseDown(e) {
        // Update rect cache for accuracy during interaction
        this.updateCanvasRect();
        const x = (e.clientX - this.canvasRect.left - this.view.x) / this.view.scale;
        const y = (e.clientY - this.canvasRect.top - this.view.y) / this.view.scale;

        if (this.isDrawingDisplay) {
            this.startDrawingDisplay(x, y);
            return;
        }

        if (this.isDrawing) {
            this.startDrawing(x, y);
            return;
        }

        // Check if clicking on existing element (use topmost element due to z-index)
        const clickedEl = this.getTopElementAt(e.clientX, e.clientY);
        if (clickedEl) {
            const elementId = clickedEl.dataset.elementId;
            this.selectElement(elementId);
            // If near edge, prepare for resize instead of drag
            const dir = this.getResizeDirection(e, clickedEl, 12);
            if (dir) {
                this.prepareForResize(e, clickedEl, 'element', dir);
            } else {
                this.prepareForDrag(e, clickedEl);
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Pan mode
            this.view.isPanning = true;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'move';
        } else {
            // If clicking near viewport edge, allow resizing the display viewport
            const activeDisplay = this.getActiveDisplay();
            if (activeDisplay && this.viewport) {
                const dir = this.getResizeDirection(e, this.viewport, 12);
                if (dir) {
                    this.deselectAll();
                    this.prepareForResize(e, this.viewport, 'viewport', dir);
                    return;
                }
            }
            this.deselectAll();
        }
    }

    getTopElementAt(clientX, clientY) {
        const elements = document.querySelectorAll('.display-element-rect');
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

    startDrawingDisplay(x, y) {
        this.startCoords = { x, y };

        // Create temporary display viewport rectangle
        this.activeRectEl = document.createElement('div');
        this.activeRectEl.className = 'display-viewport-drawing drawing';
        this.activeRectEl.style.position = 'absolute';
        this.activeRectEl.style.left = x + 'px';
        this.activeRectEl.style.top = y + 'px';
        this.activeRectEl.style.width = '0px';
        this.activeRectEl.style.height = '0px';
        this.activeRectEl.style.border = '3px dashed #ff6b35';
        this.activeRectEl.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
        this.activeRectEl.innerHTML = '<div class="dimension-text" style="position: absolute; top: -25px; left: 0; color: #ff6b35; font-size: 12px; font-weight: bold;">New Display (0 × 0px)</div>';

        // Disable animations during drawing for performance
        this.activeRectEl.style.transition = 'none';
        this.activeRectEl.style.transform = 'none';
        this.activeRectEl.style.boxShadow = 'none';
        document.body.classList.add('disable-animations');

        this.world.appendChild(this.activeRectEl);
    }

    startDrawing(x, y) {
        this.startCoords = { x, y };

        // Create temporary rectangle
        this.activeRectEl = document.createElement('div');
        this.activeRectEl.className = 'display-element-rect drawing';
        this.activeRectEl.style.position = 'absolute';
        this.activeRectEl.style.left = x + 'px';
        this.activeRectEl.style.top = y + 'px';
        this.activeRectEl.style.width = '0px';
        this.activeRectEl.style.height = '0px';
        this.activeRectEl.style.border = '2px dashed #007bff';
        this.activeRectEl.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';

        // Disable animations during drawing for performance
        this.activeRectEl.style.transition = 'none';
        this.activeRectEl.style.transform = 'none';
        this.activeRectEl.style.boxShadow = 'none';
        document.body.classList.add('disable-animations');

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

        // Update hover cursor for resize affordance when idle
        if (!this.isDrawing && !this.isDrawingDisplay && !this.isDragging && !this.isResizing && !this.isPreparingToDrag && !this.isPreparingToResize) {
            const hoveredEl = this.getTopElementAt(e.clientX, e.clientY) || this.viewport;
            if (hoveredEl) {
                const dir = this.getResizeDirection(e, hoveredEl, 12);
                const cursorMap = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', sw: 'nesw-resize' };
                this.canvas.style.cursor = dir ? cursorMap[dir] : 'default';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }

        if ((this.isDrawing || this.isDrawingDisplay) && this.activeRectEl) {
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

            // Update dimension text for display drawing
            if (this.isDrawingDisplay) {
                const dimensionText = this.activeRectEl.querySelector('.dimension-text');
                if (dimensionText) {
                    dimensionText.textContent = `New Display (${Math.round(width)} × ${Math.round(height)}px)`;
                }
            }
        }

        // Check if we should start resizing based on mouse movement distance
        if (this.isPreparingToResize && this.activeRectEl) {
            const deltaX = e.clientX - this.initialMousePosition.x;
            const deltaY = e.clientY - this.initialMousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Start resizing if mouse has moved more than 5 pixels
            if (distance > 5) {
                this.startResizing();
            }
        }
        // Handle Resizing an existing element
        else if (this.isResizing && this.activeRectEl) {
            this.performResize(e);
        }
        // Check if we should start dragging based on mouse movement distance
        else if (this.isPreparingToDrag && this.activeRectEl) {
            const deltaX = e.clientX - this.initialMousePosition.x;
            const deltaY = e.clientY - this.initialMousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Start dragging if mouse has moved more than 5 pixels
            if (distance > 5) {
                this.startDragging();
            }
        }

        if (this.isDragging && this.activeRectEl) {
            // Use cached canvas rect with fallback
            const rect = this.canvasRect || this.canvas.getBoundingClientRect();
            const newX = (e.clientX - rect.left - this.view.x) / this.view.scale - this.dragOffset.x;
            const newY = (e.clientY - rect.top - this.view.y) / this.view.scale - this.dragOffset.y;

            // Apply snapping
            const snappedPosition = this.applySnapping(newX, newY);

            this.currentDragPosition = { x: snappedPosition.x, y: snappedPosition.y };
            this.activeRectEl.style.left = snappedPosition.x + 'px';
            this.activeRectEl.style.top = snappedPosition.y + 'px';
        }
    }

    onMouseUp(e) {
        if (this.view.isPanning) {
            this.view.isPanning = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        if (this.isDrawingDisplay && this.activeRectEl) {
            this.finishDrawingDisplay();
        } else if (this.isDrawing && this.activeRectEl) {
            this.finishDrawing();
        }

        if (this.isResizing) {
            this.finishResizing();
        } else if (this.isDragging) {
            this.finishDragging();
        } else if (this.isPreparingToDrag || this.isPreparingToResize) {
            // User clicked but didn't drag/resize - just clean up preparation state
            this.isPreparingToDrag = false;
            this.isPreparingToResize = false;
            this.activeRectEl = null;
        }
    }

    // ----- Resize helpers -----
    getResizeDirection(e, rectEl, threshold = 12) {
        const rect = rectEl.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / (rect.right - rect.left);
        const relY = (e.clientY - rect.top) / (rect.bottom - rect.top);
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

    prepareForResize(e, rectEl, targetType, dir) {
        this.isPreparingToResize = true;
        this.activeRectEl = rectEl;
        this.resizeTargetType = targetType; // 'element' | 'viewport'
        this.resizeDirection = dir;
        this.initialMousePosition = { x: e.clientX, y: e.clientY };

        // Capture starting rect in world coordinates (styles are already px relative to world)
        const startX = parseFloat(rectEl.style.left) || 0;
        const startY = parseFloat(rectEl.style.top) || 0;
        const startW = parseFloat(rectEl.style.width) || rectEl.offsetWidth;
        const startH = parseFloat(rectEl.style.height) || rectEl.offsetHeight;
        this.resizeStartRect = { x: startX, y: startY, width: startW, height: startH };

        // Show size label
        this.showResizeLabel(rectEl, targetType === 'viewport' ? `${Math.round(startW)} × ${Math.round(startH)} px` : `${Math.round(startW)} × ${Math.round(startH)} px`);

        // Set cursor
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

        // Convert mouse to world coords
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.view.x) / this.view.scale;
        const mouseY = (e.clientY - rect.top - this.view.y) / this.view.scale;

        const minW = 10, minH = 10;
        const start = this.resizeStartRect;
        let newX = start.x, newY = start.y, newW = start.width, newH = start.height;

        const dir = this.resizeDirection;
        const right = start.x + start.width;
        const bottom = start.y + start.height;

        if (dir.includes('e')) {
            newW = Math.max(minW, mouseX - start.x);
        }
        if (dir.includes('s')) {
            newH = Math.max(minH, mouseY - start.y);
        }
        if (dir.includes('w')) {
            newX = Math.min(mouseX, right - minW);
            newW = Math.max(minW, right - newX);
        }
        if (dir.includes('n')) {
            newY = Math.min(mouseY, bottom - minH);
            newH = Math.max(minH, bottom - newY);
        }

        // Optional snapping for element resizing (not for viewport)
        if (this.resizeTargetType === 'element') {
            const snapped = this.applyResizeSnappingBounds(this.activeRectEl, { x: newX, y: newY, width: newW, height: newH }, this.resizeDirection, this.snapSettings, '.display-element-rect');
            newX = snapped.x; newY = snapped.y; newW = snapped.width; newH = snapped.height;
        }

        // Apply to element styles
        this.activeRectEl.style.left = newX + 'px';
        this.activeRectEl.style.top = newY + 'px';
        this.activeRectEl.style.width = newW + 'px';
        this.activeRectEl.style.height = newH + 'px';

        // Update size label
        this.showResizeLabel(this.activeRectEl, `${Math.round(newW)} × ${Math.round(newH)} px`);
    }

    // Snap bounds during resize so moved edges align to nearby edges
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

        // Horizontal snapping (left/right edges)
        if (snapSettings.xEnabled) {
            if (dir.includes('w')) {
                for (const t of targets) {
                    if (Math.abs(x - t.left) <= tol) { const newLeft = t.left; width = right - newLeft; x = newLeft; break; }
                    if (Math.abs(x - t.right) <= tol) { const newLeft = t.right; width = right - newLeft; x = newLeft; break; }
                }
            }
            if (dir.includes('e')) {
                for (const t of targets) {
                    if (Math.abs(right - t.left) <= tol) { width = t.left - x; break; }
                    if (Math.abs(right - t.right) <= tol) { width = t.right - x; break; }
                }
            }
        }

        // Vertical snapping (top/bottom edges)
        if (snapSettings.yEnabled) {
            if (dir.includes('n')) {
                for (const t of targets) {
                    if (Math.abs(y - t.top) <= tol) { const newTop = t.top; height = bottom - newTop; y = newTop; break; }
                    if (Math.abs(y - t.bottom) <= tol) { const newTop = t.bottom; height = bottom - newTop; y = newTop; break; }
                }
            }
            if (dir.includes('s')) {
                for (const t of targets) {
                    if (Math.abs(bottom - t.top) <= tol) { height = t.top - y; break; }
                    if (Math.abs(bottom - t.bottom) <= tol) { height = t.bottom - y; break; }
                }
            }
        }

        // Enforce minimums
        width = Math.max(10, width);
        height = Math.max(10, height);
        return { x, y, width, height };
    }

    finishResizing() {
        if (!this.isResizing || !this.activeRectEl) return;

        // Re-enable animations
        this.activeRectEl.style.transition = '';
        this.activeRectEl.classList.remove('resizing');
        document.body.classList.remove('disable-animations');

        const newX = parseFloat(this.activeRectEl.style.left) || 0;
        const newY = parseFloat(this.activeRectEl.style.top) || 0;
        const newW = parseFloat(this.activeRectEl.style.width) || this.activeRectEl.offsetWidth;
        const newH = parseFloat(this.activeRectEl.style.height) || this.activeRectEl.offsetHeight;

        if (this.resizeTargetType === 'viewport') {
            const activeDisplay = this.getActiveDisplay();
            if (activeDisplay) {
                activeDisplay.viewport.width = Math.round(newW);
                activeDisplay.viewport.height = Math.round(newH);
                // Viewport should remain at 0,0
                this.viewport.style.left = '0px';
                this.viewport.style.top = '0px';
                this.updateSimulationJson();
                this.renderActiveDisplay();
                this.renderPropertiesPanel();
            }
        } else if (this.resizeTargetType === 'element' && this.selectedRectId) {
            const activeDisplay = this.getActiveDisplay();
            const element = activeDisplay?.rectangles.find(r => r.id === this.selectedRectId);
            if (element) {
                element.bounds.x = newX;
                element.bounds.y = newY;
                element.bounds.width = Math.round(newW);
                element.bounds.height = Math.round(newH);
                this.updateSimulationJson();
                this.renderPropertiesPanel();
            }
        }

        // Cleanup
        this.hideResizeLabel();
        this.isResizing = false;
        this.isPreparingToResize = false;
        this.resizeDirection = null;
        this.resizeStartRect = null;
        this.resizeTargetType = null;
        this.activeRectEl = null;
        this.canvas.style.cursor = 'default';
    }

    showResizeLabel(anchorEl, text) {
        // Remove existing label if it exists
        this.hideResizeLabel();

        // Create new label positioned relative to world, not the element
        this.resizeLabelEl = document.createElement('div');
        this.resizeLabelEl.className = 'dimension-text';
        this.resizeLabelEl.style.position = 'absolute';
        this.resizeLabelEl.style.zIndex = '1001';
        this.resizeLabelEl.style.pointerEvents = 'none';
        this.resizeLabelEl.style.background = 'rgba(0, 123, 255, 0.9)';
        this.resizeLabelEl.style.color = '#ffffff';
        this.resizeLabelEl.style.padding = '2px 6px';
        this.resizeLabelEl.style.borderRadius = '4px';
        this.resizeLabelEl.style.fontSize = '11px';
        this.resizeLabelEl.style.fontWeight = '600';
        this.resizeLabelEl.style.whiteSpace = 'nowrap';
        this.resizeLabelEl.textContent = text;

        // Position relative to the element's current position in the world
        const elementX = parseFloat(anchorEl.style.left) || 0;
        const elementY = parseFloat(anchorEl.style.top) || 0;

        // Position label above the element in world coordinates
        this.resizeLabelEl.style.left = `${elementX}px`;
        this.resizeLabelEl.style.top = `${elementY - 25}px`;

        // Append to the world container, not the element
        this.world.appendChild(this.resizeLabelEl);
    }

    hideResizeLabel() {
        if (this.resizeLabelEl && this.resizeLabelEl.parentElement) {
            this.resizeLabelEl.parentElement.removeChild(this.resizeLabelEl);
        }
        this.resizeLabelEl = null;
    }

    finishDrawingDisplay() {
        const widthPx = parseFloat(this.activeRectEl.style.width);
        const heightPx = parseFloat(this.activeRectEl.style.height);

        // Re-enable animations after drawing
        document.body.classList.remove('disable-animations');

        if (widthPx < 50 || heightPx < 50) {
            // Too small for a display, cancel
            this.world.removeChild(this.activeRectEl);
            this.activeRectEl = null;
            this.isDrawingDisplay = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Prompt for display name
        const displayName = prompt('Enter a name for the new display:', 'New Display');
        if (!displayName || displayName.trim() === '') {
            // User cancelled or entered empty name, abort creation
            this.world.removeChild(this.activeRectEl);
            this.activeRectEl = null;
            this.isDrawingDisplay = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Generate ID from name (replace spaces with underscores, make lowercase, add timestamp for uniqueness)
        const displayId = displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        const newDisplay = {
            id: displayId,
            name: displayName.trim(),
            physical_object_id: null,
            digital_object_id: null,
            viewport: { 
                width: Math.round(widthPx), 
                height: Math.round(heightPx) 
            },
            rectangles: []
        };

        this.displays.push(newDisplay);
        this.activeDisplayId = displayId;
        this.updateDisplaySelect();
        this.updateSimulationJson();

        // Cleanup
        this.world.removeChild(this.activeRectEl);
        this.activeRectEl = null;
        this.isDrawingDisplay = false;
        this.canvas.style.cursor = 'default';
        
        // Render the new display
        this.renderActiveDisplay();
        this.renderPropertiesPanel();
        this.updateGridVisibility();
    }

    finishDrawing() {
        const widthPx = parseFloat(this.activeRectEl.style.width);
        const heightPx = parseFloat(this.activeRectEl.style.height);

        // Re-enable animations after drawing
        document.body.classList.remove('disable-animations');

        if (widthPx < 10 || heightPx < 10) {
            // Too small, cancel
            this.world.removeChild(this.activeRectEl);
            this.activeRectEl = null;
            this.isDrawing = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Create new display element
        const elementId = 'element_' + Date.now();
        const element = {
            id: elementId,
            type: 'button',
            bounds: {
                x: parseFloat(this.activeRectEl.style.left),
                y: parseFloat(this.activeRectEl.style.top),
                width: widthPx,
                height: heightPx
            },
            z_index: this.getNextZIndex(),
            parent_id: null,
            content: {
                type: 'text',
                value: 'Button',
                alignment: 'center'
            },
            properties: {
                visible: true,
                clickable: true,
                background: '#f0f0f0',
                border: '#cccccc',
                text_color: '#333333',
                layout: 'stretch'
            }
        };

        const activeDisplay = this.getActiveDisplay();
        if (activeDisplay) {
            activeDisplay.rectangles.push(element);
            this.renderElement(element);
            this.selectElement(elementId);
            this.updateSimulationJson();
        }

        // Cleanup
        this.world.removeChild(this.activeRectEl);
        this.activeRectEl = null;
        this.isDrawing = false;
        this.canvas.style.cursor = 'default';
        
        // Re-render properties to update element list
        this.renderPropertiesPanel();
    }

    getNextZIndex() {
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay || !activeDisplay.rectangles.length) return 1;
        
        const maxZ = Math.max(...activeDisplay.rectangles.map(r => r.z_index || 0));
        return maxZ + 1;
    }

    renderElement(element) {
        const existingEl = document.querySelector(`[data-element-id="${element.id}"]`);
        if (existingEl) {
            existingEl.remove();
        }

        const rectEl = document.createElement('div');
        rectEl.className = 'display-element-rect';
        rectEl.dataset.elementId = element.id;
        rectEl.style.position = 'absolute';
        rectEl.style.left = element.bounds.x + 'px';
        rectEl.style.top = element.bounds.y + 'px';
        rectEl.style.width = element.bounds.width + 'px';
        rectEl.style.height = element.bounds.height + 'px';
        rectEl.style.zIndex = element.z_index || 1;
        
        // Prevent default browser dragging behavior
        rectEl.draggable = false;
        rectEl.addEventListener('dragstart', (e) => e.preventDefault());
        rectEl.addEventListener('contextmenu', (e) => {
            if (this.isDragging) e.preventDefault();
        });
        
        // Apply visual styling
        rectEl.style.border = `1px solid ${element.properties.border || '#cccccc'}`;
        rectEl.style.backgroundColor = element.properties.background || '#f0f0f0';
        rectEl.style.color = element.properties.text_color || '#333333';
        rectEl.style.display = element.properties.visible ? 'block' : 'none';
        
        // Add content
        this.renderElementContent(rectEl, element);
        
        // Append to viewport if it exists, otherwise to world (for compatibility)
        const container = this.viewport || this.world;
        container.appendChild(rectEl);
    }

    renderElementContent(rectEl, element) {
        const typeInfo = this.elementTypes[element.type] || this.elementTypes.button;
        const textColor = element.properties.text_color || '#333333';
        const layout = element.properties.layout || 'stretch';

        // Determine object-fit style based on layout setting
        const getObjectFit = (layout) => {
            switch (layout) {
                case 'center': return 'none';
                case 'contain': return 'contain';
                case 'cover': return 'cover';
                case 'none': return 'none';
                case 'stretch':
                default: return 'fill';
            }
        };

        // Get alignment styles for centering when layout is 'center' or 'none'
        const getCenteringStyle = (layout) => {
            if (layout === 'center' || layout === 'none') {
                return 'display: flex; align-items: center; justify-content: center;';
            }
            return '';
        };

        if (element.content.type === 'text') {
            rectEl.innerHTML = `
                <div class="element-content" data-layout="${layout}" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: ${element.content.alignment || 'center'};
                    font-size: 12px;
                    overflow: hidden;
                    color: ${textColor};
                ">
                    <span class="element-icon">${sanitizeHTML(typeInfo.icon)}</span>
                    <span class="element-text">${sanitizeHTML(element.content.value || '')}</span>
                </div>
            `;
        } else if (element.content.type === 'image') {
            const objectFit = getObjectFit(layout);
            const centeringStyle = getCenteringStyle(layout);

            // Resolve asset reference to actual data URL if needed
            let imageSource = element.content.value;
            if (window.AssetManager && window.AssetManager.isAssetReference(element.content.value)) {
                imageSource = window.AssetManager.resolveAsset(element.content.value);
            }

            rectEl.innerHTML = `
                <div class="element-content" data-layout="${layout}" style="
                    width: 100%;
                    height: 100%;
                    overflow: ${layout === 'none' ? 'visible' : 'hidden'};
                    ${centeringStyle}
                ">
                    <img src="${sanitizeHTML(imageSource)}" style="
                        ${layout === 'center' || layout === 'none' ? 'max-width: 100%; max-height: 100%;' : 'width: 100%; height: 100%;'}
                        object-fit: ${objectFit};
                        object-position: center;
                    " draggable="false" />
                </div>
            `;
        } else {
            rectEl.innerHTML = `
                <div class="element-content" data-layout="${layout}" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: ${textColor};
                ">
                    ${sanitizeHTML(typeInfo.icon)}
                </div>
            `;
        }
    }

    selectElement(elementId) {
        // Remove selection from other elements
        document.querySelectorAll('.display-element-rect.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select the clicked element
        const elementEl = document.querySelector(`[data-element-id="${elementId}"]`);
        if (elementEl) {
            elementEl.classList.add('selected');
        }
        
        this.selectedRectId = elementId;
        this.renderPropertiesPanel();
    }

    renderPropertiesPanel() {
        // Check if editor is initialized
        if (!this.propsPanel) {
            return;
        }
        
        if (!this.selectedRectId) {
            const activeDisplay = this.getActiveDisplay();
            this.propsPanel.innerHTML = `
                <div class="prop-section">
                    <label class="section-label">Display Overview</label>
                    ${activeDisplay ? `
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">
                            <div><strong>${activeDisplay.name}</strong></div>
                            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                                <span>Size:</span>
                                <input type="number" id="display-width" value="${activeDisplay.viewport.width}" min="100" step="10" style="width: 70px; padding: 2px 4px; border: 1px solid var(--border-color); border-radius: 3px; font-size: 0.75rem;">
                                <span>×</span>
                                <input type="number" id="display-height" value="${activeDisplay.viewport.height}" min="100" step="10" style="width: 70px; padding: 2px 4px; border: 1px solid var(--border-color); border-radius: 3px; font-size: 0.75rem;">
                                <span>px</span>
                            </div>
                            <div>Elements: ${activeDisplay.rectangles.length}</div>
                            ${activeDisplay.physical_object_id ? `<div>Linked to: ${activeDisplay.physical_object_id}</div>` : ''}
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem; font-style: italic;">
                            No display selected. Create a new display to start designing interfaces.
                        </div>
                    `}
                </div>

                ${window.AssetManager ? `
                    <div class="prop-section">
                        <label class="section-label">Asset Management</label>
                        <button type="button" class="btn-secondary" id="cleanup-assets-btn" style="width: 100%; font-size: 0.8rem;">
                            🧹 Clean Up Unused Assets
                        </button>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">
                            Remove asset files no longer referenced in the simulation
                        </div>
                    </div>
                ` : ''}
                
                ${activeDisplay ? `
                    <div class="prop-section">
                        <label class="section-label">Elements (${activeDisplay.rectangles.length})</label>
                        <div class="elements-list" style="max-height: 120px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-light);">
                            ${activeDisplay.rectangles.length > 0 ? activeDisplay.rectangles
                                .sort((a, b) => (b.z_index || 1) - (a.z_index || 1))
                                .map(element => `
                                    <div class="element-item" data-element-id="${element.id}" style="display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-bottom: 1px solid var(--border-color); cursor: pointer; font-size: 12px;" onclick="window.displayEditor && window.displayEditor.selectElement('${element.id}')">
                                        <span>${this.elementTypes[element.type]?.icon || '⬜'}</span>
                                        <span style="flex: 1;">${element.content.value || element.type}</span>
                                        <span style="color: var(--text-light); font-size: 10px;">z:${element.z_index || 1}</span>
                                    </div>
                                `).join('') : 
                                '<div style="padding: 8px; text-align: center; color: var(--text-light); font-style: italic; font-size: 12px;">No elements added yet</div>'
                            }
                        </div>
                    </div>
                ` : ''}
            `;
            
            // Setup display property listeners if display is active
            if (activeDisplay) {
                this.setupDisplayPropertyListeners();
            }

            // Setup asset cleanup button listener
            const cleanupBtn = document.getElementById('cleanup-assets-btn');
            if (cleanupBtn && window.AssetManager) {
                cleanupBtn.addEventListener('click', () => {
                    window.AssetManager.cleanupUnusedAssets();
                    this.renderPropertiesPanel(); // Refresh to update any UI changes
                });
            }
            return;
        }

        const activeDisplay = this.getActiveDisplay();
        const element = activeDisplay?.rectangles.find(r => r.id === this.selectedRectId);
        if (!element) return;

        this.propsPanel.innerHTML = `
            <div class="prop-section">
                <label class="section-label">Element Properties</label>
                
                <div class="prop-field">
                    <label for="element-type">Type:</label>
                    <select id="element-type">
                        ${Object.entries(this.elementTypes).map(([type, info]) => 
                            `<option value="${type}" ${element.type === type ? 'selected' : ''}>${info.icon} ${type.charAt(0).toUpperCase() + type.slice(1)}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="prop-field">
                    <label for="element-parent">Parent Element:</label>
                    <select id="element-parent">
                        <option value="">None (Root Level)</option>
                        ${activeDisplay.rectangles.filter(r => r.id !== element.id && this.elementTypes[r.type]?.canHaveChildren).map(r => 
                            `<option value="${r.id}" ${element.parent_id === r.id ? 'selected' : ''}>${r.content.value || r.type}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="prop-field">
                    <label for="element-z-index">Z-Index (Layer):</label>
                    <input type="number" id="element-z-index" value="${element.z_index || 1}" min="1">
                    <small style="color: var(--text-light); font-size: 0.75rem;">Higher numbers appear on top</small>
                </div>
            </div>
            
            <div class="prop-section">
                <label class="section-label">Content</label>
                
                <div class="prop-field">
                    <label for="content-type">Content Type:</label>
                    <select id="content-type">
                        <option value="text" ${element.content.type === 'text' ? 'selected' : ''}>📝 Text</option>
                        <option value="image" ${element.content.type === 'image' ? 'selected' : ''}>🖼️ Image</option>
                        <option value="icon" ${element.content.type === 'icon' ? 'selected' : ''}>🎨 Icon Only</option>
                    </select>
                </div>
                
                <div class="prop-field" id="content-value-field">
                    ${element.content.type === 'image' ? `
                        <label for="content-file">Custom SVG/Image:</label>
                        <input type="file" id="content-file" accept=".svg,.png,.jpg,.jpeg,.gif,.webp" style="margin-bottom: 8px;">
                        <label for="content-value">Or Image URL:</label>
                        <input type="text" id="content-value" value="${window.AssetManager && window.AssetManager.isAssetReference(element.content.value) ? '' : (element.content.value || '')}" placeholder="https://example.com/image.png">
                        ${window.AssetManager && window.AssetManager.isAssetReference(element.content.value) ? `
                            <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px; padding: 4px 8px; background: var(--bg-light); border-radius: 3px; border: 1px solid var(--border-color);">
                                📎 Using uploaded file: ${element.content.value}
                            </div>
                        ` : ''}
                    ` : `
                        <label for="content-value">Text:</label>
                        <input type="text" id="content-value" value="${element.content.value || ''}" placeholder="Button text">
                    `}
                </div>
            </div>
            
            <div class="prop-section">
                <label class="section-label">Position & Size</label>
                
                <div class="inline-inputs">
                    <div class="inline-input-group">
                        <label for="element-x">X (px)</label>
                        <input type="number" id="element-x" value="${element.bounds.x}" step="1">
                    </div>
                    <div class="inline-input-group">
                        <label for="element-y">Y (px)</label>
                        <input type="number" id="element-y" value="${element.bounds.y}" step="1">
                    </div>
                    <div class="inline-input-group">
                        <label for="element-width">Width</label>
                        <input type="number" id="element-width" value="${element.bounds.width}" step="1" min="10">
                    </div>
                    <div class="inline-input-group">
                        <label for="element-height">Height</label>
                        <input type="number" id="element-height" value="${element.bounds.height}" step="1" min="10">
                    </div>
                </div>
            </div>
            
            <div class="prop-section">
                <label class="section-label">Appearance</label>
                
                <div class="inline-inputs" style="margin-bottom: 0.5rem;">
                    <div class="inline-input-group">
                        <label for="element-background">Background</label>
                        <input type="color" id="element-background" value="${element.properties.background || '#f0f0f0'}">
                    </div>
                    <div class="inline-input-group">
                        <label for="element-border">Border</label>
                        <input type="color" id="element-border" value="${element.properties.border || '#cccccc'}">
                    </div>
                    <div class="inline-input-group">
                        <label for="element-text-color">Text</label>
                        <input type="color" id="element-text-color" value="${element.properties.text_color || '#333333'}">
                    </div>
                </div>
                
                <div class="prop-field">
                    <label class="checkbox-label">
                        <input type="checkbox" id="element-visible" ${element.properties.visible ? 'checked' : ''}> Visible
                    </label>
                </div>

                <div class="prop-field">
                    <label class="checkbox-label">
                        <input type="checkbox" id="element-clickable" ${element.properties.clickable ? 'checked' : ''}> Clickable/Interactive
                    </label>
                </div>

                <div class="prop-field">
                    <label for="element-layout">SVG/Icon Layout:</label>
                    <select id="element-layout">
                        <option value="stretch" ${(element.properties.layout || 'stretch') === 'stretch' ? 'selected' : ''}>🔄 Stretch (Default)</option>
                        <option value="center" ${element.properties.layout === 'center' ? 'selected' : ''}>🎯 Center</option>
                        <option value="contain" ${element.properties.layout === 'contain' ? 'selected' : ''}>📐 Contain</option>
                        <option value="cover" ${element.properties.layout === 'cover' ? 'selected' : ''}>📋 Cover</option>
                        <option value="none" ${element.properties.layout === 'none' ? 'selected' : ''}>⭐ None (Actual Size)</option>
                    </select>
                    <small style="color: var(--text-light); font-size: 0.75rem;">How SVG icons and images fit within the element</small>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; gap: 0.5rem;">
                <button type="button" class="btn-secondary" id="duplicate-element" style="flex: 1;">Duplicate</button>
                <button type="button" class="btn-danger" id="delete-element" style="flex: 1;">Delete</button>
            </div>
        `;

        this.setupElementPropertyListeners();
    }

    setupDisplayPropertyListeners() {
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay) return;

        // Display size inputs
        const widthInput = document.getElementById('display-width');
        const heightInput = document.getElementById('display-height');
        
        if (widthInput) {
            widthInput.addEventListener('input', (e) => {
                const rawValue = e.target.value;
                if (rawValue !== '' && !isNaN(parseInt(rawValue))) {
                    const newWidth = parseInt(rawValue);
                    if (newWidth >= 100) {
                        activeDisplay.viewport.width = newWidth;
                        this.renderActiveDisplay();
                        this.updateSimulationJson();
                        
                        // Refresh properties panel to update element count and other info if needed
                        if (!this.selectedRectId) {
                            this.renderPropertiesPanel();
                        }
                    }
                }
            });
        }
        
        if (heightInput) {
            heightInput.addEventListener('input', (e) => {
                const rawValue = e.target.value;
                if (rawValue !== '' && !isNaN(parseInt(rawValue))) {
                    const newHeight = parseInt(rawValue);
                    if (newHeight >= 100) {
                        activeDisplay.viewport.height = newHeight;
                        this.renderActiveDisplay();
                        this.updateSimulationJson();
                        
                        // Refresh properties panel to update element count and other info if needed
                        if (!this.selectedRectId) {
                            this.renderPropertiesPanel();
                        }
                    }
                }
            });
        }
    }

    setupElementPropertyListeners() {
        const activeDisplay = this.getActiveDisplay();
        const element = activeDisplay?.rectangles.find(r => r.id === this.selectedRectId);
        if (!element) return;

        // Element type
        const typeSelect = document.getElementById('element-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                element.type = e.target.value;
                const typeInfo = this.elementTypes[element.type];
                if (typeInfo) {
                    element.bounds.width = Math.max(element.bounds.width, typeInfo.defaultWidth);
                    element.bounds.height = Math.max(element.bounds.height, typeInfo.defaultHeight);
                }
                this.renderElement(element);
                this.renderPropertiesPanel();
                this.updateSimulationJson();
            });
        }

        // Content properties
        ['content-type', 'content-value', 'content-alignment'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.isUpdatingProperties = true;

                    const prop = id.split('-')[1];

                    // Special handling for content-value to preserve asset references
                    if (id === 'content-value' && element.content.type === 'image') {
                        // If user enters a value, it replaces any existing asset reference
                        // If user clears the field and there's an asset reference, don't overwrite it
                        if (e.target.value.trim() !== '') {
                            element.content[prop] = e.target.value;
                        } else if (!window.AssetManager || !window.AssetManager.isAssetReference(element.content.value)) {
                            // Only clear if it's not an asset reference
                            element.content[prop] = e.target.value;
                        }
                    } else {
                        element.content[prop] = e.target.value;
                    }

                    this.renderElement(element);
                    if (prop === 'type') this.renderPropertiesPanel();
                    this.updateSimulationJson();

                    // Use setTimeout to clear flag after all synchronous operations complete
                    setTimeout(() => {
                        this.isUpdatingProperties = false;
                    }, 0);
                });
            }
        });

        // File input for images
        const fileInput = document.getElementById('content-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        // Set updating flag to prevent other handlers from interfering
                        this.isUpdatingProperties = true;

                        try {
                            // Use AssetManager to store the file and get a reference
                            if (window.AssetManager) {
                                const assetReference = window.AssetManager.storeAsset(event.target.result);
                                if (assetReference) {
                                    element.content.value = assetReference;
                                    console.log('Asset stored with reference:', assetReference);
                                } else {
                                    // Fallback to direct storage if AssetManager fails
                                    element.content.value = event.target.result;
                                    console.warn('AssetManager failed, using direct storage');
                                }
                            } else {
                                // Fallback if AssetManager is not available
                                element.content.value = event.target.result;
                                console.warn('AssetManager not available, using direct storage');
                            }

                            // Clear the URL input to show we're using the file
                            const urlInput = document.getElementById('content-value');
                            if (urlInput) urlInput.value = '';

                            this.renderElement(element);
                            this.updateSimulationJson();

                            // Refresh properties panel to show the asset reference indicator
                            this.renderPropertiesPanel();
                        } finally {
                            // Clear updating flag after all operations complete
                            setTimeout(() => {
                                this.isUpdatingProperties = false;
                            }, 100); // Longer delay to ensure all async operations complete
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Position and size
        ['x', 'y', 'width', 'height'].forEach(prop => {
            const input = document.getElementById(`element-${prop}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const rawValue = e.target.value;
                    // Only update if we have a valid numeric value
                    if (rawValue !== '' && !isNaN(parseFloat(rawValue))) {
                        const value = parseFloat(rawValue);
                        const minValue = prop.includes('width') || prop.includes('height') ? 10 : 0;
                        element.bounds[prop] = Math.max(value, minValue);
                        this.renderElement(element);
                        this.updateSimulationJson();
                    }
                    // If invalid input, don't update the element bounds but leave the input as-is
                    // This allows users to clear fields temporarily while typing
                });
            }
        });

        // Appearance properties
        ['background', 'border', 'text-color'].forEach(prop => {
            const input = document.getElementById(`element-${prop}`); // Use hyphen, not underscore
            if (input) {
                input.addEventListener('input', (e) => {
                    this.isUpdatingProperties = true;
                    
                    element.properties[prop.replace('-', '_')] = e.target.value; // Store with underscore in properties
                    this.renderElement(element);
                    this.updateSimulationJson();
                    
                    setTimeout(() => {
                        this.isUpdatingProperties = false;
                    }, 0);
                });
            }
        });

        // Checkboxes
        ['visible', 'clickable'].forEach(prop => {
            const checkbox = document.getElementById(`element-${prop}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    element.properties[prop] = e.target.checked;
                    this.renderElement(element);
                    this.updateSimulationJson();
                });
            }
        });

        // Layout select
        const layoutSelect = document.getElementById('element-layout');
        if (layoutSelect) {
            layoutSelect.addEventListener('change', (e) => {
                element.properties.layout = e.target.value;
                this.renderElement(element);
                this.updateSimulationJson();
            });
        }

        // Z-index
        const zIndexInput = document.getElementById('element-z-index');
        if (zIndexInput) {
            zIndexInput.addEventListener('input', (e) => {
                const rawValue = e.target.value;
                if (rawValue !== '' && !isNaN(parseInt(rawValue))) {
                    element.z_index = Math.max(parseInt(rawValue), 1);
                    this.renderElement(element);
                    this.updateSimulationJson();
                }
            });
        }

        // Parent
        const parentSelect = document.getElementById('element-parent');
        if (parentSelect) {
            parentSelect.addEventListener('change', (e) => {
                element.parent_id = e.target.value || null;
                this.updateSimulationJson();
            });
        }

        // Action buttons
        const deleteBtn = document.getElementById('delete-element');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteElement(element.id));
        }

        const duplicateBtn = document.getElementById('duplicate-element');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.duplicateElement(element));
        }
    }

    getActiveDisplay() {
        return this.displays.find(d => d.id === this.activeDisplayId);
    }

    deleteElement(elementId) {
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay) return;

        const index = activeDisplay.rectangles.findIndex(r => r.id === elementId);
        if (index >= 0) {
            activeDisplay.rectangles.splice(index, 1);
            const rectEl = document.querySelector(`[data-element-id="${elementId}"]`);
            if (rectEl) rectEl.remove();
            this.deselectAll();
            this.updateSimulationJson();
        }
    }

    duplicateElement(element) {
        const newElement = {
            ...JSON.parse(JSON.stringify(element)),
            id: 'element_' + Date.now(),
            bounds: {
                ...element.bounds,
                x: element.bounds.x + 20,
                y: element.bounds.y + 20
            },
            z_index: this.getNextZIndex()
        };

        const activeDisplay = this.getActiveDisplay();
        if (activeDisplay) {
            activeDisplay.rectangles.push(newElement);
            this.renderElement(newElement);
            this.selectElement(newElement.id);
            this.updateSimulationJson();
        }
    }

    deselectAll() {
        document.querySelectorAll('.display-element-rect.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedRectId = null;
        this.renderPropertiesPanel();
    }

    renderActiveDisplay() {
        // Check if editor is initialized
        if (!this.world) {
            return;
        }
        
        // Clear existing elements
        this.world.innerHTML = '';
        
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay) return;

        // Render display viewport boundary
        this.viewport = document.createElement('div');
        this.viewport.className = 'display-viewport';
        this.viewport.dataset.displayId = activeDisplay.id;
        this.viewport.style.position = 'absolute';
        this.viewport.style.left = '0px';
        this.viewport.style.top = '0px';
        this.viewport.style.width = activeDisplay.viewport.width + 'px';
        this.viewport.style.height = activeDisplay.viewport.height + 'px';
        this.viewport.style.border = '2px solid #333';
        this.viewport.style.backgroundColor = '#ffffff';
        this.viewport.style.zIndex = '0';
        this.world.appendChild(this.viewport);
        
        // Render all elements
        activeDisplay.rectangles
            .sort((a, b) => (a.z_index || 1) - (b.z_index || 1))
            .forEach(element => {
                this.renderElement(element);
            });
    }

    loadFromSimulation() {
        if (!this.monacoEditor) return;
        
        // Skip reloading if we're currently updating properties to prevent position reset
        if (this.isUpdatingProperties) {
            return;
        }

        try {
            const jsonText = this.monacoEditor.getValue();
            const simulation = JSON.parse(jsonText);
            
            if (simulation.displays && Array.isArray(simulation.displays)) {
                // Ensure numeric values are properly preserved during JSON loading
                this.displays = simulation.displays.map(display => ({
                    ...display,
                    rectangles: display.rectangles.map(rect => ({
                        ...rect,
                        bounds: {
                            x: typeof rect.bounds.x === 'number' ? rect.bounds.x : parseFloat(rect.bounds.x) || 0,
                            y: typeof rect.bounds.y === 'number' ? rect.bounds.y : parseFloat(rect.bounds.y) || 0,
                            width: typeof rect.bounds.width === 'number' ? rect.bounds.width : parseFloat(rect.bounds.width) || 100,
                            height: typeof rect.bounds.height === 'number' ? rect.bounds.height : parseFloat(rect.bounds.height) || 30
                        },
                        z_index: typeof rect.z_index === 'number' ? rect.z_index : parseInt(rect.z_index) || 1
                    }))
                }));
                
                if (this.displays.length > 0 && !this.activeDisplayId) {
                    this.activeDisplayId = this.displays[0].id;
                }
                this.updateDisplaySelect();
                this.renderActiveDisplay();
            }
        } catch (e) {
            console.log("DISPLAY-EDITOR: Could not parse JSON for displays");
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
                
                simulation.displays = this.displays;
                
                this.isUpdatingJson = true;
                this.monacoEditor.setValue(JSON.stringify(simulation, null, 2));
                this.isUpdatingJson = false;
            } catch (e) {
                console.error("DISPLAY-EDITOR: Error updating simulation JSON:", e);
            }
        }, 50); // 50ms debounce for better responsiveness
    }

    // View and zoom methods (same as digital space editor)
    zoomIn() {
        this.view.scale = Math.min(this.view.scale * 1.2, 3);
        this.updateViewTransform();
    }

    zoomOut() {
        this.view.scale = Math.max(this.view.scale / 1.2, 0.1);
        this.updateViewTransform();
    }

    zoomToFit() {
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay) {
            this.view.scale = 1;
            this.view.x = 0;
            this.view.y = 0;
            this.updateViewTransform();
            return;
        }

        const canvasRect = this.canvas.getBoundingClientRect();
        const padding = 50;
        const displayWidth = activeDisplay.viewport.width;
        const displayHeight = activeDisplay.viewport.height;

        const scaleX = (canvasRect.width - padding * 2) / displayWidth;
        const scaleY = (canvasRect.height - padding * 2) / displayHeight;
        this.view.scale = Math.min(scaleX, scaleY, 2);

        this.view.x = (canvasRect.width - displayWidth * this.view.scale) / 2;
        this.view.y = (canvasRect.height - displayHeight * this.view.scale) / 2;

        this.updateViewTransform();
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
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldScale = this.view.scale;
        const zoomSpeed = 0.001;
        const delta = -e.deltaY * zoomSpeed * this.view.scrollSensitivity;
        
        this.view.scale = Math.max(0.1, Math.min(3, this.view.scale + delta));
        
        const scaleDiff = this.view.scale - oldScale;
        this.view.x -= (mouseX - this.view.x) * scaleDiff / oldScale;
        this.view.y -= (mouseY - this.view.y) * scaleDiff / oldScale;

        this.updateViewTransform();
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
                    document.body.classList.add('display-editor-panning');
                    document.body.classList.add('disable-animations');
                }
            }, 150); // 150ms delay to detect quick taps
            return;
        }
        
        if (e.key === 'Delete' && this.selectedRectId) {
            this.deleteElement(this.selectedRectId);
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
            document.body.classList.remove('display-editor-panning');
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

        // Safely parse element position with fallback to element bounds if style is corrupted
        let rectX = parseFloat(rectEl.style.left);
        let rectY = parseFloat(rectEl.style.top);

        if (isNaN(rectX) || isNaN(rectY)) {
            const elementId = rectEl.dataset.elementId;
            const activeDisplay = this.getActiveDisplay();
            if (activeDisplay) {
                const element = this.findElementInDisplay(activeDisplay, elementId);
                if (element) {
                    rectX = element.x || 0;
                    rectY = element.y || 0;
                } else {
                    rectX = 0;
                    rectY = 0;
                }
            } else {
                rectX = 0;
                rectY = 0;
            }
        }

        this.dragOffset = {
            x: mouseX - rectX,
            y: mouseY - rectY
        };
    }

    startDragging() {
        this.isDragging = true;
        this.isPreparingToDrag = false;

        // Disable CSS animations/transitions directly on the dragged element for maximum performance
        if (this.activeRectEl) {
            this.activeRectEl.style.transition = 'none';
            this.activeRectEl.style.transform = 'none';
            this.activeRectEl.style.boxShadow = 'none';
            this.activeRectEl.classList.add('dragging');
        }
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

        const activeDisplay = this.getActiveDisplay();
        const element = activeDisplay?.rectangles.find(r => r.id === this.selectedRectId);
        if (element) {
            element.bounds.x = this.currentDragPosition.x;
            element.bounds.y = this.currentDragPosition.y;
            this.updateSimulationJson();
            this.renderPropertiesPanel();
        }

        this.isDragging = false;
        this.isPreparingToDrag = false;
        this.activeRectEl = null;
        this.canvas.style.cursor = 'default';
    }

    applySnapping(proposedX, proposedY) {
        if (!this.activeRectEl || (!this.snapSettings.xEnabled && !this.snapSettings.yEnabled)) {
            return { x: proposedX, y: proposedY };
        }

        let snappedX = proposedX;
        let snappedY = proposedY;
        
        const activeWidth = parseInt(this.activeRectEl.style.width) || 0;
        const activeHeight = parseInt(this.activeRectEl.style.height) || 0;
        
        // Get snap targets from other elements
        const snapTargets = [];
        document.querySelectorAll('.display-element-rect').forEach(rect => {
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

        // X-axis snapping (horizontal alignment)
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

        // Y-axis snapping (vertical alignment)
        if (this.snapSettings.yEnabled) {
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

    refreshFromSimulation() {
        // Called by simulation player when display elements might have moved
        // Refresh the displays and re-render the active display
        this.loadFromSimulation();
        
        // Re-render the active display to show any moved elements
        this.renderActiveDisplay();
        
        // Refresh properties panel if needed
        this.renderPropertiesPanel();
    }

    cleanup() {
        if (this.world) {
            this.world.remove();
            this.world = null;
        }
    }

    isTabActive() {
        // Check if the display-editor tab is currently active
        const displayEditorTab = document.querySelector('[data-tab="display-editor"]');
        return displayEditorTab && displayEditorTab.classList.contains('active');
    }
}

// Export for global use
window.DisplayEditor = DisplayEditor;