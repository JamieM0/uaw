// Playground UI - Tab management, dialogs, and UI utilities
// Universal Automation Wiki - Simulation Playground

// History system for undo functionality
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let dropdownControllerInitialized = false;
let dropdownMutationObserver = null;

function closeAllPlaygroundDropdowns(exceptDropdown = null) {
    document.querySelectorAll('.dropdown.open').forEach(dropdown => {
        if (exceptDropdown && dropdown === exceptDropdown) return;
        dropdown.classList.remove('open');
        const toggle = dropdown.querySelector('button, .dropdown-toggle');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
}

function initializeDropdownAria(root = document) {
    root.querySelectorAll('.dropdown').forEach((dropdown, index) => {
        const toggle = dropdown.querySelector('button, .dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-content');
        if (!toggle || !menu) return;

        if (!menu.id) {
            menu.id = `playground-dropdown-menu-${index + 1}`;
        }
        toggle.setAttribute('aria-haspopup', 'menu');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', menu.id);

        menu.querySelectorAll('button, a, [role="menuitem"]').forEach(item => {
            item.setAttribute('role', 'menuitem');
            if (!item.hasAttribute('tabindex')) {
                item.setAttribute('tabindex', '-1');
            }
        });
    });
}

function setupAccessibleDropdowns() {
    initializeDropdownAria();
    if (dropdownControllerInitialized) return;
    dropdownControllerInitialized = true;

    const focusMenuItem = (dropdown, nextIndex) => {
        const menu = dropdown?.querySelector('.dropdown-content');
        if (!menu) return;
        const items = Array.from(menu.querySelectorAll('button, a, [role="menuitem"]'))
            .filter(item => !item.disabled);
        if (items.length === 0) return;
        const safeIndex = Math.max(0, Math.min(nextIndex, items.length - 1));
        items.forEach(item => item.setAttribute('tabindex', '-1'));
        items[safeIndex].setAttribute('tabindex', '0');
        items[safeIndex].focus();
    };

    const openDropdown = (dropdown, focusFirst = false) => {
        const toggle = dropdown?.querySelector('button, .dropdown-toggle');
        if (!dropdown || !toggle) return;
        closeAllPlaygroundDropdowns(dropdown);
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        if (focusFirst) {
            focusMenuItem(dropdown, 0);
        }
    };

    const closeDropdown = (dropdown, focusToggle = false) => {
        const toggle = dropdown?.querySelector('button, .dropdown-toggle');
        if (!dropdown || !toggle) return;
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (focusToggle) toggle.focus();
    };

    document.addEventListener('click', (event) => {
        const toggle = event.target.closest('.dropdown > button, .dropdown > .dropdown-toggle');
        if (toggle) {
            event.preventDefault();
            const dropdown = toggle.closest('.dropdown');
            if (!dropdown) return;
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                closeDropdown(dropdown);
            } else {
                openDropdown(dropdown);
            }
            return;
        }

        const menuItem = event.target.closest('.dropdown-content button, .dropdown-content a');
        if (menuItem) {
            closeAllPlaygroundDropdowns();
            return;
        }

        if (!event.target.closest('.dropdown')) {
            closeAllPlaygroundDropdowns();
        }
    });

    document.addEventListener('keydown', (event) => {
        const focusedToggle = document.activeElement?.closest('.dropdown > button, .dropdown > .dropdown-toggle');
        const focusedMenuItem = document.activeElement?.closest('.dropdown-content button, .dropdown-content a, .dropdown-content [role="menuitem"]');

        if (event.key === 'Escape') {
            const openDropdown = document.querySelector('.dropdown.open');
            if (openDropdown) {
                event.preventDefault();
                closeDropdown(openDropdown, true);
            }
            return;
        }

        if (focusedToggle && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            const dropdown = focusedToggle.closest('.dropdown');
            if (!dropdown) return;
            openDropdown(dropdown, true);
            return;
        }

        if (!focusedMenuItem) return;
        const dropdown = focusedMenuItem.closest('.dropdown');
        if (!dropdown) return;

        const menuItems = Array.from(dropdown.querySelectorAll('.dropdown-content button, .dropdown-content a, .dropdown-content [role="menuitem"]'))
            .filter(item => !item.disabled);
        const currentIndex = menuItems.indexOf(focusedMenuItem);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = currentIndex >= menuItems.length - 1 ? 0 : currentIndex + 1;
            focusMenuItem(dropdown, nextIndex);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
            focusMenuItem(dropdown, nextIndex);
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusMenuItem(dropdown, 0);
        } else if (event.key === 'End') {
            event.preventDefault();
            focusMenuItem(dropdown, menuItems.length - 1);
        } else if (event.key === 'Tab') {
            closeDropdown(dropdown);
        }
    });

    dropdownMutationObserver = new MutationObserver(() => {
        initializeDropdownAria();
    });
    dropdownMutationObserver.observe(document.body, { childList: true, subtree: true });
}

