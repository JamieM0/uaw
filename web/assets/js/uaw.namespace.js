// Universal Automation Wiki - Namespace Module
// Defines the global UAW namespace safely and provides version information

(function() {
    'use strict';
    
    // Define the main namespace if it doesn't exist
    if (!window.UAW) {
        window.UAW = {};
    }
    
    // Version and build information
    window.UAW.version = '1.0.0';
    window.UAW.build = 'modular-refactor';
    
    // Initialization flags
    window.UAW._initialized = false;
    window.UAW._modules = {};
    
    // Module registration system
    window.UAW.registerModule = function(name, module) {
        console.log(`UAW: Registering module ${name}`);
        window.UAW._modules[name] = module;
        window.UAW[name] = module;
    };
    
    // Safe initialization helper (fires immediately if DOM is already ready)
    window.UAW.whenReady = function(callback) {
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', callback, { once: true });
            } else {
                // DOM is already parsed
                callback();
            }
        } catch (e) {
            // Fallback to immediate invoke
            try { callback(); } catch (_) {}
        }
    };
    
    // Compatibility layer for existing global variables
    // These will be populated by the appropriate modules
    window.UAW.compatibility = {
        metricsCatalog: null,
        simulationLibrary: null,
        tutorialData: null
    };
    
    // Expose compatibility globals for backward compatibility
    Object.defineProperty(window, 'metricsCatalog', {
        get: function() { return window.UAW.compatibility.metricsCatalog; },
        set: function(value) { window.UAW.compatibility.metricsCatalog = value; }
    });
    
    Object.defineProperty(window, 'simulationLibrary', {
        get: function() { return window.UAW.compatibility.simulationLibrary; },
        set: function(value) { window.UAW.compatibility.simulationLibrary = value; }
    });
    
    Object.defineProperty(window, 'tutorialData', {
        get: function() { return window.UAW.compatibility.tutorialData; },
        set: function(value) { window.UAW.compatibility.tutorialData = value; }
    });
    
    console.log(`UAW v${window.UAW.version} (${window.UAW.build}) - Namespace initialized`);
})();