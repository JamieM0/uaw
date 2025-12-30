// Playground Core - Main initialization logic and global state management
// Universal Automation Wiki - Simulation Playground

/**
 * Global state management namespace
 * Encapsulates all playground state to reduce global pollution
 */
const PlaygroundState = {
  editor: null,
  tutorialManager: null,
  player: null,
  spaceEditor: null,
  digitalSpaceEditor: null,
  displayEditor: null,
  emojiPicker: null,
  tutorialData: null,
  isInitialized: false,
  autoRender: true,
  isDarkMode: false,
  isEmbedded: false,
  isMetricsMode: false,
  metricsEditor: null
};

// Legacy global variables for backward compatibility
// TODO: Gradually migrate all references to use PlaygroundState
let editor;
let tutorialManager,
  player,
  spaceEditor,
  digitalSpaceEditor,
  displayEditor,
  emojiPicker;
let tutorialData = null;
let autoRender = true;

// RACE CONDITION FIX: Consolidate initialization state into single source of truth
// Use getter/setter to maintain backward compatibility while ensuring consistency
let _isPlaygroundInitialized = false;

// Unified initialization flag accessors
const getInitializationState = () => {
    return _isPlaygroundInitialized;
};

const setInitializationState = (value) => {
    _isPlaygroundInitialized = value;
    PlaygroundState.isInitialized = value;
};

// For backward compatibility, define getter/setter on window
Object.defineProperty(window, 'isPlaygroundInitialized', {
    get: () => _isPlaygroundInitialized,
    set: (value) => {
        _isPlaygroundInitialized = value;
        PlaygroundState.isInitialized = value;
    }
});

/**
 * Utility functions for performance and safety
 */
