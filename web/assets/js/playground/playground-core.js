// Playground Core - Main initialization logic and global state management
// Universal Automation Wiki - Simulation Playground

// Global state variables
let editor;
let tutorialManager,
  player,
  spaceEditor,
  digitalSpaceEditor,
  displayEditor,
  emojiPicker;
let tutorialData = null;
let isPlaygroundInitialized = false; // Flag to prevent double-initialization
let autoRender = true;

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

// Welcome overlay handling
document.addEventListener("DOMContentLoaded", () => {
  // Apply dark mode as early as possible
  try {
    const savedDarkMode = localStorage.getItem("uaw-playground-dark-mode");
    if (savedDarkMode === "true") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {
    console.warn("Could not load dark mode preference:", e.message);
  }

  const welcomeOverlay = document.getElementById("welcome-overlay");
  const continueBtn = document.getElementById("welcome-continue-btn");
  const dontShowAgainCheckbox = document.getElementById("dont-show-again");

  if (localStorage.getItem("uaw-playground-welcome-seen")) {
    welcomeOverlay.style.display = "none";
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
});

// Data fetching and initialization
Promise.all([
  fetch("/assets/static/tutorial-content.json").then((res) => {
    if (!res.ok)
      throw new Error(
        `Fetch failed for tutorial-content.json: ${res.statusText}`,
      );
    return res.json();
  }),
  fetch("/assets/static/metrics-catalog.json").then((res) => {
    if (!res.ok)
      throw new Error(
        `Fetch failed for metrics-catalog.json: ${res.statusText}`,
      );
    return res.json();
  }),
  fetch("/assets/static/simulation-library.json").then((res) => {
    if (!res.ok)
      throw new Error(
        `Fetch failed for simulation-library.json: ${res.statusText}`,
      );
    return res.json();
  }),
])
  .then(([tutData, metData, simLibData]) => {
    tutorialData = tutData;
    window.metricsCatalog = metData;
    window.simulationLibrary = simLibData;
    initState.dataLoaded = true;

    // Populate simulation library dropdown
    populateSimulationLibrary();

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

// Core initialization function
function initializePlayground() {
  setupTabs();
  updateAutoRenderUI();
  initializeResizeHandles();
  initializeDragAndDrop();
  setupSaveLoadButtons();
  setupMetricsMode();
  setupDarkMode();
  setupRenderButton();
  setupFullscreenButton();
  setupUndoButton();

  const canvas = document.getElementById("space-canvas");
  const propsPanel = document.getElementById("properties-panel-content");
  if (canvas && propsPanel) {
    spaceEditor = new SpaceEditor(canvas, propsPanel, editor);
  } else {
    console.error("INIT ERROR: Canvas or Properties Panel element not found!");
  }

  // Initialize Digital Space Editor
  const digitalCanvas = document.getElementById("digital-space-canvas");
  const digitalPropsPanel = document.getElementById(
    "digital-properties-panel-content",
  );
  if (digitalCanvas && digitalPropsPanel) {
    digitalSpaceEditor = new DigitalSpaceEditor();
    // Initialize will be called when the tab is first opened
    window.digitalSpaceEditor = digitalSpaceEditor; // Make it globally accessible for object deletion
  } else {
    console.error(
      "INIT ERROR: Digital Space canvas or properties panel not found!",
    );
  }

  // Initialize Display Editor
  const displayCanvas = document.getElementById("display-canvas");
  const displayPropsPanel = document.getElementById(
    "display-properties-panel-content",
  );
  if (displayCanvas && displayPropsPanel) {
    displayEditor = new DisplayEditor();
    // Initialize will be called when the tab is first opened
    window.displayEditor = displayEditor; // Make it globally accessible
  } else {
    console.error("INIT ERROR: Display canvas or properties panel not found!");
  }

  initializeTutorial();
  initializeEmojiPicker();
  initializeExperimentalLLM();

  renderSimulation();
  validateJSON();

  // Setup validation interactions after everything is initialized
  setTimeout(() => {
    if (typeof setupValidationInteractions === "function") {
      setupValidationInteractions();
    }
  }, 100);
}

// Single point of entry for initialization
function attemptInitializePlayground() {
  // This function can be called from either async operation (fetch or monaco).
  // It will only run the actual initialization once all conditions are met.
  if (isPlaygroundInitialized) return; // Already done, do nothing.

  // Check if we can proceed with full initialization
  if (initState.editorReady && initState.dataLoaded) {
    isPlaygroundInitialized = true; // Set flag to prevent re-entry
    initializePlayground();
    return;
  }

  // Handle partial initialization scenarios
  if (initState.monacoLoadFailed && initState.dataLoaded) {
    isPlaygroundInitialized = true;
    initializeFallbackEditor();
    return;
  }

  if (initState.editorReady && initState.dataLoadFailed) {
    isPlaygroundInitialized = true;
    initializeMinimalEditor();
    return;
  }

  // If both failed, show error but try basic initialization
  if (initState.monacoLoadFailed && initState.dataLoadFailed) {
    showInitializationError(
      "Playground failed to initialize. Please check your internet connection and refresh the page.",
    );
    return;
  }
}

// Simulation library functionality
function populateSimulationLibrary() {
  const dropdown = document.getElementById("simulation-library-dropdown");
  if (!dropdown || !window.simulationLibrary) return;

  dropdown.innerHTML = ""; // Clear existing options

  window.simulationLibrary.simulations.forEach((simulation) => {
    const option = document.createElement("a");
    option.href = "#";
    option.textContent = simulation.name;
    option.title = `${simulation.description} (${simulation.complexity})`;
    option.dataset.simulationId = simulation.id;

    option.addEventListener("click", (e) => {
      e.preventDefault();
      loadSimulationFromLibrary(simulation.id);
    });

    dropdown.appendChild(option);
  });
}

function loadSimulationFromLibrary(simulationId) {
  const simulation = window.simulationLibrary.simulations.find(
    (s) => s.id === simulationId,
  );
  if (!simulation) {
    console.error(`Simulation with ID ${simulationId} not found`);
    return;
  }

  if (spaceEditor) {
    spaceEditor.hasInitiallyLoaded = false;
  }

  // Load the simulation data into the editor
  const simulationData = { simulation: simulation.simulation };
  editor.setValue(JSON.stringify(simulationData, null, 2));

  if (autoRender) {
    renderSimulation();
  }
}

// Setup render and auto-render buttons
function setupRenderButton() {
  const renderBtn = document.getElementById("render-simulation-btn");
  const autoRenderToggle = document.getElementById("auto-render-toggle");

  if (renderBtn) {
    renderBtn.addEventListener("click", renderSimulation);
  }

  if (autoRenderToggle) {
    autoRenderToggle.addEventListener("click", () => {
      autoRender = !autoRender;
      updateAutoRenderUI();
      if (autoRender) {
        renderSimulation();
      }
    });
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
  }

  // Initialize basic functionality
  setupTabs();
  updateAutoRenderUI();
  setupDarkMode();
  setupRenderButton();
  setupUndoButton();
  renderSimulation();

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

async function initializeEmojiPicker() {
  try {
    // Create and initialize emoji picker
    emojiPicker = new EmojiPicker({
      theme: "uaw",
      searchPlaceholder: "Search workplace emojis...",
      maxRecentEmojis: 24,
    });

    const initialized = await emojiPicker.initialize();

    if (initialized) {
      // Attach to existing emoji input fields by ID
      const taskEmojiInput = document.getElementById("task-emoji-input");
      const objectEmojiInput = document.getElementById("object-emoji-input");
      const metricEmojiInput = document.getElementById("metric-emoji-input");

      if (taskEmojiInput) {
        emojiPicker.attachToInput(taskEmojiInput, { autoOpen: true });
      }

      if (objectEmojiInput) {
        emojiPicker.attachToInput(objectEmojiInput, { autoOpen: true });
      }

      if (metricEmojiInput) {
        emojiPicker.attachToInput(metricEmojiInput, { autoOpen: true });
      }

      // Attach to all emoji input fields by class
      const emojiFields = document.querySelectorAll(
        '.object-emoji, input[maxlength="2"]',
      );
      emojiFields.forEach((field) => {
        // Skip if already attached by ID
        if (
          field.id === "task-emoji-input" ||
          field.id === "object-emoji-input" ||
          field.id === "metric-emoji-input"
        ) {
          return;
        }

        emojiPicker.attachToInput(field, { autoOpen: true });
      });

      // Attach to Monaco editor if available
      if (editor) {
        emojiPicker.attachToMonaco(editor);
      }

      // Make emoji picker globally accessible for dynamic field attachment
      window.emojiPicker = emojiPicker;
    } else {
      console.warn("INIT: Emoji picker failed to initialize");
    }
  } catch (error) {
    console.error("INIT: Emoji picker initialization error:", error);
  }
}

// Dark Mode Functionality
function setupDarkMode() {
  // Load saved dark mode preference
  try {
    const savedDarkMode = localStorage.getItem("uaw-playground-dark-mode");
    isDarkMode = savedDarkMode === "true";
  } catch (e) {
    console.warn("Could not load dark mode preference:", e.message);
    isDarkMode = false;
  }

  // Apply initial theme
  applyDarkMode();

  // Setup dark mode toggle button
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", toggleDarkMode);
    updateDarkModeButton();
  }
}

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  applyDarkMode();
  updateDarkModeButton();

  // Save preference
  try {
    localStorage.setItem("uaw-playground-dark-mode", isDarkMode.toString());
  } catch (e) {
    console.warn("Could not save dark mode preference:", e.message);
  }
}

function applyDarkMode() {
  const documentElement = document.documentElement;

  if (isDarkMode) {
    documentElement.setAttribute("data-theme", "dark");
    applyMonacoDarkTheme();
  } else {
    documentElement.removeAttribute("data-theme");
    applyMonacoLightTheme();
  }
}

function applyMonacoDarkTheme() {
  // Apply dark theme to main editor
  if (editor && editor.updateOptions) {
    editor.updateOptions({ theme: 'vs-dark' });
  }

  // Apply dark theme to metrics editors
  if (window.metricsJsonEditor && window.metricsJsonEditor.updateOptions) {
    window.metricsJsonEditor.updateOptions({ theme: 'vs-dark' });
  }

  if (window.metricsCatalogEditor && window.metricsCatalogEditor.updateOptions) {
    window.metricsCatalogEditor.updateOptions({ theme: 'vs-dark' });
  }

  if (window.metricsValidatorEditor && window.metricsValidatorEditor.updateOptions) {
    window.metricsValidatorEditor.updateOptions({ theme: 'vs-dark' });
  }
}

function applyMonacoLightTheme() {
  // Apply light theme to main editor
  if (editor && editor.updateOptions) {
    editor.updateOptions({ theme: 'vs' });
  }

  // Apply light theme to metrics editors
  if (window.metricsJsonEditor && window.metricsJsonEditor.updateOptions) {
    window.metricsJsonEditor.updateOptions({ theme: 'vs' });
  }

  if (window.metricsCatalogEditor && window.metricsCatalogEditor.updateOptions) {
    window.metricsCatalogEditor.updateOptions({ theme: 'vs' });
  }

  if (window.metricsValidatorEditor && window.metricsValidatorEditor.updateOptions) {
    window.metricsValidatorEditor.updateOptions({ theme: 'vs' });
  }
}

function updateDarkModeButton() {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  if (!darkModeToggle) return;

  if (isDarkMode) {
    darkModeToggle.textContent = "☀ Light";
    darkModeToggle.classList.add("dark-active");
    darkModeToggle.title = "Switch to Light Mode";
  } else {
    darkModeToggle.textContent = "☾ Dark";
    darkModeToggle.classList.remove("dark-active");
    darkModeToggle.title = "Switch to Dark Mode";
  }
}

// Setup undo button
function setupUndoButton() {
  const undoBtn = document.getElementById("undo-btn");
  if (undoBtn) {
    undoBtn.addEventListener("click", undo);
    // Update initial button state
    if (typeof updateUndoButton === 'function') {
      updateUndoButton();
    }
  }

  // Add keyboard shortcut for Ctrl+Z
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      // Only trigger if not in an input field (to avoid interfering with input undo)
      if (!e.target.matches('input, textarea') && editor) {
        e.preventDefault();
        undo();
      }
    }
  });
}
