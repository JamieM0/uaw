// TODO(human): Decide on user interaction flow approach
// Smart Actions UI - Main interface orchestrator
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * Main UI orchestrator for Smart Actions
     * Manages panel state, user interactions, and coordinates all components
     */
    class SmartActionsUI {
        constructor() {
            this.isInitialized = false;
            this.panelVisible = false;
            this.isResizing = false;
            this.panelWidth = 400;
            this.minPanelWidth = 300;
            this.maxPanelWidth = window.innerWidth * 0.5;

            // Component instances
            this.client = null;
            this.context = null;
            this.markdown = null;
            this.setup = null;

            // UI elements
            this.elements = {};
            this.config = null;

            // Chat state
            this.messages = [];
            this.isLoading = false;
            this.currentConversationId = null;
            this.conversations = new Map(); // Store conversations by ID
            this.maxConversations = 10;

            // Scroll tracking for auto-scroll behavior
            this.userHasScrolled = false;
        }

        /**
         * Initialize Smart Actions UI
         */
        async init() {
            if (this.isInitialized) return;

            try {
                // Initialize component instances
                this.client = new SmartActionsClient();
                this.context = new SmartActionsContext();
                this.markdown = new SmartActionsMarkdown();
                this.setup = new SmartActionsSetup();

                // Load configuration
                await this.loadConfig();

                // Initialize setup modal
                this.setup.init(this.client);

                // Create UI elements
                this.createUI();
                this.bindEvents();

                // Load conversations (after UI is created)
                this.loadConversations();

                // Update menu button state
                this.updateMenuButtonState();

                this.isInitialized = true;
                console.log('SmartActionsUI: Initialized successfully');
            } catch (error) {
                console.error('SmartActionsUI: Failed to initialize:', error);
            }
        }

        /**
         * Load Smart Actions configuration from cookies (matches setup.js storage)
         */
        async loadConfig() {
            try {
                const configData = this.getCookie('smart-actions-config');
                if (configData) {
                    this.config = JSON.parse(configData);
                    console.log('SmartActionsUI: Config loaded from cookies:', {
                        provider: this.config.provider,
                        model: this.config.model
                    });
                }
            } catch (error) {
                console.warn('SmartActionsUI: Could not load config:', error);
                this.config = null;
            }
        }

        /**
         * Save configuration to cookies (matches setup.js storage)
         */
        saveConfig(config) {
            try {
                this.setCookie('smart-actions-config', JSON.stringify(config), 365);
                this.config = config;
            } catch (error) {
                console.error('SmartActionsUI: Could not save config:', error);
            }
        }

        /**
         * Get cookie value by name
         */
        getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return decodeURIComponent(parts.pop().split(';').shift());
            }
            return null;
        }

        /**
         * Set cookie with expiration
         */
        setCookie(name, value, days) {
            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
        }

        /**
         * Create Smart Actions UI elements
         */
        createUI() {
            // Add menu button to Advanced Tools Group
            this.createMenuButton();

            // Create resizable panel
            this.createPanel();
        }

        /**
         * Cache Smart Actions menu button elements (already exists in HTML)
         */
        createMenuButton() {
            // Cache existing elements from HTML
            this.elements.menuButton = document.getElementById('smart-actions-menu-btn');
            this.elements.chatBtn = document.getElementById('smart-action-chat');
            this.elements.setupBtn = document.getElementById('smart-action-setup');
        }

        /**
         * Create Smart Actions panel
         */
        createPanel() {
            const playgroundTop = document.querySelector('.playground-top');
            if (!playgroundTop) return;

            // Wrap existing content in main container
            const main = document.createElement('div');
            main.className = 'playground-main';
            while (playgroundTop.firstChild) {
                main.appendChild(playgroundTop.firstChild);
            }
            playgroundTop.appendChild(main);

            // Create Smart Actions panel
            const panel = document.createElement('div');
            panel.className = 'smart-actions-panel';
            panel.id = 'smart-actions-panel';
            panel.innerHTML = `
                <div class="smart-actions-resize-handle"></div>
                <div class="smart-actions-header">
                    <div class="smart-actions-title-area">
                        <h3 class="smart-actions-title">Smart Chat</h3>
                        <select class="smart-actions-conversation-switcher" id="smart-actions-conversations">
                            <option value="new">+ New Conversation</option>
                        </select>
                    </div>
                    <button class="smart-actions-close" type="button">×</button>
                </div>
                <div class="smart-actions-content">
                    <div class="smart-actions-chat">
                        <div class="smart-actions-empty-state" id="smart-actions-empty-state">
                            <div class="smart-actions-empty-content">
                                <h4>Ready to analyze your simulation</h4>
                                <p>Click the button below to get insights, improvements, and analysis of your current simulation.</p>
                                <button class="smart-actions-analyze-btn" id="smart-actions-analyze">
                                    Analyse
                                </button>
                            </div>
                        </div>
                        <div class="smart-actions-messages" id="smart-actions-messages"></div>
                        <div class="smart-actions-input-area">
                            <form class="smart-actions-form" id="smart-actions-form">
                                <textarea
                                    class="smart-actions-textarea"
                                    id="smart-actions-input"
                                    placeholder="Ask for analysis, improvements, or specific insights about your simulation..."
                                    rows="3"
                                ></textarea>
                                <div class="smart-actions-controls">
                                    <span class="smart-actions-shortcut-hint">Shift+Enter to send</span>
                                    <button type="submit" class="smart-actions-send-btn" id="smart-actions-send">
                                        Send
                                    </button>
                                    <button type="button" class="smart-actions-config-btn" id="smart-actions-config">
                                        ⚙️
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            playgroundTop.appendChild(panel);

            // Cache elements
            this.elements.panel = panel;
            this.elements.resizeHandle = panel.querySelector('.smart-actions-resize-handle');
            this.elements.closeBtn = panel.querySelector('.smart-actions-close');
            this.elements.emptyState = document.getElementById('smart-actions-empty-state');
            this.elements.analyzeBtn = document.getElementById('smart-actions-analyze');
            this.elements.messages = document.getElementById('smart-actions-messages');
            this.elements.form = document.getElementById('smart-actions-form');
            this.elements.input = document.getElementById('smart-actions-input');
            this.elements.sendBtn = document.getElementById('smart-actions-send');
            this.elements.configBtn = document.getElementById('smart-actions-config');
            this.elements.conversationSwitcher = document.getElementById('smart-actions-conversations');
        }

        /**
         * Bind event listeners
         */
        bindEvents() {
            // Menu interactions
            if (this.elements.chatBtn) {
                this.elements.chatBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleChat();
                });
            }

            if (this.elements.setupBtn) {
                this.elements.setupBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleSetup();
                });
            }

            // Panel interactions
            if (this.elements.closeBtn) {
                this.elements.closeBtn.addEventListener('click', () => this.hidePanel());
            }

            if (this.elements.form) {
                this.elements.form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleSendMessage();
                });
            }

            // Handle keyboard shortcuts for textarea
            if (this.elements.input) {
                this.elements.input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        if (e.shiftKey) {
                            // Shift+Enter = send message
                            e.preventDefault();
                            this.handleSendMessage();
                        }
                        // Regular Enter = new line (default behavior)
                    }
                });
            }

            if (this.elements.configBtn) {
                this.elements.configBtn.addEventListener('click', () => this.handleSetup());
            }

            if (this.elements.analyzeBtn) {
                this.elements.analyzeBtn.addEventListener('click', () => this.handleAnalyze());
            }

            // Conversation switcher
            if (this.elements.conversationSwitcher) {
                this.elements.conversationSwitcher.addEventListener('change', (e) => {
                    this.handleConversationSwitch(e.target.value);
                });
            }

            // Resize handling
            if (this.elements.resizeHandle) {
                this.elements.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
            }

            // Scroll tracking for messages container
            if (this.elements.messages) {
                this.elements.messages.addEventListener('scroll', () => this.handleMessagesScroll());
            }

            // Global events
            document.addEventListener('mousemove', (e) => this.handleResize(e));
            document.addEventListener('mouseup', () => this.stopResize());
            window.addEventListener('resize', () => this.updateMaxWidth());

            // Smart Actions configuration events
            document.addEventListener('smart-actions-configured', (e) => {
                this.config = e.detail.config;
                console.log('SmartActionsUI: Configuration updated via event:', {
                    provider: this.config.provider,
                    model: this.config.model
                });
                this.updateMenuButtonState();
            });
        }

        /**
         * Handle Chat menu click - SETUP-FIRST APPROACH
         */
        async handleChat() {
            // Setup-first approach: Only show setup if user has NEVER configured any provider
            // Check if user has any saved API keys or model names (indicates they've set up before)
            const hasConfiguredBefore = this.hasEverConfigured();

            if (!this.config && !hasConfiguredBefore) {
                // First-time user - show setup modal
                this.setup.show();
                return;
            }

            // User has configured before (or has active config) - show chat panel
            // If config is missing but they've configured before, they can reconfigure via the setup button
            this.showPanel();
        }

        /**
         * Check if user has ever configured any provider
         * @returns {boolean} True if user has saved any provider configurations
         */
        hasEverConfigured() {
            if (!this.setup) return false;

            // Check if there are any saved API keys or model names
            const hasApiKeys = this.setup.savedApiKeys && Object.keys(this.setup.savedApiKeys).length > 0;
            const hasModelNames = this.setup.savedModelNames && Object.keys(this.setup.savedModelNames).length > 0;

            return hasApiKeys || hasModelNames;
        }

        /**
         * Handle Setup menu click
         */
        handleSetup() {
            this.setup.show();
        }

        /**
         * Handle analyze button click
         */
        async handleAnalyze() {
            // Check configuration first - show setup if needed
            if (!this.config) {
                this.setup.show();
                return;
            }

            // Create new conversation for analysis if needed
            if (!this.currentConversationId) {
                this.createNewConversation();
            }

            // Reset scroll tracking for new message
            this.userHasScrolled = false;

            // Hide analyze button and prompt to prevent confusion
            this.elements.emptyState.style.display = 'none';

            await this.startAnalysis();
        }

        /**
         * Update menu button state based on configuration
         */
        updateMenuButtonState() {
            if (!this.elements.menuButton) return;

            if (this.config) {
                this.elements.menuButton.disabled = false;
                this.elements.menuButton.title = 'Smart Actions (Configured)';
            } else {
                this.elements.menuButton.disabled = false; // Keep enabled for setup
                this.elements.menuButton.title = 'Smart Actions (Setup Required)';
            }
        }

        /**
         * Start analysis of current simulation
         */
        async startAnalysis() {
            if (!this.config) return;

            try {
                this.setLoading(true, 'analyzing'); // Use "analyzing" status for user-triggered analysis

                // Get current context
                const context = await this.context.getContext();

                // Load base system message and analysis agent prompt
                const [baseMessage, analysisMessage] = await Promise.all([
                    this.loadPrompt('base-system-message'),
                    this.loadPrompt('analysis-agent')
                ]);

                // Build complete system message with context
                const systemMessage = this.buildSystemMessage(baseMessage, analysisMessage, context);

                // Create initial analysis request
                const messages = [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: 'Please provide a comprehensive analysis of the current simulation.' }
                ];

                // Create placeholder for streaming response
                let assistantMessageDiv = null;
                let currentContent = '';

                // Send to AI with streaming enabled
                const response = await this.client.sendMessage(this.config, messages, {
                    streaming: true,
                    onChunk: (chunk, fullText) => {
                        currentContent = fullText;

                        // Update or create assistant message div
                        if (!assistantMessageDiv) {
                            // Remove loading indicator first
                            const loadingDiv = document.getElementById('smart-loading-indicator');
                            if (loadingDiv) loadingDiv.remove();

                            // Create the message div
                            assistantMessageDiv = this.createStreamingMessageDiv('assistant');
                        }

                        // Update content with markdown rendering
                        this.updateStreamingMessage(assistantMessageDiv, currentContent);
                    }
                });

                // Final update with complete response
                if (assistantMessageDiv) {
                    this.updateStreamingMessage(assistantMessageDiv, response);
                    // Remove streaming class to stop cursor animation
                    assistantMessageDiv.classList.remove('smart-message-streaming');
                } else {
                    // Fallback if streaming didn't work
                    this.addMessage('assistant', response);
                }

                this.messages = messages.concat([{ role: 'assistant', content: response }]);

                // Check for tool calls in the response
                const hasToolCall = await this.checkAndExecuteToolCalls(response);
                if (hasToolCall) {
                    // Tool call will handle continuation
                    return;
                }

            } catch (error) {
                this.addMessage('system', `Error: ${error.message}`);
            } finally {
                this.setLoading(false);
            }
        }

        /**
         * Handle sending user message
         */
        async handleSendMessage() {
            const input = this.elements.input.value.trim();
            if (!input || this.isLoading) return;

            // Check configuration - show setup if needed
            if (!this.config) {
                this.setup.show();
                return;
            }

            try {
                // Reset scroll tracking for new message
                this.userHasScrolled = false;

                // Add user message to chat first
                this.addMessage('user', input);
                this.elements.input.value = '';

                // Add to messages array
                this.messages.push({ role: 'user', content: input });

                // Now set loading state (this will appear after user message) - use "loading" status
                this.setLoading(true, 'loading');

                // Initialize conversation with full system message if this is the first user message
                await this.ensureSystemMessage();

                // Use cached conversation - only send recent context for continuing conversations
                const conversationMessages = this.prepareCachedConversation();

                // Create placeholder for streaming response
                let assistantMessageDiv = null;
                let currentContent = '';

                // Get response from AI with streaming
                const response = await this.client.sendMessage(this.config, conversationMessages, {
                    streaming: true,
                    onChunk: (chunk, fullText) => {
                        currentContent = fullText;

                        // Update or create assistant message div
                        if (!assistantMessageDiv) {
                            // Remove loading indicator first
                            const loadingDiv = document.getElementById('smart-loading-indicator');
                            if (loadingDiv) loadingDiv.remove();

                            // Create the message div
                            assistantMessageDiv = this.createStreamingMessageDiv('assistant');
                        }

                        // Update content with markdown rendering
                        this.updateStreamingMessage(assistantMessageDiv, currentContent);
                    }
                });

                // Final update with complete response
                if (assistantMessageDiv) {
                    this.updateStreamingMessage(assistantMessageDiv, response);
                    // Remove streaming class to stop cursor animation
                    assistantMessageDiv.classList.remove('smart-message-streaming');
                } else {
                    // Fallback if streaming didn't work
                    this.addMessage('assistant', response);
                }

                this.messages.push({ role: 'assistant', content: response });

                // Check for tool calls in the response
                const hasToolCall = await this.checkAndExecuteToolCalls(response);
                if (hasToolCall) {
                    // Tool call will handle continuation
                    return;
                }

            } catch (error) {
                this.addMessage('system', `Error: ${error.message}`);
            } finally {
                this.setLoading(false);
            }
        }

        /**
         * Ensure conversation has a full system message
         * Called before first user message to initialize context
         */
        async ensureSystemMessage() {
            // Check if we already have a system message
            const hasSystemMessage = this.messages.some(msg => msg.role === 'system');

            if (!hasSystemMessage) {
                // Load and build full system message
                const context = await this.context.getContext();
                const [baseMessage, analysisMessage] = await Promise.all([
                    this.loadPrompt('base-system-message'),
                    this.loadPrompt('analysis-agent')
                ]);

                const systemMessage = this.buildSystemMessage(baseMessage, analysisMessage, context);

                // Insert at beginning of conversation
                this.messages.unshift({
                    role: 'system',
                    content: systemMessage
                });
            }
        }

        /**
         * Prepare conversation messages for cached mode (reduces token usage)
         * For continuing conversations, only send lightweight context
         */
        prepareCachedConversation() {
            const maxRecentMessages = 10; // Only keep recent conversation history

            // If this is the first message in a conversation, send full system context
            if (this.messages.length <= 2) { // system + first user message
                return this.messages;
            }

            // For continuing conversations, create lightweight system message
            const lightweightSystemMessage = {
                role: 'system',
                content: `You are an AI assistant helping with simulation analysis in the Universal Automation Wiki playground. Continue the conversation naturally while maintaining context of the ongoing discussion.

## Tool Calling

You have access to tools:
- \`/tool view-simulation\` - Access the complete simulation JSON when you need detailed analysis

**Important**: Always provide a brief intro message before calling a tool (e.g., "Let me check your simulation:"). Use tools judiciously when you need the full data.`
            };

            // Get recent user-assistant messages only
            const recentMessages = this.messages
                .filter(msg => msg.role !== 'system') // Remove full system context
                .slice(-maxRecentMessages); // Keep only recent exchanges

            return [lightweightSystemMessage, ...recentMessages];
        }

        /**
         * Load prompt from markdown file
         */
        async loadPrompt(name) {
            try {
                const response = await fetch(`/assets/prompts/${name}.md`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${name}.md`);
                }
                return await response.text();
            } catch (error) {
                console.error(`Failed to load prompt ${name}:`, error);
                return `# Error loading ${name}`;
            }
        }

        /**
         * Build complete system message with context substitution
         */
        buildSystemMessage(baseMessage, agentMessage, context) {
            let fullMessage = baseMessage + '\n\n' + agentMessage;

            // Substitute context variables
            const simulation = context.simulation;
            if (simulation && !simulation.error) {
                // Create lightweight simulation summary instead of full JSON
                const simulationSummary = {
                    title: simulation.title,
                    description: simulation.description,
                    industry: simulation.industry,
                    complexity: simulation.complexityLevel,
                    objectCount: simulation.objectCount,
                    taskCount: simulation.taskCount,
                    objectTypes: simulation.objectTypes,
                    taskTypes: simulation.taskTypes,
                    currency: simulation.currency,
                    timeUnit: simulation.timeUnit,
                    totalSize: simulation.jsonSummary?.totalCharacters || 0,
                    hasAssets: simulation.jsonSummary?.hasAssets || false,
                    assetCount: simulation.jsonSummary?.assetCount || 0
                };

                fullMessage = fullMessage
                    .replace('{{SIMULATION_TITLE}}', simulation.title)
                    .replace('{{OBJECT_COUNT}}', simulation.objectCount.toString())
                    .replace('{{TASK_COUNT}}', simulation.taskCount.toString())
                    .replace('{{INDUSTRY}}', simulation.industry)
                    .replace('{{COMPLEXITY_LEVEL}}', simulation.complexityLevel)
                    .replace('{{CURRENT_SIMULATION_JSON}}', JSON.stringify(simulationSummary, null, 2));
            } else {
                fullMessage = fullMessage
                    .replace('{{SIMULATION_TITLE}}', 'No simulation loaded')
                    .replace('{{OBJECT_COUNT}}', '0')
                    .replace('{{TASK_COUNT}}', '0')
                    .replace('{{INDUSTRY}}', 'unknown')
                    .replace('{{COMPLEXITY_LEVEL}}', 'unknown')
                    .replace('{{CURRENT_SIMULATION_JSON}}', 'null');
            }

            // Substitute validation context
            const validation = context.validation;
            if (validation.available) {
                fullMessage = fullMessage
                    .replace('{{ERROR_COUNT}}', validation.stats.errors.toString())
                    .replace('{{WARNING_COUNT}}', validation.stats.warnings.toString())
                    .replace('{{INFO_COUNT}}', validation.stats.info.toString())
                    .replace('{{SUCCESS_COUNT}}', validation.stats.success.toString())
                    .replace('{{RECENT_ERRORS}}',
                        validation.recentErrors.map(e => `- ${e.message}`).join('\n') || 'None');
            } else {
                fullMessage = fullMessage
                    .replace('{{ERROR_COUNT}}', '0')
                    .replace('{{WARNING_COUNT}}', '0')
                    .replace('{{INFO_COUNT}}', '0')
                    .replace('{{SUCCESS_COUNT}}', '0')
                    .replace('{{RECENT_ERRORS}}', 'Validation not available');
            }

            // Substitute metrics context
            const metrics = context.metrics;
            fullMessage = fullMessage
                .replace('{{BUILTIN_METRICS_COUNT}}', metrics.builtInCount.toString())
                .replace('{{CUSTOM_METRICS_COUNT}}', metrics.customCount.toString())
                .replace('{{DISABLED_METRICS}}', metrics.disabledMetrics.join(', ') || 'None')
                .replace('{{VALIDATION_FUNCTIONS}}', metrics.validationFunctions.join(', ') || 'Standard functions');

            return fullMessage;
        }

        /**
         * Add message to chat and save to conversation
         */
        addMessage(role, content) {
            // Ensure we have a conversation
            if (!this.currentConversationId) {
                this.createNewConversation();
            }

            // Add to UI
            this.addMessageToUI(role, content);

            // Update conversation in memory
            if (this.currentConversationId && this.conversations.has(this.currentConversationId)) {
                const conversation = this.conversations.get(this.currentConversationId);
                conversation.messages = [...this.messages]; // Keep in sync
                conversation.lastActivity = new Date().toISOString();

                // Update title if this is the first user message
                if (role === 'user' && conversation.title === 'New Conversation') {
                    conversation.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
                    this.updateConversationSwitcher();
                }

                this.saveConversations();
            }

            this.updateEmptyState();
        }

        /**
         * Update empty state visibility based on message count
         */
        updateEmptyState() {
            if (this.elements.emptyState && this.elements.messages) {
                // Check for user-visible messages (exclude system messages)
                const visibleMessages = this.messages.filter(m => m.role !== 'system');
                const hasVisibleMessages = visibleMessages.length > 0 || this.elements.messages.children.length > 0;

                // Only show empty state if no visible messages AND not currently loading
                this.elements.emptyState.style.display = (hasVisibleMessages || this.isLoading) ? 'none' : 'flex';
            }
        }

        /**
         * Set loading state
         * @param {boolean} loading - Whether loading is active
         * @param {string} status - Loading status message ('analyzing' or 'loading')
         */
        setLoading(loading, status = 'loading') {
            this.isLoading = loading;

            if (loading) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'smart-actions-loading';
                loadingDiv.id = 'smart-loading-indicator';

                const statusText = status === 'analyzing' ? 'Analysing...' : 'Loading...';
                loadingDiv.innerHTML = `<div class="smart-actions-spinner"></div> ${statusText}`;

                this.elements.messages.appendChild(loadingDiv);
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            } else {
                const loadingDiv = document.getElementById('smart-loading-indicator');
                if (loadingDiv) {
                    loadingDiv.remove();
                }
            }

            this.elements.sendBtn.disabled = loading;
            this.elements.input.disabled = loading;
        }

        /**
         * Enable input controls
         * Used when creating/switching conversations to ensure input is ready
         */
        enableInput() {
            if (!this.elements.input || !this.elements.sendBtn) {
                console.warn('SmartActionsUI: Input elements not found', {
                    input: !!this.elements.input,
                    sendBtn: !!this.elements.sendBtn
                });
                return;
            }

            // Only enable if not currently loading
            if (!this.isLoading) {
                this.elements.input.disabled = false;
                this.elements.sendBtn.disabled = false;

                // Remove any readonly attributes that might have been set
                this.elements.input.removeAttribute('readonly');

                console.log('SmartActionsUI: Input controls enabled');
            } else {
                console.log('SmartActionsUI: Cannot enable input - currently loading');
            }
        }

        /**
         * Show Smart Actions panel
         */
        showPanel() {
            this.elements.panel.classList.add('active');
            this.panelVisible = true;
            this.updateLayout();
            this.updateEmptyState();

            // Ensure input is enabled when showing panel
            // Only enable if not currently loading
            if (!this.isLoading) {
                this.enableInput();
            }
        }

        /**
         * Hide Smart Actions panel
         */
        hidePanel() {
            this.elements.panel.classList.remove('active');
            this.panelVisible = false;
            this.updateLayout();
        }

        /**
         * Start panel resize
         */
        startResize(e) {
            this.isResizing = true;
            this.elements.resizeHandle.classList.add('resizing');
            e.preventDefault();
        }

        /**
         * Handle panel resize
         */
        handleResize(e) {
            if (!this.isResizing) return;

            const rect = this.elements.panel.getBoundingClientRect();
            const newWidth = window.innerWidth - e.clientX;
            const clampedWidth = Math.max(this.minPanelWidth,
                                Math.min(this.maxPanelWidth, newWidth));

            this.panelWidth = clampedWidth;
            this.elements.panel.style.width = `${clampedWidth}px`;
        }

        /**
         * Stop panel resize
         */
        stopResize() {
            if (this.isResizing) {
                this.isResizing = false;
                this.elements.resizeHandle.classList.remove('resizing');
            }
        }

        /**
         * Update maximum panel width
         */
        updateMaxWidth() {
            this.maxPanelWidth = window.innerWidth * 0.5;
            if (this.panelWidth > this.maxPanelWidth) {
                this.panelWidth = this.maxPanelWidth;
                this.elements.panel.style.width = `${this.panelWidth}px`;
            }
        }

        /**
         * Update layout after panel state changes
         */
        updateLayout() {
            // This could trigger layout adjustments for other playground components
            const event = new CustomEvent('smart-actions-panel-changed', {
                detail: { visible: this.panelVisible, width: this.panelWidth }
            });
            document.dispatchEvent(event);
        }

        /**
         * Load conversations from localStorage
         */
        loadConversations() {
            try {
                const conversationsData = localStorage.getItem('smart-actions-conversations');
                if (conversationsData) {
                    const data = JSON.parse(conversationsData);
                    this.conversations = new Map(Object.entries(data.conversations || {}));
                    this.currentConversationId = data.currentConversationId || null;
                }
            } catch (error) {
                console.warn('SmartActionsUI: Could not load conversations:', error);
                this.conversations = new Map();
            }

            this.updateConversationSwitcher();

            // Load current conversation messages if one exists
            if (this.currentConversationId && this.conversations.has(this.currentConversationId)) {
                const conversation = this.conversations.get(this.currentConversationId);
                this.messages = [...conversation.messages];

                // Rebuild chat UI for current conversation
                this.clearMessages();
                this.messages.forEach(msg => {
                    if (msg.role !== 'system') { // Don't show system messages in UI
                        this.addMessageToUI(msg.role, msg.content);
                    }
                });
            }

            this.updateEmptyState();

            // Ensure inputs are enabled after loading conversations
            // This handles the case where user opens chat for the first time
            this.enableInput();
        }

        /**
         * Save conversations to localStorage
         */
        saveConversations() {
            try {
                const data = {
                    conversations: Object.fromEntries(this.conversations),
                    currentConversationId: this.currentConversationId
                };
                localStorage.setItem('smart-actions-conversations', JSON.stringify(data));
            } catch (error) {
                console.error('SmartActionsUI: Could not save conversations:', error);
            }
        }

        /**
         * Create a new conversation
         */
        createNewConversation() {
            const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const conversation = {
                id,
                title: 'New Conversation',
                messages: [],
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };

            // Remove oldest conversation if we exceed the limit
            if (this.conversations.size >= this.maxConversations) {
                const oldestId = Array.from(this.conversations.keys())[0];
                this.conversations.delete(oldestId);
            }

            this.conversations.set(id, conversation);
            this.currentConversationId = id;
            this.messages = [];

            this.clearMessages();
            this.updateConversationSwitcher();
            this.saveConversations();

            // Enable input for new conversation
            this.enableInput();

            return conversation;
        }

        /**
         * Switch to a conversation
         */
        handleConversationSwitch(conversationId) {
            if (conversationId === 'new') {
                this.createNewConversation();
                return;
            }

            const conversation = this.conversations.get(conversationId);
            if (!conversation) return;

            // Save current conversation if it exists
            if (this.currentConversationId && this.conversations.has(this.currentConversationId)) {
                const current = this.conversations.get(this.currentConversationId);
                current.messages = [...this.messages];
                current.lastActivity = new Date().toISOString();
            }

            // Load selected conversation
            this.currentConversationId = conversationId;
            this.messages = [...conversation.messages];

            // Rebuild chat UI
            this.clearMessages();
            this.messages.forEach(msg => {
                if (msg.role !== 'system') { // Don't show system messages in UI
                    this.addMessageToUI(msg.role, msg.content);
                }
            });

            this.updateEmptyState();
            this.saveConversations();

            // Enable input when switching conversations
            this.enableInput();
        }

        /**
         * Update conversation switcher dropdown
         */
        updateConversationSwitcher() {
            if (!this.elements.conversationSwitcher) return;

            const switcher = this.elements.conversationSwitcher;
            switcher.innerHTML = '<option value="new">+ New Conversation</option>';

            // Sort conversations by last activity (newest first)
            const sorted = Array.from(this.conversations.entries())
                .sort((a, b) => new Date(b[1].lastActivity) - new Date(a[1].lastActivity));

            sorted.forEach(([id, conv]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = this.getConversationDisplayTitle(conv);
                if (id === this.currentConversationId) {
                    option.selected = true;
                }
                switcher.appendChild(option);
            });
        }

        /**
         * Get display title for conversation
         */
        getConversationDisplayTitle(conversation) {
            if (conversation.title && conversation.title !== 'New Conversation') {
                return conversation.title;
            }

            // Generate title from first user message if available
            const firstUserMsg = conversation.messages.find(m => m.role === 'user');
            if (firstUserMsg) {
                const preview = firstUserMsg.content.substring(0, 30);
                return preview.length < firstUserMsg.content.length ? preview + '...' : preview;
            }

            // Fallback to timestamp
            const date = new Date(conversation.createdAt);
            return `Chat ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }

        /**
         * Clear messages from UI only
         */
        clearMessages() {
            if (this.elements.messages) {
                this.elements.messages.innerHTML = '';
            }
        }

        /**
         * Add message to UI only (separate from addMessage for conversation loading)
         */
        addMessageToUI(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'smart-message';

            const time = new Date().toLocaleTimeString();
            const renderedContent = this.markdown.parse(content);

            messageDiv.innerHTML = `
                <div class="smart-message-header">
                    <span class="smart-message-role ${role}">${role}</span>
                    <span class="smart-message-time">${time}</span>
                </div>
                <div class="smart-message-content">${renderedContent}</div>
            `;

            this.elements.messages.appendChild(messageDiv);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }

        /**
         * Create a message div for streaming updates
         * @param {string} role - Message role (user, assistant, system)
         * @returns {HTMLElement} The created message div
         */
        createStreamingMessageDiv(role) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'smart-message smart-message-streaming';

            const time = new Date().toLocaleTimeString();

            messageDiv.innerHTML = `
                <div class="smart-message-header">
                    <span class="smart-message-role ${role}">${role}</span>
                    <span class="smart-message-time">${time}</span>
                </div>
                <div class="smart-message-content"></div>
            `;

            this.elements.messages.appendChild(messageDiv);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;

            return messageDiv;
        }

        /**
         * Update a streaming message with new content
         * @param {HTMLElement} messageDiv - The message div to update
         * @param {string} content - New content to render
         */
        updateStreamingMessage(messageDiv, content) {
            const contentDiv = messageDiv.querySelector('.smart-message-content');
            if (contentDiv) {
                // Check for tool calls before rendering
                const processedContent = this.processToolCalls(content);
                const renderedContent = this.markdown.parse(processedContent.displayContent);
                contentDiv.innerHTML = renderedContent;

                // Auto-scroll to bottom only if user hasn't manually scrolled up
                this.autoScrollIfNeeded();
            }
        }

        /**
         * Process tool calls in LLM response
         * @param {string} content - Raw content from LLM
         * @returns {Object} - Processed content and tool call info
         */
        processToolCalls(content) {
            const toolCallRegex = /\/tool\s+view-simulation/gm;
            const hasToolCall = toolCallRegex.test(content);

            if (hasToolCall) {
                // Remove tool call from display content
                const displayContent = content.replace(/\/tool\s+view-simulation/gm, '').trim();

                return {
                    displayContent,
                    hasToolCall: true
                };
            }

            return {
                displayContent: content,
                hasToolCall: false
            };
        }

        /**
         * Check if streaming response contains tool call and handle it
         * This is called after streaming completes
         * @param {string} fullResponse - Complete response from LLM
         * @returns {boolean} True if tool call was found and executed
         */
        async checkAndExecuteToolCalls(fullResponse) {
            const toolCallRegex = /\/tool\s+view-simulation/;

            if (toolCallRegex.test(fullResponse)) {
                // Tool call detected - execute it
                await this.executeToolCall('view-simulation', fullResponse);
                return true;
            }

            return false;
        }

        /**
         * Execute a tool call and continue conversation
         * @param {string} toolName - Name of the tool to execute
         * @param {string} partialResponse - Response before tool call
         */
        async executeToolCall(toolName, partialResponse) {
            if (toolName === 'view-simulation') {
                try {
                    // Show tool indicator (will remain visible permanently)
                    this.showToolIndicator('Accessing Simulation...');

                    // Get full simulation JSON
                    const simulationJson = this.context.getFullSimulationJson();

                    // Wait briefly for visual feedback
                    await new Promise(resolve => setTimeout(resolve, 800));

                    // Don't hide tool indicator - keep it visible

                    // Add tool result to conversation
                    const toolResultMessage = {
                        role: 'user',
                        content: `[TOOL RESULT: view-simulation]\n\`\`\`json\n${JSON.stringify(simulationJson, null, 2)}\n\`\`\``
                    };
                    this.messages.push(toolResultMessage);

                    // Now make a follow-up API call to let LLM continue with the data
                    await this.continueWithToolResult();

                } catch (error) {
                    console.error('Tool call failed:', error);
                    // Replace indicator with error message
                    const indicator = document.getElementById('smart-tool-indicator');
                    if (indicator) {
                        indicator.querySelector('.smart-actions-tool-message').textContent = 'Tool call failed';
                        indicator.style.borderColor = 'var(--error-color)';
                    }
                    this.addMessage('system', `Tool call failed: ${error.message}`);
                }
            }
        }

        /**
         * Continue conversation after tool execution
         */
        async continueWithToolResult() {
            try {
                // Set loading state for continuation
                this.setLoading(true, 'loading');

                // Prepare messages for continuation
                const conversationMessages = this.prepareCachedConversation();

                // Create placeholder for streaming response
                let assistantMessageDiv = null;
                let currentContent = '';

                // Get continuation from AI with streaming
                const response = await this.client.sendMessage(this.config, conversationMessages, {
                    streaming: true,
                    onChunk: (chunk, fullText) => {
                        currentContent = fullText;

                        // Update or create assistant message div
                        if (!assistantMessageDiv) {
                            // Remove loading indicator first
                            const loadingDiv = document.getElementById('smart-loading-indicator');
                            if (loadingDiv) loadingDiv.remove();

                            // Create the message div
                            assistantMessageDiv = this.createStreamingMessageDiv('assistant');
                        }

                        // Update content with markdown rendering
                        this.updateStreamingMessage(assistantMessageDiv, currentContent);
                    }
                });

                // Final update with complete response
                if (assistantMessageDiv) {
                    this.updateStreamingMessage(assistantMessageDiv, response);
                    assistantMessageDiv.classList.remove('smart-message-streaming');
                } else {
                    this.addMessage('assistant', response);
                }

                this.messages.push({ role: 'assistant', content: response });

            } catch (error) {
                this.addMessage('system', `Error continuing after tool call: ${error.message}`);
            } finally {
                this.setLoading(false);
            }
        }

        /**
         * Show tool execution indicator
         * @param {string} message - Message to display
         */
        showToolIndicator(message) {
            // Remove existing indicator if present
            this.hideToolIndicator();

            const indicator = document.createElement('div');
            indicator.className = 'smart-actions-tool-indicator';
            indicator.id = 'smart-tool-indicator';
            indicator.innerHTML = `
                <div class="smart-actions-tool-icon">🔧</div>
                <div class="smart-actions-tool-message">${message}</div>
            `;

            this.elements.messages.appendChild(indicator);
            this.autoScrollIfNeeded();
        }

        /**
         * Hide tool execution indicator
         */
        hideToolIndicator() {
            const indicator = document.getElementById('smart-tool-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        /**
         * Handle scroll events on messages container
         * Detect if user has manually scrolled up from the bottom
         */
        handleMessagesScroll() {
            if (!this.elements.messages) return;

            const container = this.elements.messages;
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

            // If user scrolls back to bottom, reset the flag
            if (isAtBottom) {
                this.userHasScrolled = false;
            } else {
                // User has scrolled up from the bottom
                this.userHasScrolled = true;
            }
        }

        /**
         * Auto-scroll to bottom only if user hasn't manually scrolled up
         */
        autoScrollIfNeeded() {
            if (!this.elements.messages || this.userHasScrolled) return;

            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.smartActionsUI = new SmartActionsUI();
            window.smartActionsUI.init();
        });
    } else {
        window.smartActionsUI = new SmartActionsUI();
        window.smartActionsUI.init();
    }

})();