const PlaygroundUtils = {
  /**
   * Debounces a function to prevent excessive calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Milliseconds to wait
   * @returns {Function} Debounced function
   */
  debounce(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Safely gets an element by ID with error logging
   * @param {string} id - Element ID
   * @param {boolean} required - Whether element is required
   * @returns {HTMLElement|null}
   */
  safeGetElement(id, required = false) {
    const element = document.getElementById(id);
    if (!element && required) {
      console.error(`Required element not found: #${id}`);
    }
    return element;
  },

  /**
   * Safely queries a selector with error logging
   * @param {string} selector - CSS selector
   * @param {boolean} required - Whether element is required
   * @returns {HTMLElement|null}
   */
  safeQuerySelector(selector, required = false) {
    const element = document.querySelector(selector);
    if (!element && required) {
      console.error(`Required element not found: ${selector}`);
    }
    return element;
  }
};

// Asset Management System
const AssetManager = {
  // Generate a UUID v4 for asset references
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Store an asset and return the reference
   * @param {string} dataUrl - Data URL of the asset
   * @returns {string|null} Asset reference or null on error
   */
  storeAsset(dataUrl) {
    if (!editor) {
      console.warn('AssetManager: Editor not available');
      return null;
    }

    if (!dataUrl || typeof dataUrl !== 'string') {
      console.error('AssetManager: Invalid dataUrl provided');
      return null;
    }

    try {
      const editorValue = editor.getValue();
      if (!editorValue) {
        console.error('AssetManager: Editor has no content');
        return null;
      }

      const simulationData = JSON.parse(editorValue);

      // Initialize assets object if it doesn't exist
      if (!simulationData.assets) {
        simulationData.assets = {};
      }

      // Generate unique ID
      const assetId = this.generateUUID();
      const assetReference = `asset:${assetId}`;

      // Store the asset data
      simulationData.assets[assetId] = dataUrl;

      // Update the editor with the new simulation data
      editor.setValue(JSON.stringify(simulationData, null, 2));

      // Auto-collapse assets object (debounced to prevent race conditions)
      this._scheduleAutoCollapse(false);

      return assetReference;
    } catch (e) {
      console.error('Failed to store asset:', e);
      return null;
    }
  },

  // Retrieve an asset by reference
  getAsset(assetReference) {
    if (!editor || !assetReference || !assetReference.startsWith('asset:')) {
      return null;
    }

    try {
      const simulationData = JSON.parse(editor.getValue());
      const assetId = assetReference.replace('asset:', '');
      return simulationData.assets?.[assetId] || null;
    } catch (e) {
      console.error('Failed to retrieve asset:', e);
      return null;
    }
  },

  // Check if a value is an asset reference
  isAssetReference(value) {
    return typeof value === 'string' && value.startsWith('asset:');
  },

  // Resolve asset reference to actual data URL
  resolveAsset(value) {
    if (this.isAssetReference(value)) {
      return this.getAsset(value) || value;
    }
    return value;
  },

  // Remove unused assets (cleanup)
  cleanupUnusedAssets() {
    if (!editor) return;

    try {
      const simulationData = JSON.parse(editor.getValue());
      if (!simulationData.assets) return;

      const usedAssets = new Set();

      // Scan simulation for asset references
      const scanForAssets = (obj) => {
        if (typeof obj === 'string' && this.isAssetReference(obj)) {
          const assetId = obj.replace('asset:', '');
          usedAssets.add(assetId);
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(scanForAssets);
        }
      };

      scanForAssets(simulationData.simulation);

      // Remove unused assets
      const allAssets = Object.keys(simulationData.assets);
      const unusedAssets = allAssets.filter(id => !usedAssets.has(id));

      unusedAssets.forEach(id => {
        delete simulationData.assets[id];
      });

      if (unusedAssets.length > 0) {
        editor.setValue(JSON.stringify(simulationData, null, 2));

        // Auto-collapse assets object (debounced)
        this._scheduleAutoCollapse(false);

        console.log(`Cleaned up ${unusedAssets.length} unused assets`);
      }
    } catch (e) {
      console.error('Failed to cleanup assets:', e);
    }
  },

  /**
   * Debounced auto-collapse scheduler to prevent race conditions
   * @param {boolean} moveCursor - Whether to move cursor to top
   * @private
   */
  _autoCollapseTimeout: null,
  _scheduleAutoCollapse(moveCursor) {
    if (this._autoCollapseTimeout) {
      clearTimeout(this._autoCollapseTimeout);
    }

    this._autoCollapseTimeout = setTimeout(async () => {
      try {
        if (typeof autoCollapseAssetsObject === 'function') {
          await autoCollapseAssetsObject(moveCursor);
        }
      } catch (error) {
        console.warn('Failed to auto-collapse assets object:', error);
      }
      this._autoCollapseTimeout = null;
    }, 100);
  }
};

// Initialization state tracking
const initState = {
  dataLoaded: false,
  editorReady: false,
  monacoLoadFailed: false,
  dataLoadFailed: false,
};

// Metrics Editor Variables
let metricsEditor = null;
let isMetricsMode = false;

// Dark Mode Variables
let isDarkMode = false;
let isEmbedded = false;

/**
 * Welcome overlay handling and initial theme setup
 */
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Check if embedded first, then apply appropriate theme
    const urlParams = new URLSearchParams(window.location.search);
    const isEmbeddedCheck = urlParams.get('embedded') === 'true' || window.self !== window.top;

    if (!isEmbeddedCheck) {
      // Only apply saved dark mode preference if not embedded
      try {
        const savedDarkMode = localStorage.getItem("uaw-playground-dark-mode");
        if (savedDarkMode === "true") {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch (e) {
        console.warn("Could not load dark mode preference:", e.message);
      }
    } else {
      console.log("Embedded mode detected, skipping early theme application");
    }

    // Handle welcome overlay with null checks
    const welcomeOverlay = PlaygroundUtils.safeGetElement("welcome-overlay");
    const continueBtn = PlaygroundUtils.safeGetElement("welcome-continue-btn");
    const dontShowAgainCheckbox = PlaygroundUtils.safeGetElement("dont-show-again");

    if (!welcomeOverlay || !continueBtn || !dontShowAgainCheckbox) {
      console.warn("Welcome overlay elements not found - feature disabled");
      return;
    }

    try {
      if (localStorage.getItem("uaw-playground-welcome-seen")) {
        welcomeOverlay.style.display = "none";
      }
    } catch (e) {
      console.warn("Could not check welcome preference:", e.message);
    }

    continueBtn.addEventListener("click", () => {
      welcomeOverlay.style.display = "none";
      if (dontShowAgainCheckbox.checked) {
        try {
          localStorage.setItem("uaw-playground-welcome-seen", "true");
        } catch (e) {
          console.warn("Could not save welcome preference:", e.message);
        }
      }
    });
  } catch (error) {
    console.error("Error in DOMContentLoaded handler:", error);
  }
});

/**
 * Data fetching and initialization with comprehensive error handling
 */
