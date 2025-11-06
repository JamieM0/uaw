// Playground UI - Tab management, dialogs, and UI utilities
// Universal Automation Wiki - Simulation Playground

// History system for undo functionality
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Tab setup
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initialize ARIA attributes for tabs
    tabButtons.forEach((button, index) => {
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.setAttribute('tabindex', '-1');
        const targetTab = button.dataset.tab;
        if (targetTab) {
            button.setAttribute('aria-controls', `${targetTab}-tab`);
            button.setAttribute('id', `${targetTab}-tab-button`);
        }
    });

    tabContents.forEach(content => {
        content.setAttribute('role', 'tabpanel');
        content.setAttribute('aria-hidden', 'true');
        content.setAttribute('tabindex', '0');
    });

    // Set the first active tab's ARIA attributes correctly
    const activeButton = document.querySelector('.tab-btn.active');
    if (activeButton) {
        activeButton.setAttribute('aria-selected', 'true');
        activeButton.setAttribute('tabindex', '0');
    }

    const activeContent = document.querySelector('.tab-content.active');
    if (activeContent) {
        activeContent.setAttribute('aria-hidden', 'false');
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const targetTab = button.dataset.tab;

            // Update ARIA states
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('tabindex', '-1');
            });
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            button.setAttribute('tabindex', '0');

            tabContents.forEach(content => {
                content.classList.remove('active');
                content.setAttribute('aria-hidden', 'true');
            });

            // Map tab names to content IDs correctly
            if (targetTab === 'timeline') {
                const tab = document.getElementById('simulation-tab');
                if (tab) {
                    tab.classList.add('active');
                    tab.setAttribute('aria-hidden', 'false');
                }
            } else if (targetTab === 'space-editor') {
                const tab = document.getElementById('space-editor-tab');
                if (tab) {
                    tab.classList.add('active');
                    tab.setAttribute('aria-hidden', 'false');
                }
                // Load current simulation data into space editor when tab is opened
                await syncSpaceEditorState();
            } else if (targetTab === 'digital-space') {
                const tab = document.getElementById('digital-space-tab');
                if (tab) {
                    tab.classList.add('active');
                    tab.setAttribute('aria-hidden', 'false');
                }
                // Initialize digital space editor when tab is first opened
                await syncDigitalSpaceState();
            } else if (targetTab === 'display-editor') {
                const tab = document.getElementById('display-editor-tab');
                if (tab) {
                    tab.classList.add('active');
                    tab.setAttribute('aria-hidden', 'false');
                }
                // Initialize display editor when tab is first opened
                await syncDisplayEditorState();
            }
        });
    });
}

// State synchronization helper functions
async function syncSpaceEditorState() {
    if (!spaceEditor) {
        console.warn('Space editor not initialized');
        return;
    }

    try {
        // Check if Monaco editor is properly initialized (not just exists)
        if (!editor || !editor.getValue || typeof editor.getValue !== 'function') {
            console.warn('Monaco editor not properly initialized for space editor sync');
            return;
        }

        // Multiple attempts to ensure editor and simulation data are ready
        let attempts = 0;
        const maxAttempts = 3;
        let validSimulationData = null;

        while (attempts < maxAttempts && !validSimulationData) {
            attempts++;

            // Wait progressively longer for each attempt
            if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, attempts * 100));
            }

            try {
                const jsonText = editor.getValue();
                if (!jsonText || jsonText.trim() === '') {
                    console.warn(`Attempt ${attempts}: No simulation data available yet for space editor`);
                    continue;
                }

                const parsedData = JSON.parse(jsonText);

                // Validate that we have a proper simulation structure
                if (!parsedData.simulation || typeof parsedData.simulation !== 'object') {
                    console.warn(`Attempt ${attempts}: Invalid simulation structure for space editor`);
                    continue;
                }

                validSimulationData = parsedData;
                break;
            } catch (parseError) {
                console.warn(`Attempt ${attempts}: Invalid JSON data for space editor:`, parseError.message);
                continue;
            }
        }

        if (!validSimulationData) {
            console.warn('Failed to get valid simulation data after multiple attempts, deferring space editor initialization');
            return;
        }

        if (validSimulationData.simulation && validSimulationData.simulation.layout) {
            spaceEditor.loadLayout(validSimulationData.simulation.layout, true);
        }
    } catch (error) {
        console.warn('Failed to sync space editor state:', error.message);
    }
}

