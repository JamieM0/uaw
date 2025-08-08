/**
 * Playground UI Module
 * Handles UI management, event handling, and user interactions
 */

import { PlaygroundConfig } from './playground-config.js';

export class PlaygroundUI {
    constructor(core) {
        this.core = core;
        this.isDragging = false;
        this.dragType = "";
        this.setupEventListeners();
    }
    
    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        // Button event listeners
        this.setupButtonListeners();
        
        // Drag and drop
        this.initializeDragAndDrop();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        console.log("UI: Event listeners configured");
    }
    
    /**
     * Set up button event listeners
     */
    setupButtonListeners() {
        // JSON Editor buttons
        const loadSampleBtn = document.getElementById('load-sample-btn');
        const formatJsonBtn = document.getElementById('format-json-btn');
        const clearEditorBtn = document.getElementById('clear-editor-btn');
        
        if (loadSampleBtn) {
            loadSampleBtn.addEventListener('click', () => this.core.editorManager.loadSample());
        }
        if (formatJsonBtn) {
            formatJsonBtn.addEventListener('click', () => this.core.editorManager.formatJSON());
        }
        if (clearEditorBtn) {
            clearEditorBtn.addEventListener('click', () => this.core.editorManager.clearEditor());
        }
        
        // Simulation buttons
        const addTaskBtn = document.getElementById('add-task-btn');
        const addActorBtn = document.getElementById('add-actor-btn');
        const addResourceBtn = document.getElementById('add-resource-btn');
        
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => this.openAddTaskDialog());
        }
        if (addActorBtn) {
            addActorBtn.addEventListener('click', () => this.openAddActorDialog());
        }
        if (addResourceBtn) {
            addResourceBtn.addEventListener('click', () => this.openAddResourceDialog());
        }
        
        // Control buttons
        const renderBtn = document.getElementById('render-simulation-btn');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const undoBtn = document.getElementById('undo-btn');
        const autoRenderToggle = document.getElementById('auto-render-toggle');
        
        if (renderBtn) {
            renderBtn.addEventListener('click', () => this.core.renderSimulation());
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.core.history.undo());
        }
        if (autoRenderToggle) {
            autoRenderToggle.addEventListener('click', () => this.core.toggleAutoRender());
        }
        
        // Tutorial buttons
        const tutorialBtn = document.getElementById('tutorial-btn');
        const tutorialExitBtn = document.getElementById('tutorial-exit-btn');
        
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', () => this.startTutorial());
        }
        if (tutorialExitBtn) {
            tutorialExitBtn.addEventListener('click', () => this.exitTutorial());
        }
        
        // Submit button
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.openSubmitDialog());
        }
    }
    
    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z for undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.core.history.undo();
            }
            
            // Ctrl+Shift+F for format JSON
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.core.editorManager.formatJSON();
            }
            
            // F11 for fullscreen
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
            
            // Escape to close dialogs
            if (e.key === 'Escape') {
                this.closeDialog();
            }
        });
    }
    
    /**
     * Set up tab functionality
     */
    setupTabs() {
        console.log("UI: Setting up tabs.");
        
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update active states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                // Map tab names to content IDs correctly
                if (targetTab === 'timeline') {
                    document.getElementById('simulation-tab')?.classList.add('active');
                } else if (targetTab === 'space-editor') {
                    const spaceTab = document.getElementById('space-editor-tab');
                    if (spaceTab) {
                        spaceTab.classList.add('active');
                        
                        // Load current simulation data into space editor when tab is opened
                        if (this.core.spaceEditor) {
                            try {
                                const currentJson = this.core.editorManager.getCurrentJSON();
                                if (currentJson && currentJson.simulation && currentJson.simulation.layout) {
                                    this.core.spaceEditor.loadLayout(currentJson.simulation.layout);
                                }
                            } catch(e) {
                                console.log("UI: No valid JSON to load into space editor");
                            }
                        }
                    }
                }
            });
        });
    }
    
    /**
     * Update auto-render UI state
     */
    updateAutoRenderUI() {
        const autoRenderToggle = document.getElementById('auto-render-toggle');
        const renderBtn = document.getElementById('render-simulation-btn');
        
        if (autoRenderToggle) {
            autoRenderToggle.textContent = this.core.autoRender ? '⏸️ Auto' : '▶️ Manual';
            autoRenderToggle.title = this.core.autoRender ? 
                'Auto-render enabled (click to disable)' : 
                'Auto-render disabled (click to enable)';
        }
        
        if (renderBtn) {
            renderBtn.classList.toggle('hidden', this.core.autoRender);
        }
    }
    
    /**
     * Initialize resize handles for panels
     */
    initializeResizeHandles() {
        console.log("UI: Initializing resize handles");
        
        const verticalHandle = document.querySelector('.resize-handle-vertical');
        const horizontalHandle = document.querySelector('.resize-handle-horizontal');
        
        if (verticalHandle) {
            this.setupVerticalResize(verticalHandle);
        }
        
        if (horizontalHandle) {
            this.setupHorizontalResize(horizontalHandle);
        }
    }
    
    /**
     * Set up vertical resize handle (between editor and simulation)
     */
    setupVerticalResize(handle) {
        let isResizing = false;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const container = document.querySelector('.playground-top');
            const rect = container.getBoundingClientRect();
            const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
            
            // Constrain between 20% and 80%
            const constrainedWidth = Math.max(20, Math.min(80, newWidth));
            
            const editorPanel = document.querySelector('.json-editor-panel');
            const simulationPanel = document.querySelector('.simulation-panel');
            
            if (editorPanel && simulationPanel) {
                editorPanel.style.width = `${constrainedWidth}%`;
                simulationPanel.style.width = `${100 - constrainedWidth}%`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    }
    
    /**
     * Set up horizontal resize handle (between top and bottom panels)
     */
    setupHorizontalResize(handle) {
        let isResizing = false;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'row-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const main = document.querySelector('.playground-main');
            const rect = main.getBoundingClientRect();
            const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
            
            // Constrain between 30% and 90%
            const constrainedHeight = Math.max(30, Math.min(90, newHeight));
            
            const topPanel = document.querySelector('.playground-top');
            const bottomPanel = document.querySelector('.playground-bottom');
            
            if (topPanel && bottomPanel) {
                topPanel.style.height = `${constrainedHeight}%`;
                bottomPanel.style.height = `${100 - constrainedHeight}%`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    }
    
    /**
     * Initialize drag and drop functionality
     */
    initializeDragAndDrop() {
        console.log("UI: Initializing drag and drop");
        
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }
    
    /**
     * Handle mouse down for drag operations
     */
    handleMouseDown(e) {
        const taskBlock = e.target.closest('.task-block');
        if (!taskBlock) return;
        
        // Check if this is a resize operation
        const rect = taskBlock.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        if (x <= 8) {
            // Left edge - resize from start
            this.startResize(taskBlock, 'left', e);
        } else if (x >= rect.width - 8) {
            // Right edge - resize from end
            this.startResize(taskBlock, 'right', e);
        } else {
            // Middle - drag operation
            this.startDrag(taskBlock, e);
        }
    }
    
    /**
     * Start drag operation
     */
    startDrag(taskBlock, e) {
        this.isDragging = true;
        this.dragType = "drag";
        this.draggedTask = taskBlock;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        taskBlock.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        
        // Store original task data
        this.originalTaskData = {
            actorId: taskBlock.dataset.actorId,
            startTime: taskBlock.dataset.startTime
        };
    }
    
    /**
     * Start resize operation
     */
    startResize(taskBlock, direction, e) {
        this.isDragging = true;
        this.dragType = "resize";
        this.resizeType = direction;
        this.draggedTask = taskBlock;
        this.dragStartX = e.clientX;
        
        taskBlock.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        
        // Store original duration
        this.originalDuration = parseInt(taskBlock.dataset.duration) || 30;
        this.originalStartTime = taskBlock.dataset.startTime;
        
        // Create duration preview
        this.createDurationPreview(taskBlock);
    }
    
    /**
     * Handle mouse move for drag/resize operations
     */
    handleMouseMove(e) {
        if (!this.isDragging || !this.draggedTask) return;
        
        if (this.dragType === "drag") {
            this.handleDragMove(e);
        } else if (this.dragType === "resize") {
            this.handleResizeMove(e);
        }
    }
    
    /**
     * Handle drag movement
     */
    handleDragMove(e) {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        
        // Update task block position
        this.draggedTask.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        // Find drop target
        const dropTarget = this.findDropTarget(e.clientX, e.clientY);
        this.updateDropIndicator(dropTarget);
    }
    
    /**
     * Handle resize movement
     */
    handleResizeMove(e) {
        const deltaX = e.clientX - this.dragStartX;
        const trackElement = this.draggedTask.closest('.task-track');
        
        if (!trackElement) return;
        
        // Calculate time change based on pixel movement
        const timePerPixel = this.calculateTimePerPixel(trackElement);
        const timeChange = deltaX * timePerPixel;
        
        let newDuration = this.originalDuration;
        let newStartTime = this.originalStartTime;
        
        if (this.resizeType === 'left') {
            // Resizing from the left edge (changing start time)
            const startTimeMinutes = this.timeToMinutes(this.originalStartTime);
            const newStartTimeMinutes = Math.max(0, startTimeMinutes + timeChange);
            newStartTime = this.minutesToTime(newStartTimeMinutes);
            newDuration = Math.max(5, this.originalDuration - timeChange);
        } else {
            // Resizing from the right edge (changing duration)
            newDuration = Math.max(5, this.originalDuration + timeChange);
        }
        
        // Update duration preview
        this.updateDurationPreview(Math.round(newDuration));
    }
    
    /**
     * Handle mouse up (end drag/resize)
     */
    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        if (this.dragType === "drag") {
            this.completeDrag(e);
        } else if (this.dragType === "resize") {
            this.completeResize(e);
        }
        
        this.cleanup();
    }
    
    /**
     * Complete drag operation
     */
    completeDrag(e) {
        const dropTarget = this.findDropTarget(e.clientX, e.clientY);
        
        if (dropTarget && dropTarget !== this.draggedTask.closest('.actor-lane')) {
            const newActorId = dropTarget.dataset.actorId;
            const newTime = this.calculateNewTimeFromPosition(e.clientX, dropTarget);
            const taskId = this.draggedTask.dataset.taskId;
            
            this.core.editorManager.updateTaskInJSON(taskId, newActorId, newTime);
        }
    }
    
    /**
     * Complete resize operation
     */
    completeResize(e) {
        const deltaX = e.clientX - this.dragStartX;
        const trackElement = this.draggedTask.closest('.task-track');
        
        if (!trackElement) return;
        
        const timePerPixel = this.calculateTimePerPixel(trackElement);
        const timeChange = deltaX * timePerPixel;
        
        let newDuration = this.originalDuration;
        let newStartTime = null;
        
        if (this.resizeType === 'left') {
            const startTimeMinutes = this.timeToMinutes(this.originalStartTime);
            const newStartTimeMinutes = Math.max(0, startTimeMinutes + timeChange);
            newStartTime = this.minutesToTime(newStartTimeMinutes);
            newDuration = Math.max(5, this.originalDuration - timeChange);
        } else {
            newDuration = Math.max(5, this.originalDuration + timeChange);
        }
        
        const taskId = this.draggedTask.dataset.taskId;
        
        // Update both duration and start time if needed
        if (newStartTime) {
            this.core.editorManager.updateTaskInJSON(taskId, null, newStartTime);
        }
        this.core.editorManager.updateTaskDurationInJSON(taskId, Math.round(newDuration));
    }
    
    /**
     * Cleanup drag/resize state
     */
    cleanup() {
        if (this.draggedTask) {
            this.draggedTask.classList.remove('dragging', 'resizing');
            this.draggedTask.style.transform = '';
        }
        
        this.isDragging = false;
        this.dragType = "";
        this.draggedTask = null;
        this.resizeType = null;
        document.body.style.cursor = 'default';
        
        // Remove duration preview
        this.removeDurationPreview();
        
        // Clear drop indicators
        this.clearDropIndicators();
    }
    
    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const editorPanel = document.querySelector('.json-editor-panel');
        const simulationPanel = document.querySelector('.simulation-panel');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        
        if (!editorPanel || !simulationPanel) return;
        
        const isFullscreen = editorPanel.classList.contains('hidden');
        
        editorPanel.classList.toggle('hidden');
        simulationPanel.classList.toggle('fullscreen');
        
        if (fullscreenBtn) {
            fullscreenBtn.textContent = isFullscreen ? '⛶' : '⚏';
            fullscreenBtn.title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
        }
        
        console.log(`UI: Fullscreen ${isFullscreen ? 'disabled' : 'enabled'}`);
    }
    
    /**
     * Open add task dialog
     */
    openAddTaskDialog() {
        // This will be implemented in the dialogs module
        console.log("UI: Opening add task dialog");
    }
    
    /**
     * Open add actor dialog
     */
    openAddActorDialog() {
        // This will be implemented in the dialogs module
        console.log("UI: Opening add actor dialog");
    }
    
    /**
     * Open add resource dialog
     */
    openAddResourceDialog() {
        // This will be implemented in the dialogs module
        console.log("UI: Opening add resource dialog");
    }
    
    /**
     * Open submit dialog
     */
    openSubmitDialog() {
        // This will be implemented in the dialogs module
        console.log("UI: Opening submit dialog");
    }
    
    /**
     * Start tutorial
     */
    startTutorial() {
        if (this.core.tutorialManager) {
            this.core.tutorialManager.start();
        }
    }
    
    /**
     * Exit tutorial
     */
    exitTutorial() {
        if (this.core.tutorialManager) {
            this.core.tutorialManager.exit();
        }
    }
    
    /**
     * Close any open dialogs
     */
    closeDialog() {
        const overlay = document.getElementById("dialog-overlay");
        if (overlay) {
            overlay.style.display = "none";
        }
    }
    
    // Utility methods for drag/drop calculations
    
    findDropTarget(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('actor-lane'));
    }
    
    updateDropIndicator(target) {
        this.clearDropIndicators();
        if (target) {
            target.classList.add('drop-zone');
        }
    }
    
    clearDropIndicators() {
        document.querySelectorAll('.drop-zone').forEach(el => {
            el.classList.remove('drop-zone');
        });
    }
    
    calculateNewTimeFromPosition(clientX, trackElement) {
        // Simplified time calculation - would need proper implementation
        return "08:00";
    }
    
    calculateTimePerPixel(trackElement) {
        // Simplified calculation - would need proper implementation
        return 0.5; // 0.5 minutes per pixel
    }
    
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    createDurationPreview(taskBlock) {
        const preview = document.createElement('div');
        preview.className = 'duration-preview';
        preview.textContent = `${this.originalDuration}min`;
        taskBlock.appendChild(preview);
        this.durationPreview = preview;
    }
    
    updateDurationPreview(duration) {
        if (this.durationPreview) {
            this.durationPreview.textContent = `${duration}min`;
        }
    }
    
    removeDurationPreview() {
        if (this.durationPreview) {
            this.durationPreview.remove();
            this.durationPreview = null;
        }
    }
}