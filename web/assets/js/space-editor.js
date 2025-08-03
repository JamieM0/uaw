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
        this.locations = [];

        this.isUpdatingJson = false;
        this.hasInitiallyLoaded = false;
        this.world = document.createElement('div');
        this.world.className = 'space-world';
        this.canvas.appendChild(this.world);

        this.view = {
            scale: 1,
            x: 0,
            y: 0,
            isPanning: false,
            lastPan: { x: 0, y: 0 }
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
    }

    updateViewTransform() {
        this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
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

    onCanvasWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -1 : 1;
        const oldScale = this.view.scale;
        this.view.scale = Math.max(0.1, Math.min(5, oldScale + delta * zoomSpeed));
        
        // Zoom towards the cursor
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.view.x = mouseX - (mouseX - this.view.x) * (this.view.scale / oldScale);
        this.view.y = mouseY - (mouseY - this.view.y) * (this.view.scale / oldScale);
        
        this.updateViewTransform();
    }

    onKeyDown(e) {
        if (e.code === 'Space' && !this.view.isPanning) {
            e.preventDefault();
            this.view.isPanning = true;
            this.canvas.style.cursor = 'grab';
        }
    }
    
    onKeyUp(e) {
        if (e.code === 'Space') {
            this.view.isPanning = false;
            this.canvas.style.cursor = 'crosshair'; // Or 'default'
        }
    }

    loadLayout(layoutData) {
        console.log("SPACE-EDITOR: loadLayout() called.", layoutData);

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
        console.log(`SPACE-EDITOR: Loading ${this.locations.length} locations with scale ${this.pixelsPerMeter} px/m.`);

        this.world.innerHTML = ''; // Clear only the world container
        this.locations.forEach(loc => this.createRectElement(loc));
        this.renderPropertiesPanel();
       
        if (this.locations.length > 0) {
            // Reset view to ensure rectangles are visible
            this.view.scale = 1;
            this.view.x = 0;
            this.view.y = 0;
            this.updateViewTransform();
            if (!this.hasInitiallyLoaded) {
                this.zoomToFit();
                this.hasInitiallyLoaded = true;
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
        rectEl.style.left = `${loc.shape.x}px`;
        rectEl.style.top = `${loc.shape.y}px`;
        rectEl.style.width = `${loc.shape.width}px`;
        rectEl.style.height = `${loc.shape.height}px`;
        rectEl.textContent = loc.name || loc.id;
        rectEl.addEventListener('mousedown', (e) => this.onRectMouseDown(e, loc.id));
        this.world.appendChild(rectEl);
        return rectEl;
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

        // Only allow drawing on the canvas itself or the world container
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
            this.deselectAll();
        }
    }
    
    onRectMouseDown(e, id) {
        e.stopPropagation();
        this.isDrawing = false;
        this.isDragging = true;
        this.canvas.classList.add('is-dragging');
        this.activeRectEl = e.target;
        this.selectedRectId = id;
        
        this.dragOffset = {
            x: e.clientX - this.activeRectEl.getBoundingClientRect().left,
            y: e.clientY - this.activeRectEl.getBoundingClientRect().top
        };
        
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

            const worldX = (screenX - this.view.x) / this.view.scale;
            const worldY = (screenY - this.view.y) / this.view.scale;

            this.activeRectEl.style.left = `${worldX - this.dragOffset.x / this.view.scale}px`;
            this.activeRectEl.style.top = `${worldY - this.dragOffset.y / this.view.scale}px`;
            this.checkCollisions();
        }
    }
    
    onMouseUp(e) {
        if (this.view.isPanning) {
            this.canvas.style.cursor = 'grab';
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
                    width: width,
                    height: height
                }
            };
            this.locations.push(newLocation);
            this.activeRectEl.dataset.id = newId;
            this.activeRectEl.textContent = newName;
            this.activeRectEl.addEventListener('mousedown', (ev) => this.onRectMouseDown(ev, newId));
            
            this.selectRect(newId);
            this.updateJson();
        } 
        // Finalize dragging an existing rectangle
        else if (this.isDragging && this.activeRectEl) {
            this.isDragging = false;
            this.canvas.classList.remove('is-dragging');
            if (this.activeRectEl.classList.contains('colliding')) {
                const loc = this.locations.find(l => l.id === this.selectedRectId);
                this.activeRectEl.style.left = `${loc.shape.x}px`;
                this.activeRectEl.style.top = `${loc.shape.y}px`;
                this.activeRectEl.classList.remove('colliding');
            } else {
                const loc = this.locations.find(l => l.id === this.selectedRectId);
                loc.shape.x = parseInt(this.activeRectEl.style.left);
                loc.shape.y = parseInt(this.activeRectEl.style.top);
                this.updateJson();
            }
        }
        this.activeRectEl = null;
    }

    selectRect(id) {
        this.selectedRectId = id;
        document.querySelectorAll('.location-rect').forEach(el => {
            el.classList.toggle('selected', el.dataset.id === id);
        });
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
        const activeBounds = this.activeRectEl.getBoundingClientRect();
        document.querySelectorAll('.location-rect').forEach(rect => {
            if (rect === this.activeRectEl) return;
            const staticBounds = rect.getBoundingClientRect();
            if (!(activeBounds.right < staticBounds.left || activeBounds.left > staticBounds.right || activeBounds.bottom < staticBounds.top || activeBounds.top > staticBounds.bottom)) {
                isColliding = true;
            }
        });
        this.activeRectEl.classList.toggle('colliding', isColliding);
        }
    
        renderPropertiesPanel() {
        if (!this.selectedRectId) {
            this.propsPanel.innerHTML = `<p class="placeholder">Select a location, or click '+ Add' to draw a new one.</p>`;
            return;
        }
        const loc = this.locations.find(l => l.id === this.selectedRectId);
        if (!loc) return;

        const widthM = (loc.shape.width / this.pixelsPerMeter).toFixed(2);
        const heightM = (loc.shape.height / this.pixelsPerMeter).toFixed(2);
        
        this.propsPanel.innerHTML = `
            <div class="prop-field">
                <label for="prop-name">Name</label>
                <input type="text" id="prop-name" value="${loc.name || ''}">
            </div>
            <div class="prop-field">
                <label for="prop-width">Width</label>
                <div class="input-group">
                    <input type="number" id="prop-width" value="${widthM}" step="0.1" min="0.1">
                    <span>m</span>
                </div>
            </div>
            <div class="prop-field">
                <label for="prop-height">Height</label>
                <div class="input-group">
                    <input type="number" id="prop-height" value="${heightM}" step="0.1" min="0.1">
                    <span>m</span>
                </div>
            </div>
            <div class="prop-field">
                <label for="prop-id">ID (Auto-generated)</label>
                <input type="text" id="prop-id" value="${loc.id}" readonly>
            </div>
        `;
        
        const nameInput = document.getElementById('prop-name');
        const idInput = document.getElementById('prop-id');

        nameInput.addEventListener('input', e => {
            const newName = e.target.value;
            const newId = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            
            loc.name = newName;
            loc.id = newId;
            
            document.querySelector(`.location-rect[data-id="${this.selectedRectId}"]`).textContent = newName;
            this.selectedRectId = newId; // Update the selected ID
            document.querySelector(`.location-rect[data-id="${newId}"]`).dataset.id = newId;
            idInput.value = newId;
            
            this.updateJson();
        });
        
        document.getElementById('prop-width').addEventListener('change', e => {
            const newWidthM = parseFloat(e.target.value);
            if (this.locations.length === 1) {
                this.pixelsPerMeter = loc.shape.width / newWidthM;
            }
            loc.shape.width = newWidthM * this.pixelsPerMeter;
            loc.shape.height = parseFloat(document.getElementById('prop-height').value) * this.pixelsPerMeter;
            this.loadLayout({ meta: { pixels_per_unit: this.pixelsPerMeter }, locations: this.locations });
            this.updateJson();
        });

        document.getElementById('prop-height').addEventListener('change', e => {
            const newHeightM = parseFloat(e.target.value);
            loc.shape.height = newHeightM * this.pixelsPerMeter;
            document.querySelector(`.location-rect[data-id="${loc.id}"]`).style.height = `${loc.shape.height}px`;
            this.updateJson();
        });
    }
}