async function syncDigitalSpaceState() {
    if (!digitalSpaceEditor) {
        console.warn('Digital space editor not initialized');
        return;
    }

    try {
        const digitalCanvas = document.getElementById('digital-space-canvas');
        const digitalPropsPanel = document.getElementById('digital-properties-panel-content');

        if (!digitalCanvas || !digitalPropsPanel) {
            console.warn('Digital space canvas or properties panel not found');
            return;
        }

        // Check if Monaco editor is properly initialized (not just exists)
        if (!editor || !editor.getValue || typeof editor.getValue !== 'function') {
            console.warn('Monaco editor not properly initialized for digital space sync');
            return;
        }

        // Multiple attempts to ensure editor and simulation data are ready
        let attempts = 0;
        const maxAttempts = 3;
        let validSimulationData = null;

        while (attempts < maxAttempts && !validSimulationData) {
            attempts++;

            // Wait progressively longer for each attempt
            if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, attempts * 100));
            }

            try {
                const jsonText = editor.getValue();
                if (!jsonText || jsonText.trim() === '') {
                    console.warn(`Attempt ${attempts}: No simulation data available yet for digital space`);
                    continue;
                }

                const parsedData = JSON.parse(jsonText);

                // Validate that we have a proper simulation structure
                if (!parsedData.simulation || typeof parsedData.simulation !== 'object') {
                    console.warn(`Attempt ${attempts}: Invalid simulation structure for digital space`);
                    continue;
                }

                validSimulationData = parsedData;
                break;
            } catch (parseError) {
                console.warn(`Attempt ${attempts}: Invalid JSON data for digital space:`, parseError.message);
                continue;
            }
        }

        if (!validSimulationData) {
            console.warn('Failed to get valid simulation data after multiple attempts, deferring digital space initialization');
            return;
        }

        if (!digitalSpaceEditor.canvas) {
            digitalSpaceEditor.initialize(digitalCanvas, digitalPropsPanel, editor);
        } else {
            // Refresh data from current simulation
            digitalSpaceEditor.loadFromSimulation();
        }
    } catch (error) {
        console.warn('Failed to sync digital space state:', error.message);
    }
}

async function syncDisplayEditorState() {
    if (!displayEditor) {
        console.warn('Display editor not initialized');
        return;
    }

    try {
        const displayCanvas = document.getElementById('display-canvas');
        const displayPropsPanel = document.getElementById('display-properties-panel-content');

        if (!displayCanvas || !displayPropsPanel) {
            console.warn('Display canvas or properties panel not found');
            return;
        }

        // Wait a tick to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 10));

        if (!displayEditor.canvas) {
            displayEditor.initialize(displayCanvas, displayPropsPanel, editor);
        } else {
            // Refresh data from current simulation
            displayEditor.loadFromSimulation();
            displayEditor.renderActiveDisplay();
        }
    } catch (error) {
        console.warn('Failed to sync display editor state:', error.message);
    }
}

// History management
function saveToHistory() {
    if (!editor || !editor.getValue) {
        console.warn('Editor not available for history save');
        return;
    }

    const currentValue = editor.getValue();
    if (
        history.length > 0 &&
        history[historyIndex] === currentValue
    ) {
        return;
    }

    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(currentValue);

    if (history.length > MAX_HISTORY) {
        history.shift();
    }

    // Always set index to last element after push
    historyIndex = history.length - 1;

    updateUndoButton();
    updateRedoButton();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousValue = history[historyIndex];
        if (editor && editor.setValue) {
            editor.setValue(previousValue);
        }
        updateUndoButton();
        updateRedoButton();

        if (autoRender && typeof debounceRender === 'function') {
            debounceRender();
        }
        if (typeof validateJSON === 'function') {
            validateJSON();
        }
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const nextValue = history[historyIndex];
        if (editor && editor.setValue) {
            editor.setValue(nextValue);
        }
        updateUndoButton();
        updateRedoButton();

        if (autoRender && typeof debounceRender === 'function') {
            debounceRender();
        }
        if (typeof validateJSON === 'function') {
            validateJSON();
        }
    }
}