Promise.all([
  fetch("/assets/static/tutorial-content.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid tutorial data format');
      }
      return data;
    }),
  fetch("/assets/static/metrics-catalog.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) {
        throw new Error('Metrics catalog must be an array');
      }
      return data;
    }),
  fetch("/assets/static/simulation-library.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!data || !data.simulations || !Array.isArray(data.simulations)) {
        throw new Error('Invalid simulation library format');
      }
      return data;
    }),
])
  .then(([tutData, metData, simLibData]) => {
    // Store data globally
    tutorialData = tutData;
    PlaygroundState.tutorialData = tutData;
    window.metricsCatalog = metData;
    window.simulationLibrary = simLibData;
    initState.dataLoaded = true;

    console.log('✓ Data files loaded successfully');

    // Populate simulation library dropdown
    try {
      populateSimulationLibrary();
    } catch (error) {
      console.error('Failed to populate simulation library:', error);
    }

    // Now that data is ready, try to initialize
    attemptInitializePlayground();
  })
  .catch((error) => {
    console.error("FETCH FAILED: Critical error loading initial data.", error);
    initState.dataLoadFailed = true;
    showInitializationError(
      "Failed to load required data files. Please refresh the page.",
      error,
    );
    // Still attempt initialization in case Monaco loaded - provide fallback experience
    attemptInitializePlayground();
  });

window.debugHelper = {
  showModules: () =>
    console.table(Object.keys(window).filter((k) => k.includes("playground"))),
  whatIsThis: (thing) =>
    console.log(thing, typeof thing, Object.keys(thing || {})),
  trace: (funcName) => {
    const original = window[funcName];
    window[funcName] = function (...args) {
      console.log(`Called ${funcName} with:`, args);
      return original.apply(this, args);
    };
  },
};

/**
 * Core initialization function - sets up all playground features
 * @throws {Error} If critical initialization steps fail
 */
function initializePlayground() {
  console.log('Initializing playground...');

  try {
    // Setup UI components
    if (typeof setupTabs === 'function') setupTabs();
    if (typeof updateAutoRenderUI === 'function') updateAutoRenderUI();
    if (typeof initializeResizeHandles === 'function') initializeResizeHandles();
    if (typeof initializeDragAndDrop === 'function') initializeDragAndDrop();
    if (typeof setupSaveLoadButtons === 'function') setupSaveLoadButtons();
    if (typeof setupMetricsMode === 'function') setupMetricsMode();

    setupDarkMode();
    setupRenderButton();

    if (typeof setupFullscreenButton === 'function') setupFullscreenButton();
    if (typeof setupUndoButton === 'function') setupUndoButton();
    if (typeof setupResetPanelSizes === 'function') setupResetPanelSizes();

    // Initialize Space Editor
    const canvas = PlaygroundUtils.safeGetElement("space-canvas");
    const propsPanel = PlaygroundUtils.safeGetElement("properties-panel-content");

    if (canvas && propsPanel) {
      if (typeof SpaceEditor !== 'undefined') {
        spaceEditor = new SpaceEditor(canvas, propsPanel, editor);
        PlaygroundState.spaceEditor = spaceEditor;
        window.spaceEditor = spaceEditor; // Make globally accessible for actor animation
        console.log('✓ Space editor initialized');
      } else {
        console.warn('SpaceEditor class not available');
      }
    } else {
      console.warn("Space editor: Canvas or properties panel not found");
    }

    // Initialize Digital Space Editor
    const digitalCanvas = PlaygroundUtils.safeGetElement("digital-space-canvas");
    const digitalPropsPanel = PlaygroundUtils.safeGetElement("digital-properties-panel-content");

    if (digitalCanvas && digitalPropsPanel) {
      if (typeof DigitalSpaceEditor !== 'undefined') {
        digitalSpaceEditor = new DigitalSpaceEditor();
        PlaygroundState.digitalSpaceEditor = digitalSpaceEditor;
        window.digitalSpaceEditor = digitalSpaceEditor;
        console.log('✓ Digital space editor initialized');
      } else {
        console.warn('DigitalSpaceEditor class not available');
      }
    } else {
      console.warn("Digital space editor: Canvas or properties panel not found");
    }

    // Initialize Display Editor
    const displayCanvas = PlaygroundUtils.safeGetElement("display-canvas");
    const displayPropsPanel = PlaygroundUtils.safeGetElement("display-properties-panel-content");

    if (displayCanvas && displayPropsPanel) {
      if (typeof DisplayEditor !== 'undefined') {
        displayEditor = new DisplayEditor();
        PlaygroundState.displayEditor = displayEditor;
        window.displayEditor = displayEditor;
        console.log('✓ Display editor initialized');
      } else {
        console.warn('DisplayEditor class not available');
      }
    } else {
      console.warn("Display editor: Canvas or properties panel not found");
    }

    // Initialize additional features
    initializeTutorial();
    initializeEmojiPicker();

    if (typeof initializeExperimentalLLM === 'function') {
      initializeExperimentalLLM();
    }

    if (typeof initializeSmartActions === "function") {
      initializeSmartActions();
    }

    // Initial render and validation
    if (typeof renderSimulation === 'function') {
      renderSimulation();
    }

    if (typeof validateJSON === 'function') {
      validateJSON();
    }

    // Setup validation interactions after everything is initialized (debounced)
    const debouncedSetup = PlaygroundUtils.debounce(() => {
      try {
        if (typeof setupValidationInteractions === "function") {
          setupValidationInteractions();
        }

        // Auto-filter to "Passed Only" when in embedded/iframe mode
        if (document.documentElement.classList.contains('iframe-embedded')) {
          const validationFilter = PlaygroundUtils.safeGetElement('validation-filter');
          if (validationFilter && typeof applyValidationFilter === "function") {
            validationFilter.value = 'passed';
            applyValidationFilter();
          }
        }
      } catch (error) {
        console.error('Error in deferred setup:', error);
      }
    }, 100);

    debouncedSetup();

    console.log('✓ Playground initialization complete');
  } catch (error) {
    console.error('Critical error during playground initialization:', error);
    throw error;
  }
}

