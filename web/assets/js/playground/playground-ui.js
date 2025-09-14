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
    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Map tab names to content IDs correctly
            if (targetTab === 'timeline') {
                document.getElementById('simulation-tab').classList.add('active');
            } else if (targetTab === 'space-editor') {
                document.getElementById('space-editor-tab').classList.add('active');
                // Load current simulation data into space editor when tab is opened
                await syncSpaceEditorState();
            } else if (targetTab === 'digital-space') {
                document.getElementById('digital-space-tab').classList.add('active');
                // Initialize digital space editor when tab is first opened
                await syncDigitalSpaceState();
            } else if (targetTab === 'display-editor') {
                document.getElementById('display-editor-tab').classList.add('active');
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
        // Wait a tick to ensure editor is ready
        await new Promise(resolve => setTimeout(resolve, 10));

        if (!editor) {
            console.warn('Monaco editor not available for space editor sync');
            return;
        }

        const currentJson = JSON.parse(editor.getValue());
        if (currentJson.simulation && currentJson.simulation.layout) {
            spaceEditor.loadLayout(currentJson.simulation.layout, true);
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

        // Wait a tick to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check if simulation data is available before initializing
        if (!editor) {
            console.warn('Monaco editor not available for digital space sync');
            return;
        }

        // Validate that we have valid simulation data
        try {
            const jsonText = editor.getValue();
            if (!jsonText || jsonText.trim() === '') {
                console.warn('No simulation data available yet for digital space');
                return;
            }
            JSON.parse(jsonText); // Test if valid JSON
        } catch (parseError) {
            console.warn('Invalid or incomplete simulation data for digital space:', parseError.message);
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
    } else {
        historyIndex++;
    }

    updateUndoButton();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousValue = history[historyIndex];
        editor.setValue(previousValue);
        updateUndoButton();

        if (autoRender) {
            debounceRender();
        }
        validateJSON();
    }
}

function updateUndoButton() {
    const undoBtn = document.getElementById("undo-btn");
    undoBtn.disabled = historyIndex <= 0;
}

// Auto-render UI
function updateAutoRenderUI() {
    const renderBtn = document.getElementById(
        "render-simulation-btn",
    );
    const toggleBtn = document.getElementById("auto-render-toggle");

    if (autoRender) {
        renderBtn.classList.add("hidden");
        toggleBtn.textContent = "Auto-render: ON";
    } else {
        renderBtn.classList.remove("hidden");
        toggleBtn.textContent = "Auto-render: OFF";
    }
}

// Dialog system
function openDialog(title, content) {
    const overlay = document.getElementById("dialog-overlay");
    const dialogContent = document.getElementById("dialog-content");

    dialogContent.innerHTML = `
        <h3>${title}</h3>
        ${content}
    `;

    overlay.style.display = "flex";
    
    // Attach emoji pickers to any new emoji fields in the dialog
    if (window.emojiPicker) {
        window.emojiPicker.attachToDynamicFields(dialogContent);
    }
}

function closeDialog() {
    const overlay = document.getElementById("dialog-overlay");
    overlay.style.display = "none";
}

// Utility functions
function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function toggleFullscreen() {
    const container = document.querySelector('.playground-container');
    const btn = document.getElementById('fullscreen-btn');
    
    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        btn.textContent = 'Exit Fullscreen';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        btn.textContent = 'Fullscreen';
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

    // Clean up existing event handlers to prevent duplicates
    if (resizeHandlers.verticalHandler && verticalHandle) {
        verticalHandle.removeEventListener("mousedown", resizeHandlers.verticalHandler);
    }
    if (resizeHandlers.metricsHandler && metricsHandle) {
        metricsHandle.removeEventListener("mousedown", resizeHandlers.metricsHandler);
    }
    if (resizeHandlers.horizontalHandler && horizontalHandle) {
        horizontalHandle.removeEventListener("mousedown", resizeHandlers.horizontalHandler);
    }

    let isDragging = false;
    let dragType = "";

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
    }

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        e.preventDefault();

        if (dragType === "vertical-standard") {
            const containerRect =
                playgroundTop.getBoundingClientRect();
            const newWidth =
                ((e.clientX - containerRect.left) /
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
            const containerRect = playgroundTop.getBoundingClientRect();
            
            if (playgroundLeft && metricsPanel) {
                const newWidth =
                    ((e.clientX - containerRect.left) /
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
            }
        } else if (dragType === "horizontal") {
            const mainRect = playgroundMain.getBoundingClientRect();
            const newTopHeight = e.clientY - mainRect.top;

            playgroundTop.style.height = newTopHeight + "px";
            playgroundBottom.style.height =
                mainRect.height - newTopHeight + "px";
        }
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            dragType = "";
            if (dragOverlay) dragOverlay.style.display = 'none';
            document.body.style.cursor = "default";
        }
    });
}

// Notification system
function showNotification(message) {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.playground-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create and show new notification
    const notification = document.createElement('div');
    notification.className = 'playground-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius-md);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 0.9rem;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Left panel tabs setup
function setupLeftPanelTabs() {
    const tabButtons = document.querySelectorAll('[data-left-tab]');
    const tabContents = document.querySelectorAll('.left-tab-content');
    
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
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Activate target button and content
    const targetButton = document.querySelector(`[data-left-tab="${targetTab}"]`);
    const targetContent = document.getElementById(`${targetTab}-tab`);
    
    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');
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
    
    feedbackBtn.addEventListener('click', () => {
        feedbackModal.style.display = 'flex';
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
    
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(feedbackForm);
        const feedbackData = {
            category: formData.get('feedback-category'),
            message: formData.get('feedback-message'),
            email: formData.get('feedback-email'),
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        try {
            // In a real implementation, this would send to a server
            console.log('Feedback submitted:', feedbackData);
            
            showNotification('Thank you for your feedback!');
            feedbackModal.style.display = 'none';
            feedbackForm.reset();
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showNotification('Error submitting feedback. Please try again.');
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