function updateUndoButton() {
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
        undoBtn.disabled = historyIndex <= 0;
    }
}

function updateRedoButton() {
    const redoBtn = document.getElementById("redo-btn");
    if (redoBtn) {
        redoBtn.disabled = historyIndex >= history.length - 1;
    }
}

// Auto-render UI
function updateAutoRenderUI() {
    const renderBtn = document.getElementById(
        "render-simulation-btn",
    );
    const toggleBtn = document.getElementById("auto-render-toggle");

    if (!renderBtn || !toggleBtn) {
        console.warn('Auto-render UI elements not found');
        return;
    }

    if (autoRender) {
        renderBtn.classList.add("hidden");
        toggleBtn.textContent = "Auto-render: ON";
        toggleBtn.setAttribute('aria-pressed', 'true');
    } else {
        renderBtn.classList.remove("hidden");
        toggleBtn.textContent = "Auto-render: OFF";
        toggleBtn.setAttribute('aria-pressed', 'false');
    }
}

// Dialog system
function openDialog(title, content) {
    const overlay = document.getElementById("dialog-overlay");
    const dialogContent = document.getElementById("dialog-content");

    if (!overlay || !dialogContent) {
        console.error('Dialog elements not found');
        return;
    }

    // Set ARIA attributes for accessibility
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'dialog-title');

    dialogContent.innerHTML = `
        <h3 id="dialog-title">${title}</h3>
        ${content}
    `;

    overlay.style.display = "flex";

    // Focus trap: focus the first focusable element in dialog
    setTimeout(() => {
        const focusableElements = dialogContent.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }, 100);

    // Attach emoji pickers to any new emoji fields in the dialog
    if (window.emojiPicker) {
        window.emojiPicker.attachToDynamicFields(dialogContent);
    }
}

function closeDialog() {
    const overlay = document.getElementById("dialog-overlay");
    if (!overlay) {
        console.error('Dialog overlay not found');
        return;
    }
    overlay.style.display = "none";
}

// Utility functions
function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function setupFullscreenButton() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen simulation view');
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
}

function toggleFullscreen() {
    const jsonEditorPanel = document.querySelector('.json-editor-panel');
    const simulationPanel = document.querySelector('.simulation-panel');
    const btn = document.getElementById('fullscreen-btn');

    if (!jsonEditorPanel || !simulationPanel || !btn) {
        console.error('Required elements not found for fullscreen toggle');
        return;
    }

    // Check if we're currently in fullscreen mode
    const isFullscreen = jsonEditorPanel.classList.contains('hidden');

    if (!isFullscreen) {
        // Enter fullscreen: hide Monaco Editor, expand right panel
        jsonEditorPanel.classList.add('hidden');
        simulationPanel.classList.add('fullscreen');
        btn.textContent = '⛶';
        btn.title = 'Exit fullscreen simulation view';
        btn.setAttribute('aria-label', 'Exit fullscreen simulation view');
        btn.setAttribute('aria-pressed', 'true');
    } else {
        // Exit fullscreen: show Monaco Editor, restore normal layout
        jsonEditorPanel.classList.remove('hidden');
        simulationPanel.classList.remove('fullscreen');
        btn.textContent = '⛶';
        btn.title = 'Toggle fullscreen simulation view';
        btn.setAttribute('aria-label', 'Toggle fullscreen simulation view');
        btn.setAttribute('aria-pressed', 'false');
    }
}

// Store references to event handlers for cleanup
let resizeHandlers = {
    verticalHandler: null,
    metricsHandler: null,
    horizontalHandler: null,
    mouseMoveHandler: null,
    mouseUpHandler: null
};