window.closeAllPlaygroundDropdowns = closeAllPlaygroundDropdowns;

function setupHorizontalTabKeyboardNavigation(buttons, activateFn) {
    const buttonList = Array.from(buttons);
    buttonList.forEach((button, index) => {
        button.addEventListener('keydown', (event) => {
            let targetIndex = index;
            if (event.key === 'ArrowRight') {
                targetIndex = (index + 1) % buttonList.length;
            } else if (event.key === 'ArrowLeft') {
                targetIndex = (index - 1 + buttonList.length) % buttonList.length;
            } else if (event.key === 'Home') {
                targetIndex = 0;
            } else if (event.key === 'End') {
                targetIndex = buttonList.length - 1;
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateFn(button);
                return;
            } else {
                return;
            }

            event.preventDefault();
            buttonList[targetIndex].focus();
            activateFn(buttonList[targetIndex]);
        });
    });
}

// Tab setup
function setupTabs() {
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
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

    const activateTab = async (button) => {
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
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            await activateTab(button);
        });
    });
    setupHorizontalTabKeyboardNavigation(tabButtons, activateTab);
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

        if (validSimulationData.simulation) {
            const layout = validSimulationData.simulation.world?.layout || validSimulationData.simulation.layout;
            if (layout) {
                spaceEditor.loadLayout(layout, true);
            }
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

        // Check if Monaco editor is properly initialized
        if (!editor || !editor.getValue || typeof editor.getValue !== 'function') {
            console.warn('Monaco editor not properly initialized for digital space sync');
            return;
        }

        // Wait a moment to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 10));

        // Initialize or refresh the editor
        if (!digitalSpaceEditor.canvas) {
            digitalSpaceEditor.initialize(digitalCanvas, digitalPropsPanel, editor);
        } else {
            // Force refresh data from current simulation to clear any stale data
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

        // Check if Monaco editor is properly initialized
        if (!editor || !editor.getValue || typeof editor.getValue !== 'function') {
            console.warn('Monaco editor not properly initialized for display editor sync');
            return;
        }

        // Wait a moment to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 10));

        // Initialize or refresh the editor
        if (!displayEditor.canvas) {
            displayEditor.initialize(displayCanvas, displayPropsPanel, editor);
        } else {
            // Force refresh data from current simulation to clear any stale data
            displayEditor.loadFromSimulation();
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
    verticalKeyHandler: null,
    metricsKeyHandler: null,
    horizontalKeyHandler: null,
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

    // MEMORY LEAK FIX: Ensure resizeHandlers is initialized before use
    if (!resizeHandlers) {
        resizeHandlers = {
            verticalHandler: null,
            metricsHandler: null,
            horizontalHandler: null,
            verticalKeyHandler: null,
            metricsKeyHandler: null,
            horizontalKeyHandler: null,
            mouseMoveHandler: null,
            mouseUpHandler: null
        };
    }

    // MEMORY LEAK FIX: Aggressive cleanup - remove ALL old document-level listeners
    // This prevents accumulation even if resizeHandlers object is in inconsistent state
    const oldHandlers = resizeHandlers || {};
    if (oldHandlers.verticalHandler) {
        document.removeEventListener("mousemove", oldHandlers.verticalHandler);
        document.removeEventListener("touchmove", oldHandlers.verticalHandler);
        document.removeEventListener("mouseup", oldHandlers.verticalHandler);
        document.removeEventListener("touchend", oldHandlers.verticalHandler);
    }
    if (oldHandlers.mouseMoveHandler) {
        document.removeEventListener("mousemove", oldHandlers.mouseMoveHandler);
        document.removeEventListener("touchmove", oldHandlers.mouseMoveHandler);
    }
    if (oldHandlers.mouseUpHandler) {
        document.removeEventListener("mouseup", oldHandlers.mouseUpHandler);
        document.removeEventListener("touchend", oldHandlers.mouseUpHandler);
    }

    // Clean up handle-specific listeners
    if (verticalHandle && oldHandlers.verticalHandler) {
        verticalHandle.removeEventListener("mousedown", oldHandlers.verticalHandler);
        verticalHandle.removeEventListener("touchstart", oldHandlers.verticalHandler);
    }
    if (verticalHandle && oldHandlers.verticalKeyHandler) {
        verticalHandle.removeEventListener("keydown", oldHandlers.verticalKeyHandler);
    }
    if (metricsHandle && oldHandlers.metricsHandler) {
        metricsHandle.removeEventListener("mousedown", oldHandlers.metricsHandler);
        metricsHandle.removeEventListener("touchstart", oldHandlers.metricsHandler);
    }
    if (metricsHandle && oldHandlers.metricsKeyHandler) {
        metricsHandle.removeEventListener("keydown", oldHandlers.metricsKeyHandler);
    }
    if (horizontalHandle && oldHandlers.horizontalHandler) {
        horizontalHandle.removeEventListener("mousedown", oldHandlers.horizontalHandler);
        horizontalHandle.removeEventListener("touchstart", oldHandlers.horizontalHandler);
    }
    if (horizontalHandle && oldHandlers.horizontalKeyHandler) {
        horizontalHandle.removeEventListener("keydown", oldHandlers.horizontalKeyHandler);
    }

    // Reset handlers object to clean state
    resizeHandlers = {
        verticalHandler: null,
        metricsHandler: null,
        horizontalHandler: null,
        verticalKeyHandler: null,
        metricsKeyHandler: null,
        horizontalKeyHandler: null,
        mouseMoveHandler: null,
        mouseUpHandler: null
    };

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
        verticalHandle.setAttribute('tabindex', '0');
    }
    if (metricsHandle) {
        metricsHandle.setAttribute('role', 'separator');
        metricsHandle.setAttribute('aria-label', 'Resize metrics editor panel');
        metricsHandle.setAttribute('aria-orientation', 'vertical');
        metricsHandle.setAttribute('tabindex', '0');
    }
    if (horizontalHandle) {
        horizontalHandle.setAttribute('role', 'separator');
        horizontalHandle.setAttribute('aria-label', 'Resize top and bottom panels');
        horizontalHandle.setAttribute('aria-orientation', 'horizontal');
        horizontalHandle.setAttribute('tabindex', '0');
    }

    const applyStandardVerticalResize = (deltaPercent) => {
        if (!playgroundTop || !jsonPanel || !simulationPanel) return;
        const containerRect = playgroundTop.getBoundingClientRect();
        const currentWidth = (jsonPanel.getBoundingClientRect().width / containerRect.width) * 100;
        const newWidth = Math.min(80, Math.max(20, currentWidth + deltaPercent));
        jsonPanel.style.width = `${newWidth}%`;
        simulationPanel.style.width = `${100 - newWidth}%`;
    };

    const applyMetricsVerticalResize = (deltaPercent) => {
        const playgroundLeft = document.querySelector(".playground-left");
        const metricsPanel = document.querySelector(".metrics-editor-panel");
        if (!playgroundTop || !playgroundLeft || !metricsPanel) return;
        const containerRect = playgroundTop.getBoundingClientRect();
        const currentWidth = (playgroundLeft.getBoundingClientRect().width / containerRect.width) * 100;
        const newWidth = Math.min(80, Math.max(20, currentWidth + deltaPercent));
        playgroundLeft.style.setProperty('width', `${newWidth}%`, 'important');
        metricsPanel.style.setProperty('width', `${100 - newWidth}%`, 'important');
        if (window.metricsJsonEditor) {
            requestAnimationFrame(() => window.metricsJsonEditor.layout());
        }
    };

    const applyHorizontalResize = (deltaPixels) => {
        if (!playgroundMain || !playgroundTop || !playgroundBottom) return;
        const mainRect = playgroundMain.getBoundingClientRect();
        const currentTopHeight = playgroundTop.getBoundingClientRect().height;
        const minHeight = Math.max(180, mainRect.height * 0.2);
        const maxHeight = Math.max(minHeight + 1, mainRect.height * 0.8);
        const newTopHeight = Math.min(maxHeight, Math.max(minHeight, currentTopHeight + deltaPixels));
        playgroundTop.style.height = `${newTopHeight}px`;
        playgroundBottom.style.height = `${mainRect.height - newTopHeight}px`;
    };

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
        resizeHandlers.verticalKeyHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                applyStandardVerticalResize(-5);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                applyStandardVerticalResize(5);
            }
        };
        verticalHandle.addEventListener("keydown", resizeHandlers.verticalKeyHandler);
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
        resizeHandlers.metricsKeyHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                applyMetricsVerticalResize(-5);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                applyMetricsVerticalResize(5);
            }
        };
        metricsHandle.addEventListener("keydown", resizeHandlers.metricsKeyHandler);
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
        resizeHandlers.horizontalKeyHandler = (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                applyHorizontalResize(-24);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                applyHorizontalResize(24);
            }
        };
        horizontalHandle.addEventListener("keydown", resizeHandlers.horizontalKeyHandler);
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