/**
 * Single point of entry for initialization with race condition protection
 * This function can be called from either async operation (fetch or monaco).
 * It will only run the actual initialization once all conditions are met.
 * @returns {boolean} True if initialization was attempted, false if skipped
 */
function attemptInitializePlayground() {
  // Prevent re-entry with double-check locking pattern
  if (isPlaygroundInitialized) {
    console.warn('Playground already initialized, skipping duplicate call');
    return false;
  }

  if (PlaygroundState.isInitialized) {
    console.warn('Playground already initialized (state check), skipping');
    return false;
  }

  // Check if we can proceed with full initialization
  if (initState.editorReady && initState.dataLoaded) {
    console.log('✓ Full initialization conditions met');
    setInitializationState(true);
    try {
      initializePlayground();
      return true;
    } catch (error) {
      console.error('Initialization failed:', error);
      setInitializationState(false);
      showInitializationError('Initialization failed. See console for details.', error);
      return false;
    }
  }

  // Handle partial initialization scenarios
  if (initState.monacoLoadFailed && initState.dataLoaded) {
    console.log('⚠ Monaco failed, using fallback editor');
    setInitializationState(true);
    try {
      initializeFallbackEditor();
      return true;
    } catch (error) {
      console.error('Fallback initialization failed:', error);
      setInitializationState(false);
      return false;
    }
  }

  if (initState.editorReady && initState.dataLoadFailed) {
    console.log('⚠ Data loading failed, using minimal editor');
    setInitializationState(true);
    try {
      initializeMinimalEditor();
      return true;
    } catch (error) {
      console.error('Minimal initialization failed:', error);
      setInitializationState(false);
      return false;
    }
  }

  // If both failed, show error
  if (initState.monacoLoadFailed && initState.dataLoadFailed) {
    console.error('Both Monaco and data loading failed');
    showInitializationError(
      "Playground failed to initialize. Please check your internet connection and refresh the page.",
    );
    return false;
  }

  // Neither condition met yet, wait for next call
  console.log('Waiting for initialization conditions...', {
    editorReady: initState.editorReady,
    dataLoaded: initState.dataLoaded,
    monacoLoadFailed: initState.monacoLoadFailed,
    dataLoadFailed: initState.dataLoadFailed
  });
  return false;
}

/**
 * Populate simulation library dropdown with available simulations
 * @returns {boolean} True if successful, false if failed
 */
function populateSimulationLibrary() {
  const dropdown = PlaygroundUtils.safeGetElement("simulation-library-dropdown");
  if (!dropdown) {
    console.warn('Simulation library dropdown not found');
    return false;
  }

  if (!window.simulationLibrary || !window.simulationLibrary.simulations) {
    console.warn('Simulation library data not available');
    return false;
  }

  try {
    dropdown.innerHTML = ""; // Clear existing options

    window.simulationLibrary.simulations.forEach((simulation) => {
      if (!simulation || !simulation.id || !simulation.name) {
        console.warn('Skipping invalid simulation entry:', simulation);
        return;
      }

      const option = document.createElement("a");
      option.href = "#";
      option.textContent = `${simulation.name} (${simulation.complexity || 'Unknown'})`;
      option.title = simulation.description || simulation.name;
      option.dataset.simulationId = simulation.id;

      option.addEventListener("click", (e) => {
        e.preventDefault();
        loadSimulationFromLibrary(simulation.id);
      });

      dropdown.appendChild(option);
    });

    console.log(`✓ Loaded ${window.simulationLibrary.simulations.length} simulations`);
    return true;
  } catch (error) {
    console.error('Failed to populate simulation library:', error);
    return false;
  }
}