// Resize handles initialization
function initializeResizeHandles() {
    const verticalHandle = document.querySelector(
        ".resize-handle-vertical:not(.metrics-resize)",
    );
    const metricsHandle = document.querySelector(
        ".resize-handle-vertical.metrics-resize",
    );
    const horizontalHandle = document.querySelector(
        ".resize-handle-horizontal",
    );
    const jsonPanel = document.querySelector(".json-editor-panel");
    const simulationPanel =
        document.querySelector(".simulation-panel");
    const playgroundTop = document.querySelector(".playground-top");
    const playgroundBottom =
        document.querySelector(".playground-bottom");
    const playgroundMain =
        document.querySelector(".playground-main");
    const dragOverlay = document.getElementById('drag-overlay');

    // Clean up existing event handlers to prevent duplicates and memory leaks
    if (resizeHandlers.verticalHandler && verticalHandle) {
        verticalHandle.removeEventListener("mousedown", resizeHandlers.verticalHandler);
        verticalHandle.removeEventListener("touchstart", resizeHandlers.verticalHandler);
    }
    if (resizeHandlers.metricsHandler && metricsHandle) {
        metricsHandle.removeEventListener("mousedown", resizeHandlers.metricsHandler);
        metricsHandle.removeEventListener("touchstart", resizeHandlers.metricsHandler);
    }
    if (resizeHandlers.horizontalHandler && horizontalHandle) {
        horizontalHandle.removeEventListener("mousedown", resizeHandlers.horizontalHandler);
        horizontalHandle.removeEventListener("touchstart", resizeHandlers.horizontalHandler);
    }
    if (resizeHandlers.mouseMoveHandler) {
        document.removeEventListener("mousemove", resizeHandlers.mouseMoveHandler);
        document.removeEventListener("touchmove", resizeHandlers.mouseMoveHandler);
    }
    if (resizeHandlers.mouseUpHandler) {
        document.removeEventListener("mouseup", resizeHandlers.mouseUpHandler);
        document.removeEventListener("touchend", resizeHandlers.mouseUpHandler);
    }

    let isDragging = false;
    let dragType = "";

    // Helper to get client position from mouse or touch event
    const getClientPosition = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    };

    // Add ARIA attributes to resize handles
    if (verticalHandle) {
        verticalHandle.setAttribute('role', 'separator');
        verticalHandle.setAttribute('aria-label', 'Resize editor and simulation panels');
        verticalHandle.setAttribute('aria-orientation', 'vertical');
    }
    if (metricsHandle) {
        metricsHandle.setAttribute('role', 'separator');
        metricsHandle.setAttribute('aria-label', 'Resize metrics editor panel');
        metricsHandle.setAttribute('aria-orientation', 'vertical');
    }
    if (horizontalHandle) {
        horizontalHandle.setAttribute('role', 'separator');
        horizontalHandle.setAttribute('aria-label', 'Resize top and bottom panels');
        horizontalHandle.setAttribute('aria-orientation', 'horizontal');
    }

    // Standard mode vertical resize handle
    if (verticalHandle) {
        resizeHandlers.verticalHandler = (e) => {
            isDragging = true;
            dragType = "vertical-standard";
            if (dragOverlay) dragOverlay.style.display = 'block';
            document.body.style.cursor = "col-resize";
            e.preventDefault();
        };
        verticalHandle.addEventListener("mousedown", resizeHandlers.verticalHandler);
        verticalHandle.addEventListener("touchstart", resizeHandlers.verticalHandler);
    }

    // Metrics mode vertical resize handle
    if (metricsHandle) {
        resizeHandlers.metricsHandler = (e) => {
            isDragging = true;
            dragType = "vertical-metrics";
            if (dragOverlay) dragOverlay.style.display = 'block';
            document.body.style.cursor = "col-resize";
            e.preventDefault();
        };
        metricsHandle.addEventListener("mousedown", resizeHandlers.metricsHandler);
        metricsHandle.addEventListener("touchstart", resizeHandlers.metricsHandler);
    }

    if (horizontalHandle) {
        resizeHandlers.horizontalHandler = (e) => {
            isDragging = true;
            dragType = "horizontal";
            if (dragOverlay) dragOverlay.style.display = 'block';
            document.body.style.cursor = "row-resize";
            e.preventDefault();
        };
        horizontalHandle.addEventListener("mousedown", resizeHandlers.horizontalHandler);
        horizontalHandle.addEventListener("touchstart", resizeHandlers.horizontalHandler);
    }

    // Store mousemove handler for proper cleanup
    resizeHandlers.mouseMoveHandler = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const pos = getClientPosition(e);

        if (dragType === "vertical-standard") {
            if (!playgroundTop || !jsonPanel || !simulationPanel) return;
            const containerRect = playgroundTop.getBoundingClientRect();
            const newWidth =
                ((pos.clientX - containerRect.left) /
                    containerRect.width) *
                100;

            if (newWidth >= 20 && newWidth <= 80) {
                jsonPanel.style.width = newWidth + "%";
                simulationPanel.style.width = 100 - newWidth + "%";
            }
        } else if (dragType === "vertical-metrics") {
            // Handle metrics mode vertical resize - simplified approach like the old version
            const playgroundLeft = document.querySelector(".playground-left");
            const metricsPanel = document.querySelector(".metrics-editor-panel");
            if (!playgroundTop || !playgroundLeft || !metricsPanel) return;
            const containerRect = playgroundTop.getBoundingClientRect();

            const newWidth =
                ((pos.clientX - containerRect.left) /
                    containerRect.width) *
                100;

            // Allow wider range for metrics editor
            if (newWidth >= 20 && newWidth <= 80) {
                // Use setProperty with !important to override CSS
                playgroundLeft.style.setProperty('width', `${newWidth}%`, 'important');
                metricsPanel.style.setProperty('width', `${100 - newWidth}%`, 'important');

                // Force layout recalculation
                playgroundLeft.offsetWidth; // Force reflow
                metricsPanel.offsetWidth;   // Force reflow

                // Force Monaco editor layout recalculation during resize
                if (window.metricsJsonEditor) {
                    // Use requestAnimationFrame to ensure DOM has updated
                    requestAnimationFrame(() => {
                        window.metricsJsonEditor.layout();
                    });
                }
            }
        } else if (dragType === "horizontal") {
            if (!playgroundMain || !playgroundTop || !playgroundBottom) return;
            const mainRect = playgroundMain.getBoundingClientRect();
            const newTopHeight = pos.clientY - mainRect.top;

            playgroundTop.style.height = newTopHeight + "px";
            playgroundBottom.style.height =
                mainRect.height - newTopHeight + "px";
        }
    };

    // Store mouseup handler for proper cleanup
    resizeHandlers.mouseUpHandler = () => {
        if (isDragging) {
            isDragging = false;
            dragType = "";
            if (dragOverlay) dragOverlay.style.display = 'none';
            document.body.style.cursor = "default";
        }
    };

    document.addEventListener("mousemove", resizeHandlers.mouseMoveHandler);
    document.addEventListener("touchmove", resizeHandlers.mouseMoveHandler);
    document.addEventListener("mouseup", resizeHandlers.mouseUpHandler);
    document.addEventListener("touchend", resizeHandlers.mouseUpHandler);
}

