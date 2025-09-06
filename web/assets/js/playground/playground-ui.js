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
        button.addEventListener('click', () => {
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
                if (spaceEditor) {
                    try {
                        const currentJson = JSON.parse(editor.getValue());
                        // Force zoom to fit when switching to space editor tab
                        spaceEditor.loadLayout(currentJson.simulation.layout, true);
                    } catch(e) {
                    }
                }
            }
        });
    });
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

    let isDragging = false;
    let dragType = "";

    // Standard mode vertical resize handle
    if (verticalHandle) {
        verticalHandle.addEventListener("mousedown", (e) => {
            isDragging = true;
            dragType = "vertical-standard";
            document.body.style.cursor = "col-resize";
            e.preventDefault();
        });
    }

    // Metrics mode vertical resize handle
    if (metricsHandle) {
        metricsHandle.addEventListener("mousedown", (e) => {
            isDragging = true;
            dragType = "vertical-metrics";
            document.body.style.cursor = "col-resize";
            e.preventDefault();
        });
    }

    if (horizontalHandle) {
        horizontalHandle.addEventListener("mousedown", (e) => {
            isDragging = true;
            dragType = "horizontal";
            document.body.style.cursor = "row-resize";
            e.preventDefault();
        });
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
            // Handle metrics mode vertical resize
            const playgroundLeft = document.querySelector(".playground-left");
            const metricsPanel = document.querySelector(".metrics-editor-panel");
            const containerRect = playgroundTop.getBoundingClientRect();
            
            if (playgroundLeft && metricsPanel) {
                const newWidth =
                    ((e.clientX - containerRect.left) /
                        containerRect.width) *
                    100;

                if (newWidth >= 20 && newWidth <= 80) {
                    // Update CSS custom properties for metrics mode layout
                    playgroundLeft.style.flex = `0 0 ${newWidth}%`;
                    metricsPanel.style.flex = `0 0 ${100 - newWidth}%`;
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