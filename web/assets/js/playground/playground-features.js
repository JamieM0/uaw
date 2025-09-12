// Playground Features - Tutorial, LLM integration, and other features
// Universal Automation Wiki - Simulation Playground

// Initialize tutorial system
function initializeTutorial() {
    if (!tutorialData || !editor) return;
    
    // Initialize emoji picker when tutorial is initialized
    initializeEmojiPicker();

    const playgroundElements = {
        panel: document.getElementById('tutorial-panel'),
        title: document.getElementById('tutorial-title'),
        instructions: document.getElementById('tutorial-instructions'),
        status: document.getElementById('tutorial-status'),
        nextBtn: document.getElementById('tutorial-next-btn'),
        prevBtn: document.getElementById('tutorial-prev-btn'),
        exitBtn: document.getElementById('tutorial-exit-btn')
    };

    tutorialManager = new TutorialManager(tutorialData, editor, playgroundElements);

    document.getElementById('start-tutorial-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.dropdown-content').style.display = 'none'; // Hide dropdown
        tutorialManager.start();
    });
}

// Initialize experimental LLM integration
function initializeExperimentalLLM() {
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

    let llmSession = null;

    // Event Listeners
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        infoOverlay.style.display = 'flex';
    });

    cancelBtn.addEventListener('click', () => infoOverlay.style.display = 'none');
    chatCloseBtn.addEventListener('click', () => {
        if (llmSession && llmSession.destroy) {
            llmSession.destroy();
        }
        llmSession = null;
        chatOverlay.style.display = 'none';
    });

    proceedBtn.addEventListener('click', async () => {
        infoOverlay.style.display = 'none';

        // The new check is for 'LanguageModel'
        if (!('LanguageModel' in window)) {
            alert("The Prompt API ('LanguageModel') is not available in your browser. Please ensure you are using Google Chrome Canary and have enabled the required features.");
            return;
        }

        try {
            // Check availability first, as recommended
            const availability = await LanguageModel.availability();
            if (availability === 'unavailable') {
                 alert("The built-in AI is unavailable on your device. It may not be supported or may have been disabled.");
                 return;
            }
            if (availability !== 'available') {
                alert(`The AI model is currently ${availability}. Please wait for the download to complete and try again.`);
                return;
            }

            // The new API for creating a session
            llmSession = await LanguageModel.create();
            
            chatHistory.innerHTML = `<p style="color: var(--text-light);">Session started. You can now chat with the built-in AI about your current simulation.</p>`;
            chatOverlay.style.display = 'flex';
        } catch (err) {
            alert(`Error initializing AI session: ${err.message}.`);
            console.error(err);
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput || !llmSession) return;

        appendChatMessage(userInput, 'user');
        chatInput.value = '';
        thinkingIndicator.style.display = 'block';
        chatInput.disabled = true;

        try {
            const simulationContext = `The user is editing a JSON simulation for the Universal Automation Wiki. Here is the current simulation data:\n\n${editor.getValue()}`;
            
            // The new API uses promptStreaming on the session object
            const stream = llmSession.promptStreaming(
                `Context: ${simulationContext}\n\nUser question: ${userInput}`
            );

            let aiResponse = '';
            const responseElement = appendChatMessage('', 'ai');
            const messageContent = responseElement.querySelector('.chat-message-content');

            for await (const chunk of stream) {
                aiResponse += chunk;
                messageContent.textContent = aiResponse;
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

        } catch (err) {
            appendChatMessage(`Error: ${err.message}`, 'ai');
            console.error(err);
        } finally {
            thinkingIndicator.style.display = 'none';
            chatInput.disabled = false;
        }
    });

    function appendChatMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message chat-message-${type}`;
        messageDiv.innerHTML = `
            <div class="chat-message-content">${escapeHtml(message)}</div>
        `;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageDiv;
    }
}

// Initialize emoji picker
async function initializeEmojiPicker() {
    try {
        // Create and initialize emoji picker
        emojiPicker = new EmojiPicker({
            theme: 'uaw',
            searchPlaceholder: 'Search workplace emojis...',
            maxRecentEmojis: 24
        });
        
        const initialized = await emojiPicker.initialize();
        
        if (initialized) {
            // Attach to existing emoji input fields by ID
            const taskEmojiInput = document.getElementById('task-emoji-input');
            const objectEmojiInput = document.getElementById('object-emoji-input');
            
            if (taskEmojiInput) {
                emojiPicker.attachToInput(taskEmojiInput, { autoOpen: true });
            }
            
            if (objectEmojiInput) {
                emojiPicker.attachToInput(objectEmojiInput, { autoOpen: true });
            }
            
            // Attach to all emoji input fields by class
            const emojiFields = document.querySelectorAll('.object-emoji, input[maxlength="2"]');
            emojiFields.forEach(field => {
                // Skip if already attached by ID
                if (field.id === 'task-emoji-input' || field.id === 'object-emoji-input') {
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

// Initialize auto-validation toggle functionality
function initializeAutoValidationToggle() {
    // Initialize auto-validation as enabled by default
    if (window.autoValidationEnabled === undefined) {
        window.autoValidationEnabled = true;
    }

    const toggleBtn = document.getElementById('toggle-auto-validate-btn');
    const runValidationBtn = document.getElementById('run-validation-btn');
    
    function updateToggleUI() {
        if (window.autoValidationEnabled) {
            toggleBtn.textContent = 'Disable Auto-Validate';
            runValidationBtn.style.display = 'none';
        } else {
            toggleBtn.textContent = 'Enable Auto-Validate';
            runValidationBtn.style.display = 'inline-block';
        }
    }

    // Set initial UI state
    updateToggleUI();

    // Handle toggle button click
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.dropdown-content').style.display = 'none'; // Hide dropdown
        
        window.autoValidationEnabled = !window.autoValidationEnabled;
        updateToggleUI();
        
        // If auto-validation was re-enabled, run validation immediately
        if (window.autoValidationEnabled && typeof validateJSON === 'function') {
            validateJSON();
        }
    });

    // Handle manual run validation button click
    runValidationBtn.addEventListener('click', () => {
        if (typeof runManualValidation === 'function') {
            runManualValidation();
        }
    });
}

// Initialize toggle when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure other components are initialized
    setTimeout(initializeAutoValidationToggle, 100);
});