// Notification system
function showNotification(message, type = 'success', duration = 3000) {
    if (!message || typeof message !== 'string') {
        console.error('Invalid notification message');
        return;
    }

    // Remove any existing notifications
    const existingNotification = document.querySelector('.playground-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Determine background color based on type
    const colorMap = {
        'success': 'var(--success-color, #28a745)',
        'error': 'var(--error-color, #dc3545)',
        'warning': 'var(--warning-color, #ffc107)',
        'info': 'var(--info-color, #17a2b8)'
    };
    const backgroundColor = colorMap[type] || colorMap.success;
    const textColor = type === 'warning' ? '#000' : 'white';

    // Create and show new notification
    const notification = document.createElement('div');
    notification.className = 'playground-notification';
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: ${textColor};
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius-md, 4px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 0.9rem;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    messageSpan.style.flex = '1';
    notification.appendChild(messageSpan);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: ${textColor};
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        margin-left: 0.5rem;
        line-height: 1;
    `;
    closeBtn.addEventListener('click', () => {
        dismissNotification(notification);
    });
    notification.appendChild(closeBtn);

    try {
        document.body.appendChild(notification);
    } catch (error) {
        console.error('Failed to show notification:', error);
        return;
    }

    // Auto-remove after specified duration
    if (duration > 0) {
        setTimeout(() => {
            dismissNotification(notification);
        }, duration);
    }
}

function dismissNotification(notification) {
    if (!notification || !notification.parentNode) {
        return;
    }

    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 300);
}

// Left panel tabs setup
function setupLeftPanelTabs() {
    const tabButtons = document.querySelectorAll('[data-left-tab]');
    const tabContents = document.querySelectorAll('.left-tab-content');

    // Initialize ARIA attributes for left panel tabs
    tabButtons.forEach(button => {
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.setAttribute('tabindex', '-1');
        const targetTab = button.dataset.leftTab;
        if (targetTab) {
            button.setAttribute('aria-controls', `${targetTab}-tab`);
        }
    });

    tabContents.forEach(content => {
        content.setAttribute('role', 'tabpanel');
        content.setAttribute('aria-hidden', 'true');
    });

    // Set the first active left tab's ARIA attributes correctly
    const activeButton = document.querySelector('[data-left-tab].active');
    if (activeButton) {
        activeButton.setAttribute('aria-selected', 'true');
        activeButton.setAttribute('tabindex', '0');
    }

    const activeContent = document.querySelector('.left-tab-content.active');
    if (activeContent) {
        activeContent.setAttribute('aria-hidden', 'false');
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.leftTab;
            switchLeftTab(targetTab);
        });
    });
}

function switchLeftTab(targetTab) {
    // Update button states
    const tabButtons = document.querySelectorAll('[data-left-tab]');
    const tabContents = document.querySelectorAll('.left-tab-content');

    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
    });
    tabContents.forEach(content => {
        content.classList.remove('active');
        content.setAttribute('aria-hidden', 'true');
    });

    // Activate target button and content
    const targetButton = document.querySelector(`[data-left-tab="${targetTab}"]`);
    const targetContent = document.getElementById(`${targetTab}-tab`);

    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetButton.setAttribute('aria-selected', 'true');
        targetButton.setAttribute('tabindex', '0');
        targetContent.classList.add('active');
        targetContent.setAttribute('aria-hidden', 'false');
    }
}

// Feedback modal
function initializeFeedbackModal() {
    const feedbackBtn = document.getElementById('feedback-btn');
    const feedbackModal = document.getElementById('feedback-modal');
    const closeFeedbackModal = document.getElementById('close-feedback-modal');
    const feedbackForm = document.getElementById('feedback-form');

    if (!feedbackBtn || !feedbackModal || !closeFeedbackModal || !feedbackForm) {
        console.warn('Feedback modal elements not found');
        return;
    }

    // Set ARIA attributes
    feedbackModal.setAttribute('role', 'dialog');
    feedbackModal.setAttribute('aria-modal', 'true');
    feedbackModal.setAttribute('aria-labelledby', 'feedback-modal-title');
    feedbackBtn.setAttribute('aria-label', 'Open feedback modal');
    closeFeedbackModal.setAttribute('aria-label', 'Close feedback modal');

    feedbackBtn.addEventListener('click', () => {
        feedbackModal.style.display = 'flex';
        // Focus the first input
        setTimeout(() => {
            const firstInput = feedbackForm.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    });

    closeFeedbackModal.addEventListener('click', () => {
        feedbackModal.style.display = 'none';
    });

    // Close modal when clicking outside content
    feedbackModal.addEventListener('click', (e) => {
        if (e.target === feedbackModal) {
            feedbackModal.style.display = 'none';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && feedbackModal.style.display === 'flex') {
            feedbackModal.style.display = 'none';
        }
    });

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(feedbackForm);
            const feedbackData = {
                category: formData.get('feedback-category'),
                message: formData.get('feedback-message'),
                email: formData.get('feedback-email'),
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            // Validate required fields
            if (!feedbackData.message || feedbackData.message.trim() === '') {
                showNotification('Please enter a feedback message', 'warning');
                return;
            }

            // In a real implementation, this would send to a server
            console.log('Feedback submitted:', feedbackData);

            showNotification('Thank you for your feedback!', 'success');
            feedbackModal.style.display = 'none';
            feedbackForm.reset();

        } catch (error) {
            console.error('Error submitting feedback:', error);
            showNotification('Error submitting feedback. Please try again.', 'error');
        }
    });
}

// Add CSS for notifications if not already present
function addNotificationStyles() {
    if (document.querySelector('#notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize notification styles when module loads
addNotificationStyles();

// Reset panel sizes functionality
function resetPanelSizes() {
    try {
        // Get the main panel elements
        const playgroundTop = document.querySelector('.playground-top');
        const playgroundBottom = document.querySelector('.playground-bottom');
        const jsonEditorPanel = document.querySelector('.json-editor-panel');
        const simulationPanel = document.querySelector('.simulation-panel');

        if (!playgroundTop) {
            console.error('Required playground elements not found');
            showNotification('Failed to reset panel sizes: elements not found', 'error');
            return;
        }

        // Check if we're in metrics mode
        const isMetricsMode = playgroundTop.classList.contains('metrics-mode');

        if (isMetricsMode) {
            // Metrics mode: Reset left panel (40%) and metrics panel (60%)
            const playgroundLeft = document.querySelector('.playground-left');
            const metricsPanel = document.querySelector('.metrics-editor-panel');

            if (playgroundLeft && metricsPanel) {
                // Remove inline styles to restore CSS defaults
                playgroundLeft.style.removeProperty('width');
                metricsPanel.style.removeProperty('width');
            } else {
                console.warn('Metrics mode panels not found');
            }
        } else {
            // Standard mode: Reset JSON editor (40%) and simulation panel (60%)
            if (jsonEditorPanel && simulationPanel) {
                // Remove inline styles to restore CSS defaults
                jsonEditorPanel.style.removeProperty('width');
                simulationPanel.style.removeProperty('width');
            } else {
                console.warn('Standard mode panels not found');
            }
        }

        // Reset vertical panels: playground-top (70%) and playground-bottom (30%)
        if (playgroundTop && playgroundBottom) {
            // Remove inline styles to restore CSS defaults
            playgroundTop.style.removeProperty('height');
            playgroundBottom.style.removeProperty('height');
        }

        // Force Monaco editors to recalculate their layout after panel resize
        if (editor && typeof editor.layout === 'function') {
            setTimeout(() => {
                try {
                    editor.layout();
                } catch (error) {
                    console.error('Failed to layout editor:', error);
                }
            }, 100);
        }

        if (window.metricsJsonEditor && typeof window.metricsJsonEditor.layout === 'function') {
            setTimeout(() => {
                try {
                    window.metricsJsonEditor.layout();
                } catch (error) {
                    console.error('Failed to layout metrics editor:', error);
                }
            }, 100);
        }

        console.log('Panel sizes reset successfully');
        showNotification('Panel sizes have been reset to defaults', 'success');
    } catch (error) {
        console.error('Error resetting panel sizes:', error);
        showNotification('Failed to reset panel sizes', 'error');
    }
}

// Setup reset panel sizes button
function setupResetPanelSizes() {
    const resetBtn = document.getElementById('reset-panel-sizes-btn');
    if (resetBtn) {
        resetBtn.setAttribute('aria-label', 'Reset panel sizes to defaults');
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetPanelSizes();
        });
    } else {
        console.warn('Reset panel sizes button not found');
    }
}