/**
 * Load a simulation from the library by ID
 * @param {string} simulationId - ID of simulation to load
 * @returns {boolean} True if successful, false if failed
 */
function loadSimulationFromLibrary(simulationId) {
  if (!simulationId || typeof simulationId !== 'string') {
    console.error('Invalid simulation ID provided');
    return false;
  }

  if (!window.simulationLibrary || !window.simulationLibrary.simulations) {
    console.error('Simulation library not available');
    return false;
  }

  const simulation = window.simulationLibrary.simulations.find(
    (s) => s && s.id === simulationId
  );

  if (!simulation) {
    console.error(`Simulation with ID "${simulationId}" not found`);
    return false;
  }

  if (!simulation.simulation) {
    console.error(`Simulation "${simulationId}" has no simulation data`);
    return false;
  }

  if (!editor) {
    console.error('Editor not available');
    return false;
  }

  try {
    // Reset space editor if available
    if (spaceEditor && typeof spaceEditor.hasInitiallyLoaded !== 'undefined') {
      spaceEditor.hasInitiallyLoaded = false;
    }

    // Load the simulation data into the editor
    const simulationData = { simulation: simulation.simulation };
    editor.setValue(JSON.stringify(simulationData, null, 2));

    // Auto-collapse assets object (debounced)
    AssetManager._scheduleAutoCollapse(true);

    if (autoRender) {
      if (typeof renderSimulation === 'function') {
        renderSimulation();
      } else {
        console.warn('renderSimulation function not available');
      }
    }

    console.log(`✓ Loaded simulation: ${simulation.name}`);
    return true;
  } catch (error) {
    console.error(`Failed to load simulation "${simulationId}":`, error);
    return false;
  }
}

/**
 * Setup render and auto-render buttons with proper event handling
 */
function setupRenderButton() {
  const renderBtn = PlaygroundUtils.safeGetElement("render-simulation-btn");
  const autoRenderToggle = PlaygroundUtils.safeGetElement("auto-render-toggle");

  if (renderBtn) {
    renderBtn.addEventListener("click", () => {
      if (typeof renderSimulation === 'function') {
        renderSimulation();
      } else {
        console.error('renderSimulation function not available');
      }
    });
  } else {
    console.warn('Render simulation button not found');
  }

  if (autoRenderToggle) {
    autoRenderToggle.addEventListener("click", () => {
      autoRender = !autoRender;
      PlaygroundState.autoRender = autoRender;

      if (typeof updateAutoRenderUI === 'function') {
        updateAutoRenderUI();
      }

      if (autoRender && typeof renderSimulation === 'function') {
        renderSimulation();
      }
    });
  } else {
    console.warn('Auto-render toggle button not found');
  }
}

// Fallback initialization when Monaco fails to load
function initializeFallbackEditor() {
  // Create a basic textarea fallback
  const editorContainer = document.getElementById("json-editor");
  if (editorContainer) {
    editorContainer.innerHTML =
      '<textarea id="fallback-editor" style="width: 100%; height: 100%; font-family: monospace; font-size: 14px; border: 1px solid #ccc; padding: 10px; resize: none;"></textarea>';

    const textarea = document.getElementById("fallback-editor");
    const defaultData = window.simulationLibrary
      ? JSON.stringify(
          {
            simulation:
              window.simulationLibrary.simulations.find(
                (s) => s.id === "breadmaking",
              )?.simulation || {},
          },
          null,
          2,
        )
      : JSON.stringify(
          {
            simulation: {
              tasks: [],
              objects: [],
              layout: { width: 800, height: 600 },
            },
          },
          null,
          2,
        );

    textarea.value = defaultData;

    // Create a simple editor interface that mimics Monaco's getValue/setValue
    editor = {
      getValue: () => textarea.value,
      setValue: (value) => {
        textarea.value = value;
      },
      onDidChangeModelContent: (callback) => {
        textarea.addEventListener("input", callback);
      },
    };

    // Add basic event handling
    textarea.addEventListener("input", () => {
      if (autoRender) {
        debounceRender();
      } else {
        updateDynamicPanels();
      }
      validateJSON();
    });

    // Save initial state to history
    if (typeof saveToHistory === 'function') {
      saveToHistory();
    }
  }

  // Initialize core playground features
  setupTabs();
  updateAutoRenderUI();
  initializeResizeHandles();
  initializeDragAndDrop();
  setupSaveLoadButtons();
  setupDarkMode();
  setupRenderButton();
  setupUndoButton();
  renderSimulation();
  validateJSON();
  if (typeof initializeSmartActions === "function") {
    initializeSmartActions();
  }

  showInitializationError(
    "Monaco editor failed to load. Using basic text editor.",
    null,
    "warning",
  );
}