function buildDefaultWorkspecDocument() {
    return {
        simulation: {
            schema_version: "2.0",
            meta: {
                title: "New Simulation",
                description: "",
                domain: "generic"
            },
            world: {
                objects: [],
                layout: {
                    locations: []
                }
            },
            process: {
                tasks: []
            }
        }
    };
}

function setupToolsMenuActions() {
    const formatBtn = document.getElementById('format-json-btn');
    const clearBtn = document.getElementById('clear-editor-btn');
    const jsonStatus = document.getElementById('json-status');

    if (formatBtn && !formatBtn.dataset.listenerAttached) {
        formatBtn.dataset.listenerAttached = 'true';
        formatBtn.addEventListener('click', () => {
            if (!editor || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') {
                showNotification('Editor is not ready yet', 'warning');
                return;
            }
            try {
                const jsonText = editor.getValue();
                const parsed = JSON.parse(typeof stripJsonComments === 'function' ? stripJsonComments(jsonText) : jsonText);
                editor.setValue(JSON.stringify(parsed, null, 2));
                if (typeof validateJSON === 'function') validateJSON();
                showNotification('JSON formatted');
            } catch (error) {
                showNotification(`Cannot format invalid JSON: ${error.message}`, 'error');
            }
        });
    }

    if (clearBtn && !clearBtn.dataset.listenerAttached) {
        clearBtn.dataset.listenerAttached = 'true';
        clearBtn.addEventListener('click', () => {
            if (!editor || typeof editor.setValue !== 'function') {
                showNotification('Editor is not ready yet', 'warning');
                return;
            }
            const shouldClear = window.confirm('Replace the current content with a new empty WorkSpec document?');
            if (!shouldClear) return;
            editor.setValue(JSON.stringify(buildDefaultWorkspecDocument(), null, 2));
            if (typeof renderSimulation === 'function' && typeof autoRender !== 'undefined' && autoRender) {
                renderSimulation();
            }
            if (typeof validateJSON === 'function') validateJSON();
            showNotification('Editor reset to a new WorkSpec document');
        });
    }

    if (jsonStatus && !jsonStatus.dataset.listenerAttached) {
        jsonStatus.dataset.listenerAttached = 'true';
        jsonStatus.style.cursor = 'pointer';
        jsonStatus.addEventListener('click', () => {
            const validationFilter = document.getElementById('validation-filter');
            if (!validationFilter) return;
            validationFilter.value = 'errors';
            if (typeof applyValidationFilter === 'function') applyValidationFilter();
            const validationPanel = document.querySelector('.playground-bottom');
            if (validationPanel) {
                validationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

const modalReturnFocusMap = new WeakMap();
let modalAccessibilityInitialized = false;
let modalObserver = null;

function getVisibleDialogOverlays() {
    return Array.from(document.querySelectorAll('.dialog-overlay')).filter((overlay) => {
        const computed = window.getComputedStyle(overlay);
        return computed.display !== 'none' && computed.visibility !== 'hidden';
    });
}

function getTopDialogOverlay() {
    const overlays = getVisibleDialogOverlays();
    return overlays.length > 0 ? overlays[overlays.length - 1] : null;
}

function getFocusableElements(container) {
    return Array.from(
        container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => element.offsetParent !== null);
}

function closeDialogOverlay(overlay) {
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    const returnFocusTarget = modalReturnFocusMap.get(overlay);
    if (returnFocusTarget && document.contains(returnFocusTarget)) {
        returnFocusTarget.focus();
    }
}

function setupModalAccessibility() {
    if (modalAccessibilityInitialized) return;
    modalAccessibilityInitialized = true;

    modalObserver = new MutationObserver(() => {
        getVisibleDialogOverlays().forEach((overlay) => {
            if (!modalReturnFocusMap.has(overlay)) {
                const activeElement = document.activeElement;
                if (activeElement && !overlay.contains(activeElement)) {
                    modalReturnFocusMap.set(overlay, activeElement);
                } else {
                    modalReturnFocusMap.set(overlay, null);
                }
            }
            overlay.setAttribute('aria-hidden', 'false');
            const focusables = getFocusableElements(overlay);
            if (focusables.length > 0 && !overlay.contains(document.activeElement)) {
                focusables[0].focus();
            }
        });
    });
    modalObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style', 'class']
    });

    document.addEventListener('click', (event) => {
        const overlay = event.target.closest('.dialog-overlay');
        if (overlay && event.target === overlay) {
            closeDialogOverlay(overlay);
        }
    });

    document.addEventListener('keydown', (event) => {
        const activeOverlay = getTopDialogOverlay();
        if (!activeOverlay) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialogOverlay(activeOverlay);
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(activeOverlay);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    });
}

function setupMobileEditorToggle() {
    const toggleBtn = document.getElementById('mobile-editor-toggle');
    if (!toggleBtn) return;

    const mediaQuery = window.matchMedia('(max-width: 900px)');

    const applyState = (isOpen) => {
        document.body.classList.toggle('mobile-editor-open', isOpen);
        toggleBtn.textContent = isOpen ? 'Hide Editor' : 'Show Editor';
        toggleBtn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
        if (isOpen && editor && typeof editor.layout === 'function') {
            setTimeout(() => editor.layout(), 80);
        }
    };

    const syncForViewport = () => {
        if (!mediaQuery.matches) {
            document.body.classList.remove('mobile-editor-open');
            toggleBtn.setAttribute('aria-pressed', 'false');
            toggleBtn.textContent = 'Show Editor';
            return;
        }
        applyState(false);
    };

    if (!toggleBtn.dataset.listenerAttached) {
        toggleBtn.dataset.listenerAttached = 'true';
        toggleBtn.addEventListener('click', () => {
            const next = !document.body.classList.contains('mobile-editor-open');
            applyState(next);
        });
    }

    if (!toggleBtn.dataset.viewportListenerAttached) {
        toggleBtn.dataset.viewportListenerAttached = 'true';
        mediaQuery.addEventListener('change', syncForViewport);
    }

    syncForViewport();
}

// Left panel tabs setup
function setupLeftPanelTabs() {
    const tabButtons = Array.from(document.querySelectorAll('[data-left-tab]'));
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

    setupHorizontalTabKeyboardNavigation(tabButtons, (button) => {
        switchLeftTab(button.dataset.leftTab);
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
    const closeFeedbackModal = document.getElementById('close-feedback-modal') || document.getElementById('cancel-feedback');
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
                name: formData.get('name'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                email: formData.get('email'),
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
