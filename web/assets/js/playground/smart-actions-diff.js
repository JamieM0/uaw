// Smart Actions Diff - Monaco diff editor for find-and-replace approvals
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * Manages Monaco diff editor for showing and approving LLM-suggested changes
     * Uses the existing editor container and temporarily replaces it with a diff view
     */
    class SmartActionsDiff {
        constructor() {
            this.diffEditor = null;
            this.originalEditor = null;
            this.originalModel = null;
            this.modifiedModel = null;
            this.onApproveCallback = null;
            this.onRejectCallback = null;
            this.actionBar = null;
        }

        /**
         * Show diff editor with old and new content
         * @param {string} oldContent - Original simulation JSON
         * @param {string} newContent - Modified simulation JSON with replacement
         * @param {Function} onApprove - Callback when user approves the change
         * @param {Function} onReject - Callback when user rejects the change
         */
        show(oldContent, newContent, onApprove, onReject) {
            this.onApproveCallback = onApprove;
            this.onRejectCallback = onReject;

            // Wait for Monaco to be available
            if (typeof monaco === 'undefined' || !window.editor) {
                console.error('SmartActionsDiff: Monaco editor not loaded');
                alert('Monaco editor not available. Please refresh the page.');
                return;
            }

            // Store reference to original editor
            this.originalEditor = window.editor;

            // Get the editor container
            const editorContainer = document.getElementById('json-editor');
            if (!editorContainer) {
                console.error('SmartActionsDiff: Editor container not found');
                return;
            }

            // Hide the original editor (don't dispose it)
            this.originalEditor.getDomNode().style.display = 'none';

            // Create models for diff editor
            this.originalModel = monaco.editor.createModel(oldContent, 'json');
            this.modifiedModel = monaco.editor.createModel(newContent, 'json');

            // Create diff editor in the same container
            this.diffEditor = monaco.editor.createDiffEditor(editorContainer, {
                // Disable resizing for consistent UX
                enableSplitViewResizing: false,

                // Render inline for better mobile experience
                renderSideBySide: false,

                // Read-only since this is just for approval
                readOnly: true,

                // Theme matching the main editor
                theme: isDarkMode ? 'vs-dark' : 'vs',

                // Additional options
                automaticLayout: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible'
                }
            });

            // Set the models
            this.diffEditor.setModel({
                original: this.originalModel,
                modified: this.modifiedModel
            });

            // Create action bar with approve/reject buttons
            this.createActionBar();
        }

        /**
         * Create action bar with approve/reject buttons overlaying the editor
         */
        createActionBar() {
            // Remove existing action bar if present
            this.removeActionBar();

            const actionBar = document.createElement('div');
            actionBar.className = 'smart-diff-action-bar';
            actionBar.id = 'smart-diff-action-bar';

            actionBar.innerHTML = `
                <div class="smart-diff-action-content">
                    <div class="smart-diff-action-buttons">
                        <button type="button" class="smart-diff-btn smart-diff-btn-reject" id="smart-diff-reject">
                            Decline
                        </button>
                        <button type="button" class="smart-diff-btn smart-diff-btn-approve" id="smart-diff-approve">
                            Accept
                        </button>
                    </div>
                </div>
            `;

            // Insert action bar above the editor
            const editorContainer = document.getElementById('json-editor');
            editorContainer.parentNode.insertBefore(actionBar, editorContainer);
            this.actionBar = actionBar;

            // Bind event listeners
            const approveBtn = actionBar.querySelector('#smart-diff-approve');
            const rejectBtn = actionBar.querySelector('#smart-diff-reject');

            approveBtn.addEventListener('click', () => this.handleApprove());
            rejectBtn.addEventListener('click', () => this.handleReject());
        }

        /**
         * Handle approve action
         */
        handleApprove() {
            if (this.onApproveCallback) {
                const newContent = this.modifiedModel.getValue();
                this.onApproveCallback(newContent);
            }
            this.cleanup();
        }

        /**
         * Handle reject action
         */
        handleReject() {
            if (this.onRejectCallback) {
                this.onRejectCallback();
            }
            this.cleanup();
        }

        /**
         * Cleanup diff editor and restore original editor
         */
        cleanup() {
            // Dispose of diff editor
            if (this.diffEditor) {
                this.diffEditor.dispose();
                this.diffEditor = null;
            }

            // Dispose of models
            if (this.originalModel) {
                this.originalModel.dispose();
                this.originalModel = null;
            }

            if (this.modifiedModel) {
                this.modifiedModel.dispose();
                this.modifiedModel = null;
            }

            // Restore original editor
            if (this.originalEditor) {
                this.originalEditor.getDomNode().style.display = '';
                this.originalEditor.layout(); // Ensure proper layout after restore
                this.originalEditor = null;
            }

            // Remove action bar
            this.removeActionBar();

            // Clear callbacks
            this.onApproveCallback = null;
            this.onRejectCallback = null;
        }

        /**
         * Remove action bar
         */
        removeActionBar() {
            const existingBar = document.getElementById('smart-diff-action-bar');
            if (existingBar) {
                existingBar.remove();
            }
            this.actionBar = null;
        }
    }

    // Export to global scope
    window.SmartActionsDiff = SmartActionsDiff;

})();
