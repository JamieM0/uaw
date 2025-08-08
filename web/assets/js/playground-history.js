/**
 * Playground History Module
 * Handles undo/redo functionality and state management
 */

import { PlaygroundConfig } from './playground-config.js';

export class PlaygroundHistory {
    constructor(core) {
        this.core = core;
        this.history = [];
        this.historyIndex = -1;
        this.isRestoringState = false;
        this.maxHistory = PlaygroundConfig.MAX_HISTORY;
    }
    
    /**
     * Save current state to history
     */
    saveToHistory() {
        if (this.isRestoringState) {
            // Don't save to history when we're restoring a previous state
            return;
        }
        
        const currentValue = this.core.editorManager.getValue();
        
        // Don't save if content is empty
        if (!currentValue.trim()) {
            console.log("HISTORY: Skipping save - empty content");
            return;
        }
        
        // Don't save if this is the same as the last saved state
        if (this.history.length > 0 && this.history[this.history.length - 1] === currentValue) {
            console.log("HISTORY: Skipping save - no changes detected");
            return;
        }
        
        // Remove any "future" history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state
        this.history.push(currentValue);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
        
        console.log(`HISTORY: Saved state ${this.historyIndex + 1}/${this.history.length}`);
        this.updateUndoButton();
    }
    
    /**
     * Undo to previous state
     */
    undo() {
        if (!this.canUndo()) {
            console.log("HISTORY: Cannot undo - no previous states");
            return false;
        }
        
        // If we're at the latest state, save it first (for potential redo)
        if (this.historyIndex === this.history.length - 1) {
            const currentValue = this.core.editorManager.getValue();
            if (currentValue !== this.history[this.historyIndex]) {
                this.history.push(currentValue);
            }
        }
        
        // Move to previous state
        this.historyIndex--;
        const previousValue = this.history[this.historyIndex];
        
        console.log(`HISTORY: Undoing to state ${this.historyIndex + 1}/${this.history.length}`);
        
        // Restore state
        this.isRestoringState = true;
        this.core.editorManager.setValue(previousValue);
        this.isRestoringState = false;
        
        // Trigger validation and rendering
        this.core.validation.validateJSON();
        this.core.renderSimulation();
        
        this.updateUndoButton();
        this.showHistoryNotification('Undo completed');
        
        return true;
    }
    
    /**
     * Redo to next state
     */
    redo() {
        if (!this.canRedo()) {
            console.log("HISTORY: Cannot redo - no future states");
            return false;
        }
        
        // Move to next state
        this.historyIndex++;
        const nextValue = this.history[this.historyIndex];
        
        console.log(`HISTORY: Redoing to state ${this.historyIndex + 1}/${this.history.length}`);
        
        // Restore state
        this.isRestoringState = true;
        this.core.editorManager.setValue(nextValue);
        this.isRestoringState = false;
        
        // Trigger validation and rendering
        this.core.validation.validateJSON();
        this.core.renderSimulation();
        
        this.updateUndoButton();
        this.showHistoryNotification('Redo completed');
        
        return true;
    }
    
    /**
     * Check if undo is possible
     */
    canUndo() {
        return this.historyIndex > 0;
    }
    
