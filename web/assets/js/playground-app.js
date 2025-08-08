/**
 * Playground App Module
 * Main coordinator class that ties all modules together
 */

import { PlaygroundCore, initPlayground } from './playground-core.js';
import { PlaygroundDialogs } from './playground-dialogs.js';

export class PlaygroundApp {
    constructor() {
        this.core = null;
        this.dialogs = null;
        this.isInitialized = false;
    }
    
    /**
     * Initialize the playground application
     */
    async init() {
        if (this.isInitialized) {
            console.warn("APP: Already initialized");
            return;
        }
        
        try {
            console.log("APP: Starting playground application initialization");
            
            // Initialize core playground functionality
            this.core = initPlayground();
            
            // Initialize dialogs system
            this.dialogs = new PlaygroundDialogs(this.core);
            
            // Make dialogs globally available for form handlers
            window.playgroundDialogs = this.dialogs;
            
            // Wire up UI event handlers that depend on both core and dialogs
            this.wireUpUIHandlers();
            
            this.isInitialized = true;
            console.log("APP: Playground application initialized successfully");
            
        } catch (error) {
            console.error("APP: Failed to initialize playground application", error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Wire up UI event handlers that require both core and dialogs
     */
    wireUpUIHandlers() {
        // Override UI dialog methods to use our dialogs module
        if (this.core.ui) {
            this.core.ui.openAddTaskDialog = () => this.dialogs.openAddTaskDialog();
            this.core.ui.openAddActorDialog = () => this.dialogs.openAddActorDialog();
            this.core.ui.openAddResourceDialog = () => this.dialogs.openAddResourceDialog();
            this.core.ui.openSubmitDialog = () => this.dialogs.openSubmitDialog();
            this.core.ui.closeDialog = () => this.dialogs.closeDialog();
        }
        
        console.log("APP: UI handlers wired up successfully");
    }
    
    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        console.error("APP INITIALIZATION FAILED:", error);
        
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            z-index: 10000;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        `;
        errorMessage.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">Playground Initialization Failed</h3>
            <p>The playground failed to load properly. This could be due to:</p>
            <ul style="text-align: left; margin: 15px 0;">
                <li>Network connectivity issues</li>
                <li>Missing dependencies</li>
                <li>Browser compatibility problems</li>
            </ul>
            <p><strong>Please refresh the page and try again.</strong></p>
            <button onclick="window.location.reload()" style="
                background: #721c24;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            ">Refresh Page</button>
            <br><small style="margin-top: 10px; display: block;">Error: ${error.message}</small>
        `;
        
        document.body.appendChild(errorMessage);
    }
    
    /**
     * Get playground core instance
     */
    getCore() {
        return this.core;
    }
    
    /**
     * Get dialogs instance
     */
    getDialogs() {
        return this.dialogs;
    }
    
    /**
     * Check if app is initialized
     */
    isReady() {
        return this.isInitialized && this.core && this.core.isInitialized;
    }
    
    /**
     * Cleanup and destroy the application
     */
    destroy() {
        console.log("APP: Cleaning up playground application");
        
        if (this.core) {
            this.core.destroy();
        }
        
        // Clear global references
        window.playgroundDialogs = null;
        
        this.isInitialized = false;
        
        console.log("APP: Playground application destroyed");
    }
}

// Global app instance
let playgroundApp = null;

/**
 * Initialize the playground application (main entry point)
 */
export function initPlaygroundApp() {
    if (!playgroundApp) {
        playgroundApp = new PlaygroundApp();
        playgroundApp.init();
    }
    return playgroundApp;
}

/**
 * Get the current playground app instance
 */
export function getPlaygroundApp() {
    return playgroundApp;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlaygroundApp);
} else {
    // DOM is already ready
    initPlaygroundApp();
}