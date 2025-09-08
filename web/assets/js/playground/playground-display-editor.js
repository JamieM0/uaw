// Display Editor - Models digital display interfaces with overlapping UI elements
class DisplayEditor {
    constructor() {
        this.canvas = null;
        this.propsPanel = null;
        this.monacoEditor = null;
        
        this.isDrawing = false;
        this.isDrawingDisplay = false;
        this.isDragging = false;
        this.isResizing = false;
        this.activeRectEl = null;
        this.selectedRectId = null;
        this.startCoords = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.currentDragPosition = { x: 0, y: 0 };
        this.displays = [];
        this.activeDisplayId = null;

        this.isUpdatingJson = false;
        this.hasInitiallyLoaded = false;
        this.isUpdatingProperties = false;
        this.world = null;
        this.showGrid = true;
        
        // Cache for performance optimization
        this.canvasRect = null;
        this.isMouseMoveThrottled = false;
        
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
                text_color: elementType === 'button' ? '#ffffff' : '#333333'
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
            this.startDragging(e, clickedEl);
        } else if (e.ctrlKey || e.metaKey) {
            // Pan mode
            this.view.isPanning = true;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'move';
        } else {
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
        this.world.appendChild(this.activeRectEl);
    }

    onMouseMove(e) {
        // Simple throttle to prevent excessive updates
        if (this.isMouseMoveThrottled) {
            return;
        }
        this.isMouseMoveThrottled = true;
        setTimeout(() => {
            this.isMouseMoveThrottled = false;
        }, 16); // ~60fps

        if (this.view.isPanning) {
            const deltaX = e.clientX - this.view.lastPan.x;
            const deltaY = e.clientY - this.view.lastPan.y;
            this.view.x += deltaX;
            this.view.y += deltaY;
            this.view.lastPan = { x: e.clientX, y: e.clientY };
            this.updateViewTransform();
            return;
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
            
            this.activeRectEl.style.left = left + 'px';
            this.activeRectEl.style.top = top + 'px';
            this.activeRectEl.style.width = width + 'px';
            this.activeRectEl.style.height = height + 'px';
            
            // Update dimensions display for display drawing
            if (this.isDrawingDisplay) {
                const widthRounded = Math.round(width);
                const heightRounded = Math.round(height);
                const dimensionText = this.activeRectEl.querySelector('.dimension-text');
                if (dimensionText) {
                    dimensionText.textContent = `New Display (${widthRounded} × ${heightRounded}px)`;
                }
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
            return;
        }

        if (this.isDrawingDisplay && this.activeRectEl) {
            this.finishDrawingDisplay();
        } else if (this.isDrawing && this.activeRectEl) {
            this.finishDrawing();
        }

        if (this.isDragging) {
            this.finishDragging();
        }
    }

    finishDrawingDisplay() {
        const widthPx = parseFloat(this.activeRectEl.style.width);
        const heightPx = parseFloat(this.activeRectEl.style.height);
        
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
                text_color: '#333333'
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
        
        if (element.content.type === 'text') {
            rectEl.innerHTML = `
                <div class="element-content" style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%; 
                    text-align: ${element.content.alignment || 'center'};
                    font-size: 12px;
                    overflow: hidden;
                    color: ${textColor};
                ">
                    <span class="element-icon">${typeInfo.icon}</span>
                    <span class="element-text">${element.content.value || ''}</span>
                </div>
            `;
        } else if (element.content.type === 'image') {
            rectEl.innerHTML = `
                <div class="element-content" style="
                    width: 100%; 
                    height: 100%;
                    overflow: hidden;
                ">
                    <img src="${element.content.value}" style="width: 100%; height: 100%; object-fit: cover;" draggable="false" />
                </div>
            `;
        } else {
            rectEl.innerHTML = `
                <div class="element-content" style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%;
                    color: ${textColor};
                ">
                    ${typeInfo.icon}
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
        if (!this.selectedRectId) {
            const activeDisplay = this.getActiveDisplay();
            this.propsPanel.innerHTML = `
                <div class="prop-section">
                    <label class="section-label">Display Overview</label>
                    ${activeDisplay ? `
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">
                            <div><strong>${activeDisplay.name}</strong></div>
                            <div>Size: ${activeDisplay.viewport.width} × ${activeDisplay.viewport.height}px</div>
                            <div>Elements: ${activeDisplay.rectangles.length}</div>
                            ${activeDisplay.physical_object_id ? `<div>Linked to: ${activeDisplay.physical_object_id}</div>` : ''}
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem; font-style: italic;">
                            No display selected. Create a new display to start designing interfaces.
                        </div>
                    `}
                </div>
                
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
                        <input type="text" id="content-value" value="${element.content.value || ''}" placeholder="https://example.com/image.png">
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
                    <label>
                        <input type="checkbox" id="element-visible" ${element.properties.visible ? 'checked' : ''}> Visible
                    </label>
                </div>
                
                <div class="prop-field">
                    <label>
                        <input type="checkbox" id="element-clickable" ${element.properties.clickable ? 'checked' : ''}> Clickable/Interactive
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; gap: 0.5rem;">
                <button type="button" class="btn-secondary" id="duplicate-element" style="flex: 1;">Duplicate</button>
                <button type="button" class="btn-danger" id="delete-element" style="flex: 1;">Delete</button>
            </div>
        `;

        this.setupElementPropertyListeners();
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
                    element.content[prop] = e.target.value;
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
                        element.content.value = event.target.result;
                        // Clear the URL input to show we're using the file
                        const urlInput = document.getElementById('content-value');
                        if (urlInput) urlInput.value = '';
                        this.renderElement(element);
                        this.updateSimulationJson();
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
                    const value = parseFloat(e.target.value) || 0;
                    element.bounds[prop] = Math.max(value, prop.includes('width') || prop.includes('height') ? 10 : 0);
                    this.renderElement(element);
                    this.updateSimulationJson();
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

        // Z-index
        const zIndexInput = document.getElementById('element-z-index');
        if (zIndexInput) {
            zIndexInput.addEventListener('input', (e) => {
                element.z_index = parseInt(e.target.value) || 1;
                this.renderElement(element);
                this.updateSimulationJson();
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
        // Clear existing elements
        this.world.innerHTML = '';
        
        const activeDisplay = this.getActiveDisplay();
        if (!activeDisplay) return;

        // Render display viewport boundary
        this.viewport = document.createElement('div');
        this.viewport.className = 'display-viewport';
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
                this.displays = [...simulation.displays];
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
        }, 100); // 100ms debounce
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
        if (e.key === 'Delete' && this.selectedRectId) {
            this.deleteElement(this.selectedRectId);
        }
    }

    startDragging(e, rectEl) {
        this.isDragging = true;
        this.activeRectEl = rectEl;
        
        // Add dragging class to disable transitions/animations
        rectEl.classList.add('dragging');
        
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.view.x) / this.view.scale;
        const mouseY = (e.clientY - rect.top - this.view.y) / this.view.scale;
        const rectX = parseFloat(rectEl.style.left) || 0;
        const rectY = parseFloat(rectEl.style.top) || 0;
        
        this.dragOffset = {
            x: mouseX - rectX,
            y: mouseY - rectY
        };
        
        this.canvas.style.cursor = 'move';
    }

    finishDragging() {
        if (!this.isDragging || !this.selectedRectId) return;
        
        const activeDisplay = this.getActiveDisplay();
        const element = activeDisplay?.rectangles.find(r => r.id === this.selectedRectId);
        if (element) {
            element.bounds.x = this.currentDragPosition.x;
            element.bounds.y = this.currentDragPosition.y;
            this.updateSimulationJson();
            this.renderPropertiesPanel();
        }
        
        // Remove dragging class to re-enable transitions/animations
        if (this.activeRectEl) {
            this.activeRectEl.classList.remove('dragging');
        }
        
        this.isDragging = false;
        this.activeRectEl = null;
        this.canvas.style.cursor = 'default';
    }

    cleanup() {
        if (this.world) {
            this.world.remove();
            this.world = null;
        }
    }
}

// Export for global use
window.DisplayEditor = DisplayEditor;