    /**
     * Check if redo is possible
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
    
    /**
     * Get current history position info
     */
    getHistoryInfo() {
        return {
            currentIndex: this.historyIndex,
            totalStates: this.history.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
    
    /**
     * Update undo button state
     */
    updateUndoButton() {
        const undoBtn = document.getElementById("undo-btn");
        if (!undoBtn) return;
        
        const canUndo = this.canUndo();
        undoBtn.disabled = !canUndo;
        
        // Update button text and title
        if (canUndo) {
            undoBtn.textContent = "↶ Undo";
            undoBtn.title = `Undo (${this.historyIndex + 1}/${this.history.length} states)`;
        } else {
            undoBtn.textContent = "↶ Undo";
            undoBtn.title = "No previous states to undo";
        }
        
        console.log(`HISTORY: Updated undo button - ${canUndo ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Show history operation notification
     */
    showHistoryNotification(message) {
        console.log(`HISTORY: ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Fade in
        setTimeout(() => {
            notification.style.opacity = '0.9';
        }, 10);
        
        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 1500);
    }
    
    /**
     * Clear all history
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.updateUndoButton();
        console.log("HISTORY: History cleared");
    }
    
    /**
     * Get history states for debugging
     */
    getHistoryStates() {
        return {
            states: this.history.map((state, index) => ({
                index,
                isCurrent: index === this.historyIndex,
                preview: state.substring(0, 50) + (state.length > 50 ? '...' : ''),
                length: state.length
            })),
            currentIndex: this.historyIndex,
            totalStates: this.history.length
        };
    }
    
    /**
     * Jump to a specific history state (for debugging)
     */
    jumpToState(index) {
        if (index < 0 || index >= this.history.length) {
            console.error("HISTORY: Invalid state index", index);
            return false;
        }
        
        this.historyIndex = index;
        const targetValue = this.history[this.historyIndex];
        
        console.log(`HISTORY: Jumping to state ${this.historyIndex + 1}/${this.history.length}`);
        
        // Restore state
        this.isRestoringState = true;
        this.core.editorManager.setValue(targetValue);
        this.isRestoringState = false;
        
        // Trigger validation and rendering
        this.core.validation.validateJSON();
        this.core.renderSimulation();
        
        this.updateUndoButton();
        this.showHistoryNotification(`Jumped to state ${index + 1}`);
        
        return true;
    }
    
    /**
     * Create a checkpoint (named save point)
     */
    createCheckpoint(name) {
        this.saveToHistory();
        
        // Store checkpoint metadata
        if (!this.checkpoints) {
            this.checkpoints = [];
        }
        
        this.checkpoints.push({
            name,
            historyIndex: this.historyIndex,
            timestamp: Date.now()
        });
        
        console.log(`HISTORY: Created checkpoint "${name}" at state ${this.historyIndex + 1}`);
        this.showHistoryNotification(`Checkpoint "${name}" created`);
    }
    
    /**
     * Restore to a checkpoint
     */
    restoreCheckpoint(name) {
        if (!this.checkpoints) {
            console.error("HISTORY: No checkpoints available");
            return false;
        }
        
        const checkpoint = this.checkpoints.find(cp => cp.name === name);
        if (!checkpoint) {
            console.error("HISTORY: Checkpoint not found", name);
            return false;
        }
        
        return this.jumpToState(checkpoint.historyIndex);
    }
    
    /**
     * Get list of available checkpoints
     */
    getCheckpoints() {
        return this.checkpoints || [];
    }
    
    /**
     * Export history for backup/restore
     */
    exportHistory() {
        return {
            history: this.history,
            historyIndex: this.historyIndex,
            checkpoints: this.checkpoints || [],
            timestamp: Date.now(),
            version: '1.0'
        };
    }
    
    /**
     * Import history from backup
     */
    importHistory(data) {
        if (!data || !data.history || !Array.isArray(data.history)) {
            console.error("HISTORY: Invalid history data for import");
            return false;
        }
        
        try {
            this.history = data.history;
            this.historyIndex = Math.min(data.historyIndex || 0, this.history.length - 1);
            this.checkpoints = data.checkpoints || [];
            
            // Restore current state
            if (this.history.length > 0) {
                const currentState = this.history[this.historyIndex];
                this.isRestoringState = true;
                this.core.editorManager.setValue(currentState);
                this.isRestoringState = false;
                
                // Trigger validation and rendering
                this.core.validation.validateJSON();
                this.core.renderSimulation();
            }
            
            this.updateUndoButton();
            console.log(`HISTORY: Imported ${this.history.length} states`);
            this.showHistoryNotification(`Imported ${this.history.length} history states`);
            
            return true;
            
        } catch (error) {
            console.error("HISTORY: Failed to import history", error);
            return false;
        }
    }
    
    /**
     * Get memory usage of history
     */
    getMemoryUsage() {
        const totalSize = this.history.reduce((sum, state) => sum + state.length, 0);
        const averageSize = this.history.length > 0 ? Math.round(totalSize / this.history.length) : 0;
        
        return {
            totalStates: this.history.length,
            totalSize,
            averageSize,
            maxStates: this.maxHistory,
            checkpoints: this.checkpoints ? this.checkpoints.length : 0
        };
    }
    
    /**
     * Optimize history by removing very similar states
     */
    optimizeHistory() {
        if (this.history.length <= 1) return;
        
        const originalLength = this.history.length;
        const optimized = [this.history[0]]; // Keep first state
        let newIndex = 0;
        
        for (let i = 1; i < this.history.length; i++) {
            const current = this.history[i];
            const previous = optimized[optimized.length - 1];
            
            // Calculate similarity (simple character difference ratio)
            const similarity = this.calculateSimilarity(current, previous);
            
            // Keep state if it's sufficiently different (less than 90% similar)
            if (similarity < 0.9) {
                optimized.push(current);
                if (i <= this.historyIndex) {
                    newIndex = optimized.length - 1;
                }
            } else if (i === this.historyIndex) {
                // If current state is very similar but it's our current position, keep it
                optimized.push(current);
                newIndex = optimized.length - 1;
            }
        }
        
        this.history = optimized;
        this.historyIndex = newIndex;
        
        const removedStates = originalLength - optimized.length;
        if (removedStates > 0) {
            console.log(`HISTORY: Optimized - removed ${removedStates} similar states`);
            this.showHistoryNotification(`Optimized: removed ${removedStates} similar states`);
        }
        
        this.updateUndoButton();
    }
    
    /**
     * Calculate similarity between two strings
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
}