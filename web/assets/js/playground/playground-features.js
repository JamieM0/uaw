// Playground Features - Tutorial, LLM integration, and other features
// Universal Automation Wiki - Simulation Playground

// Constants
const LLM_MAX_CONTEXT_SIZE = 50000; // Max characters for LLM context
const LLM_RESPONSE_TIMEOUT = 30000; // 30 seconds timeout for LLM responses
const LLM_MAX_INPUT_LENGTH = 1000; // Max characters for user input

// Initialize tutorial system
function initializeTutorial() {
    try {
        // Check for required dependencies
        if (!tutorialData) {
            console.warn('Tutorial data not loaded - tutorial feature unavailable');
            return false;
        }

        if (!editor) {
            console.warn('Editor not initialized - tutorial feature unavailable');
            return false;
        }

        // Get required DOM elements
        const playgroundElements = {
            panel: document.getElementById('tutorial-panel'),
            title: document.getElementById('tutorial-title'),
            instructions: document.getElementById('tutorial-instructions'),
            status: document.getElementById('tutorial-status'),
            nextBtn: document.getElementById('tutorial-next-btn'),
            prevBtn: document.getElementById('tutorial-prev-btn'),
            exitBtn: document.getElementById('tutorial-exit-btn')
        };

        // Check if all required elements exist
        const missingElements = Object.entries(playgroundElements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('Tutorial initialization failed - missing elements:', missingElements);
            return false;
        }

        // Initialize tutorial manager
        tutorialManager = new TutorialManager(tutorialData, editor, playgroundElements);

        // Set up event listener
        const startBtn = document.getElementById('start-tutorial-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdown = document.querySelector('.dropdown-content');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
                tutorialManager.start();
            });

            console.log('Tutorial system initialized successfully');
            return true;
        } else {
            console.error('Tutorial start button not found');
            return false;
        }
    } catch (error) {
        console.error('Tutorial initialization error:', error);
        return false;
    }
}