// Minimal initialization when data files fail to load
function initializeMinimalEditor() {
  // Initialize with basic sample data
  const basicSample = {
    simulation: {
      tasks: [
        {
          id: "task1",
          name: "Example Task",
          emoji: "📋",
          duration: 60,
          startTime: 0,
        },
      ],
      objects: [
        { id: "obj1", name: "Example Object", emoji: "🔧", x: 100, y: 100 },
      ],
      layout: { width: 800, height: 600 },
    },
  };

  if (editor) {
    editor.setValue(JSON.stringify(basicSample, null, 2));
    // Auto-collapse assets object
    setTimeout(() => {
      if (typeof autoCollapseAssetsObject === 'function') {
        autoCollapseAssetsObject(true); // Move cursor to top when loading sample
      }
    }, 100);
  }

  // Initialize basic functionality
  setupTabs();
  updateAutoRenderUI();
  setupDarkMode();
  setupRenderButton();
  setupUndoButton();
  renderSimulation();
  if (typeof initializeSmartActions === "function") {
    initializeSmartActions();
  }

  showInitializationError(
    "Data files failed to load. Some features may be limited.",
    null,
    "warning",
  );
}

// Error display function
function showInitializationError(message, error = null, severity = "error") {
  const errorContainer =
    document.getElementById("validation-results") ||
    document.getElementById("editor-panel");
  if (!errorContainer) return;

  const errorDiv = document.createElement("div");
  errorDiv.className = `initialization-error ${severity}`;
  errorDiv.style.cssText = `
        background: ${severity === "error" ? "#fee" : "#ffc"};
        border: 1px solid ${severity === "error" ? "#f88" : "#fa0"};
        color: ${severity === "error" ? "#c00" : "#860"};
        padding: 12px;
        margin: 10px 0;
        border-radius: 4px;
        font-size: 14px;
    `;

  errorDiv.innerHTML = `
        <strong>${severity === "error" ? "❌" : "⚠️"} Initialization ${severity === "error" ? "Error" : "Warning"}</strong><br>
        ${message}
        ${error ? `<br><small>Technical details: ${error.message || error}</small>` : ""}
    `;

  errorContainer.insertBefore(errorDiv, errorContainer.firstChild);

  // Auto-remove warnings after 10 seconds
  if (severity === "warning") {
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
  }
}

/**
 * Initialize emoji picker and attach to input fields
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initializeEmojiPicker() {
  try {
    if (typeof EmojiPicker === 'undefined') {
      console.warn('EmojiPicker class not available');
      return false;
    }

    // Create and initialize emoji picker
    emojiPicker = new EmojiPicker({
      theme: "uaw",
      searchPlaceholder: "Search workplace emojis...",
      maxRecentEmojis: 24,
    });

    const initialized = await emojiPicker.initialize();

    if (!initialized) {
      console.warn("Emoji picker failed to initialize");
      return false;
    }

    // Attach to existing emoji input fields by ID
    const specificFields = [
      "task-emoji-input",
      "object-emoji-input",
      "metric-emoji-input"
    ];

    specificFields.forEach(fieldId => {
      const field = PlaygroundUtils.safeGetElement(fieldId);
      if (field && emojiPicker.attachToInput) {
        emojiPicker.attachToInput(field, { autoOpen: true });
      }
    });

    // Attach to all emoji input fields by class
    try {
      const emojiFields = document.querySelectorAll('.object-emoji, input[maxlength="2"]');
      emojiFields.forEach((field) => {
        // Skip if already attached by ID
        if (specificFields.includes(field.id)) {
          return;
        }

        if (emojiPicker.attachToInput) {
          emojiPicker.attachToInput(field, { autoOpen: true });
        }
      });
    } catch (error) {
      console.warn('Error attaching emoji picker to class fields:', error);
    }

    // Attach to Monaco editor if available
    if (editor && emojiPicker.attachToMonaco) {
      try {
        emojiPicker.attachToMonaco(editor);
      } catch (error) {
        console.warn('Error attaching emoji picker to Monaco:', error);
      }
    }

    // Make emoji picker globally accessible for dynamic field attachment
    window.emojiPicker = emojiPicker;
    PlaygroundState.emojiPicker = emojiPicker;

    console.log('✓ Emoji picker initialized');
    return true;
  } catch (error) {
    console.error("Emoji picker initialization error:", error);
    return false;
  }
}

/**
 * Setup dark mode functionality based on environment (embedded or standalone)
 */
function setupDarkMode() {
  try {
    // Check if we're embedded in an iframe
    isEmbedded = detectEmbedded();
    PlaygroundState.isEmbedded = isEmbedded;

    if (isEmbedded) {
      // In embedded mode, sync with parent page theme
      syncWithParentTheme();

      // Hide the theme toggle button in embedded mode
      const darkModeToggle = PlaygroundUtils.safeGetElement("dark-mode-toggle");
      if (darkModeToggle) {
        darkModeToggle.style.display = "none";
      }
    } else {
      // Standard mode: Load saved dark mode preference
      try {
        const savedDarkMode = localStorage.getItem("uaw-playground-dark-mode");
        isDarkMode = savedDarkMode === "true";
        PlaygroundState.isDarkMode = isDarkMode;
      } catch (e) {
        console.warn("Could not load dark mode preference:", e.message);
        isDarkMode = false;
        PlaygroundState.isDarkMode = false;
      }

      // Apply initial theme
      applyDarkMode();

      // Setup dark mode toggle button
      const darkModeToggle = PlaygroundUtils.safeGetElement("dark-mode-toggle");
      if (darkModeToggle) {
        darkModeToggle.addEventListener("click", toggleDarkMode);
        updateDarkModeButton();
      } else {
        console.warn('Dark mode toggle button not found');
      }
    }
  } catch (error) {
    console.error('Error setting up dark mode:', error);
  }
}

/**
 * Toggle dark mode on/off and save preference
 */
function toggleDarkMode() {
  try {
    // Temporarily disable transitions during theme switch
    document.body.classList.add('theme-switching');

    isDarkMode = !isDarkMode;
    PlaygroundState.isDarkMode = isDarkMode;

    applyDarkMode();
    updateDarkModeButton();

    // Save preference
    try {
      localStorage.setItem("uaw-playground-dark-mode", isDarkMode.toString());
    } catch (e) {
      console.warn("Could not save dark mode preference:", e.message);
    }

    // Re-enable transitions after a brief delay
    setTimeout(() => {
      document.body.classList.remove('theme-switching');
    }, 50);
  } catch (error) {
    console.error('Error toggling dark mode:', error);
  }
}

/**
 * Apply dark mode styling to document and editors
 */
function applyDarkMode() {
  try {
    const documentElement = document.documentElement;

    if (!documentElement) {
      console.error('Document element not available');
      return;
    }

    // Use consistent logic for both embedded and standalone modes:
    // Dark mode: data-theme="dark", Light mode: no data-theme attribute
    // This matches the CSS selectors in main.css (:root for light, [data-theme="dark"] for dark)
    if (isDarkMode) {
      documentElement.setAttribute("data-theme", "dark");
      applyMonacoDarkTheme();
    } else {
      documentElement.removeAttribute("data-theme");
      applyMonacoLightTheme();
    }
  } catch (error) {
    console.error('Error applying dark mode:', error);
  }
}

/**
 * Apply dark theme to Monaco editors
 */
function applyMonacoDarkTheme() {
  try {
    // Apply dark theme to main editor
    if (editor && editor.updateOptions) {
      editor.updateOptions({ theme: 'vs-dark' });
    }

    // Apply dark theme to metrics editors
    const metricsEditors = [
      'metricsJsonEditor',
      'metricsCatalogEditor',
      'metricsValidatorEditor'
    ];

    metricsEditors.forEach(editorName => {
      if (window[editorName] && window[editorName].updateOptions) {
        window[editorName].updateOptions({ theme: 'vs-dark' });
      }
    });
  } catch (error) {
    console.warn('Error applying Monaco dark theme:', error);
  }
}

/**
 * Apply light theme to Monaco editors
 */
function applyMonacoLightTheme() {
  try {
    // Apply light theme to main editor
    if (editor && editor.updateOptions) {
      editor.updateOptions({ theme: 'vs' });
    }

    // Apply light theme to metrics editors
    const metricsEditors = [
      'metricsJsonEditor',
      'metricsCatalogEditor',
      'metricsValidatorEditor'
    ];

    metricsEditors.forEach(editorName => {
      if (window[editorName] && window[editorName].updateOptions) {
        window[editorName].updateOptions({ theme: 'vs' });
      }
    });
  } catch (error) {
    console.warn('Error applying Monaco light theme:', error);
  }
}