// Initialize experimental LLM integration
function initializeExperimentalLLM() {
    try {
        // Get DOM elements
        const startBtn = document.getElementById('start-llm-btn');
        const infoOverlay = document.getElementById('llm-info-overlay');
        const proceedBtn = document.getElementById('llm-proceed-btn');
        const cancelBtn = document.getElementById('llm-cancel-btn');
        const chatOverlay = document.getElementById('llm-chat-overlay');
        const chatTitle = document.getElementById('llm-chat-title');
        const chatHistory = document.getElementById('llm-chat-history');
        const chatForm = document.getElementById('llm-chat-form');
        const chatInput = document.getElementById('llm-chat-input');
        const thinkingIndicator = document.getElementById('llm-thinking-indicator');
        const chatCloseBtn = document.getElementById('llm-chat-close-btn');

        // Check if all required elements exist
        if (!startBtn || !infoOverlay || !proceedBtn || !cancelBtn || !chatOverlay ||
            !chatHistory || !chatForm || !chatInput || !thinkingIndicator || !chatCloseBtn) {
            console.warn('LLM feature unavailable - missing required DOM elements');
            return false;
        }

        let llmSession = null;
        let llmAbortController = null;

        // Event Listeners
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            infoOverlay.style.display = 'flex';
            infoOverlay.setAttribute('role', 'dialog');
            infoOverlay.setAttribute('aria-label', 'LLM feature information');
        });

        cancelBtn.addEventListener('click', () => {
            infoOverlay.style.display = 'none';
        });

        // Enhanced close with cleanup
        chatCloseBtn.addEventListener('click', () => {
            cleanupLLMSession();
            chatOverlay.style.display = 'none';
        });

        // Cleanup function
        function cleanupLLMSession() {
            if (llmAbortController) {
                llmAbortController.abort();
                llmAbortController = null;
            }

            if (llmSession && llmSession.destroy) {
                try {
                    llmSession.destroy();
                } catch (error) {
                    console.warn('Error destroying LLM session:', error);
                }
            }

            llmSession = null;

            // Clear chat history to free memory
            if (chatHistory) {
                chatHistory.innerHTML = '';
            }

            // Reset input
            if (chatInput) {
                chatInput.value = '';
                chatInput.disabled = false;
            }

            // Hide thinking indicator
            if (thinkingIndicator) {
                thinkingIndicator.style.display = 'none';
            }
        }

        proceedBtn.addEventListener('click', async () => {
            infoOverlay.style.display = 'none';

            // Check for LanguageModel API availability
            if (!('LanguageModel' in window)) {
                showUserError("The Prompt API ('LanguageModel') is not available in your browser. Please ensure you are using Google Chrome Canary and have enabled the required features.");
                return;
            }

            try {
                // Check availability first
                const availability = await LanguageModel.availability();

                if (availability === 'unavailable') {
                    showUserError("The built-in AI is unavailable on your device. It may not be supported or may have been disabled.");
                    return;
                }

                if (availability !== 'available') {
                    showUserError(`The AI model is currently ${availability}. Please wait for the download to complete and try again.`);
                    return;
                }

                // Create session
                llmSession = await LanguageModel.create();

                chatHistory.innerHTML = `
                    <p style="color: var(--text-light); padding: 1rem;">
                        <strong>Session started.</strong> You can now chat with the built-in AI about your current simulation.
                        <br><br>
                        <em>Note: Large simulations will be truncated to fit context limits.</em>
                    </p>
                `;
                chatOverlay.style.display = 'flex';
                chatOverlay.setAttribute('role', 'dialog');
                chatOverlay.setAttribute('aria-label', 'AI chat session');

                // Focus on input for accessibility
                chatInput.focus();

            } catch (err) {
                showUserError(`Error initializing AI session: ${err.message || 'Unknown error'}`);
                console.error('LLM initialization error:', err);
            }
        });

        // Enhanced form submission with validation and timeout
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userInput = chatInput.value.trim();

            // Input validation
            if (!userInput) {
                return;
            }

            if (!llmSession) {
                showUserError('AI session not initialized. Please restart the chat.');
                return;
            }

            // Check input length
            if (userInput.length > LLM_MAX_INPUT_LENGTH) {
                showUserError(`Input too long. Please limit to ${LLM_MAX_INPUT_LENGTH} characters.`);
                return;
            }

            // Display user message
            appendChatMessage(userInput, 'user');
            chatInput.value = '';
            thinkingIndicator.style.display = 'block';
            chatInput.disabled = true;

            // Create abort controller for timeout
            llmAbortController = new AbortController();
            const timeoutId = setTimeout(() => {
                llmAbortController.abort();
            }, LLM_RESPONSE_TIMEOUT);

            try {
                // Get and truncate simulation context
                const simulationContext = getSimulationContext();

                // Construct prompt
                const prompt = `Context: ${simulationContext}\n\nUser question: ${userInput}`;

                // Stream response
                const stream = llmSession.promptStreaming(prompt);

                let aiResponse = '';
                const responseElement = appendChatMessage('', 'ai');
                const messageContent = responseElement.querySelector('.chat-message-content');

                // Handle streaming with timeout
                for await (const chunk of stream) {
                    if (llmAbortController.signal.aborted) {
                        throw new Error('Response timeout - please try a simpler question');
                    }

                    aiResponse += chunk;
                    messageContent.textContent = aiResponse;
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }

                clearTimeout(timeoutId);

            } catch (err) {
                clearTimeout(timeoutId);

                if (err.name === 'AbortError' || err.message.includes('timeout')) {
                    appendChatMessage('⏱️ Response timed out. Please try again with a simpler question.', 'ai');
                } else {
                    appendChatMessage(`❌ Error: ${err.message || 'Failed to get response'}`, 'ai');
                }

                console.error('LLM chat error:', err);
            } finally {
                thinkingIndicator.style.display = 'none';
                chatInput.disabled = false;
                chatInput.focus(); // Return focus for accessibility
                llmAbortController = null;
            }
        });

        // Helper: Get truncated simulation context
        function getSimulationContext() {
            try {
                const editorValue = editor.getValue();

                if (editorValue.length <= LLM_MAX_CONTEXT_SIZE) {
                    return `The user is editing a JSON simulation for the Universal Automation Wiki. Here is the current simulation data:\n\n${editorValue}`;
                }

                // Truncate large simulations
                const truncated = editorValue.substring(0, LLM_MAX_CONTEXT_SIZE);
                const lastBrace = truncated.lastIndexOf('}');
                const safeContext = lastBrace > 0 ? truncated.substring(0, lastBrace + 1) : truncated;

                return `The user is editing a JSON simulation for the Universal Automation Wiki. Here is a truncated version of the current simulation data (original was ${editorValue.length} characters, showing first ${safeContext.length}):\n\n${safeContext}\n\n[... truncated for length]`;
            } catch (error) {
                console.error('Error getting simulation context:', error);
                return 'The user is editing a simulation, but the data could not be read.';
            }
        }

        // Helper: Append chat message with proper escaping
        function appendChatMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message chat-message-${type}`;
            messageDiv.setAttribute('role', type === 'user' ? 'log' : 'status');

            const contentDiv = document.createElement('div');
            contentDiv.className = 'chat-message-content';
            contentDiv.textContent = message; // Use textContent for safe escaping

            messageDiv.appendChild(contentDiv);
            chatHistory.appendChild(messageDiv);
            chatHistory.scrollTop = chatHistory.scrollHeight;

            return messageDiv;
        }

        // Helper: Show user error with accessibility
        function showUserError(message) {
            const errorDialog = document.createElement('div');
            errorDialog.setAttribute('role', 'alert');
            errorDialog.setAttribute('aria-live', 'assertive');
            errorDialog.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--error-bg, #ff6b35); color: white; padding: 2rem; border-radius: 8px; max-width: 500px; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

            const messageText = document.createElement('p');
            messageText.textContent = message;
            messageText.style.marginBottom = '1rem';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'OK';
            closeBtn.style.cssText = 'background: white; color: #ff6b35; border: none; padding: 0.5rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: bold;';
            closeBtn.setAttribute('aria-label', 'Close error dialog');
            closeBtn.onclick = () => errorDialog.remove();

            errorDialog.appendChild(messageText);
            errorDialog.appendChild(closeBtn);
            document.body.appendChild(errorDialog);

            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (errorDialog.parentNode) {
                    errorDialog.remove();
                }
            }, 10000);

            // Focus on close button for accessibility
            closeBtn.focus();
        }

        console.log('Experimental LLM integration initialized successfully');
        return true;

    } catch (error) {
        console.error('LLM initialization error:', error);
        return false;
    }
}

// Initialize auto-validation toggle functionality
function initializeAutoValidationToggle() {
    try {
        // Initialize auto-validation as enabled by default
        if (window.autoValidationEnabled === undefined) {
            window.autoValidationEnabled = true;
        }

        const toggleBtn = document.getElementById('toggle-auto-validate-btn');
        const runValidationBtn = document.getElementById('run-validation-btn');

        if (!toggleBtn || !runValidationBtn) {
            console.warn('Auto-validation toggle unavailable - missing required buttons');
            return false;
        }

        function updateToggleUI() {
            if (window.autoValidationEnabled) {
                toggleBtn.textContent = 'Disable Auto-Validate';
                toggleBtn.setAttribute('aria-label', 'Disable automatic validation');
                runValidationBtn.style.display = 'none';
            } else {
                toggleBtn.textContent = 'Enable Auto-Validate';
                toggleBtn.setAttribute('aria-label', 'Enable automatic validation');
                runValidationBtn.style.display = 'inline-block';
            }
        }

        // Set initial UI state
        updateToggleUI();

        // Handle toggle button click
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const dropdown = document.querySelector('.dropdown-content');
            if (dropdown) {
                dropdown.style.display = 'none';
            }

            window.autoValidationEnabled = !window.autoValidationEnabled;
            updateToggleUI();

            // If auto-validation was re-enabled, run validation immediately
            if (window.autoValidationEnabled && typeof validateJSON === 'function') {
                try {
                    validateJSON();
                } catch (error) {
                    console.error('Validation error:', error);
                }
            }
        });

        // Handle manual run validation button click
        runValidationBtn.addEventListener('click', () => {
            if (typeof runManualValidation === 'function') {
                try {
                    runManualValidation();
                } catch (error) {
                    console.error('Manual validation error:', error);
                }
            }
        });

        console.log('Auto-validation toggle initialized successfully');
        return true;

    } catch (error) {
        console.error('Auto-validation toggle initialization error:', error);
        return false;
    }
}

// Initialize toggle when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure other components are initialized
    setTimeout(() => {
        try {
            initializeAutoValidationToggle();
        } catch (error) {
            console.error('Error during auto-validation toggle initialization:', error);
        }
    }, 100);
});