/**
 * Update dark mode button appearance and text
 */
function updateDarkModeButton() {
  const darkModeToggle = PlaygroundUtils.safeGetElement("dark-mode-toggle");
  if (!darkModeToggle) return;

  try {
    if (isDarkMode) {
      darkModeToggle.textContent = "☀ Light";
      darkModeToggle.classList.add("dark-active");
      darkModeToggle.title = "Switch to Light Mode";
    } else {
      darkModeToggle.textContent = "☾ Dark";
      darkModeToggle.classList.remove("dark-active");
      darkModeToggle.title = "Switch to Dark Mode";
    }
  } catch (error) {
    console.warn('Error updating dark mode button:', error);
  }
}

/**
 * Detect if playground is embedded in an iframe
 * @returns {boolean} True if embedded
 */
function detectEmbedded() {
  try {
    // Method 1: Check URL parameter (most reliable)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('embedded') === 'true') {
      console.log("Detected embedded via URL parameter");
      return true;
    }

    // Method 2: Standard iframe detection
    try {
      const isEmbedded = window.self !== window.top;
      console.log("Iframe detection result:", isEmbedded);
      return isEmbedded;
    } catch (e) {
      console.log("Cross-origin iframe detected");
      return true; // Cross-origin iframe
    }
  } catch (error) {
    console.warn('Error detecting embedded mode:', error);
    return false; // Default to not embedded on error
  }
}

/**
 * Synchronize playground theme with parent page theme (for embedded mode)
 */
function syncWithParentTheme() {
  // Add a small delay to ensure parent page has loaded its theme
  setTimeout(() => {
    try {
      // Try to access parent's theme
      const parentTheme = window.parent.document.documentElement.getAttribute('data-theme');

      console.log("Parent theme detected:", parentTheme);

      // Use consistent convention: data-theme="dark" = dark mode, no data-theme = light mode
      if (parentTheme === 'dark') {
        isDarkMode = true;
        PlaygroundState.isDarkMode = true;
        console.log("Setting playground to dark mode");
      } else {
        isDarkMode = false; // default to light mode
        PlaygroundState.isDarkMode = false;
        console.log("Setting playground to light mode");
      }

      // Apply the theme
      applyDarkMode();

      // Set up a listener to sync theme changes from parent
      setupParentThemeListener();

    } catch (e) {
      // Cross-origin iframe - can't access parent, default to light mode
      console.warn("Cannot access parent theme (cross-origin), defaulting to light mode:", e.message);
      isDarkMode = false;
      PlaygroundState.isDarkMode = false;
      applyDarkMode();
    }
  }, 100); // Small delay to let parent finish loading
}

/**
 * Set up MutationObserver to watch for parent theme changes
 */
function setupParentThemeListener() {
  try {
    // Create a MutationObserver to watch for theme changes in parent
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          try {
            const parentTheme = window.parent.document.documentElement.getAttribute('data-theme');
            const newIsDarkMode = parentTheme === 'dark';

            console.log("Parent theme changed to:", parentTheme, "newIsDarkMode:", newIsDarkMode);

            if (newIsDarkMode !== isDarkMode) {
              isDarkMode = newIsDarkMode;
              PlaygroundState.isDarkMode = newIsDarkMode;
              console.log("Updating playground theme to match parent");
              applyDarkMode();
            }
          } catch (error) {
            console.warn('Error handling parent theme change:', error);
          }
        }
      });
    });

    // Start observing the parent's documentElement for attribute changes
    observer.observe(window.parent.document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    console.log("Parent theme listener set up successfully");

  } catch (e) {
    // Cross-origin - can't set up listener
    console.warn("Cannot set up parent theme listener (cross-origin):", e.message);
  }
}

/**
 * Setup undo button and keyboard shortcut
 */
function setupUndoButton() {
  const undoBtn = PlaygroundUtils.safeGetElement("undo-btn");

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (typeof undo === 'function') {
        undo();
      } else {
        console.error('Undo function not available');
      }
    });

    // Update initial button state
    if (typeof updateUndoButton === 'function') {
      updateUndoButton();
    }
  } else {
    console.warn('Undo button not found');
  }

  // Add keyboard shortcut for Ctrl+Z
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      // Only trigger if not in an input field (to avoid interfering with input undo)
      if (!e.target.matches('input, textarea') && editor && typeof undo === 'function') {
        e.preventDefault();
        undo();
      }
    }
  });
}

// Export AssetManager to global scope for use by other modules
window.AssetManager = AssetManager;
