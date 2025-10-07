// Smart Actions Client - API communication with LLM providers
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * API client for communicating with various LLM providers
     * Supports: OpenAI, GitHub Models, OpenRouter, Claude, Gemini, Ollama, and custom endpoints
     */
    class SmartActionsClient {
        constructor() {
            // Tool definitions for native tool calling (OpenAI-compatible format)
            this.toolDefinitions = {
                'view-simulation': {
                    type: 'function',
                    function: {
                        name: 'view_simulation',
                        description: 'Access the complete simulation JSON structure. Use this when you need to see the full simulation details, inspect specific objects/tasks, or perform detailed analysis.',
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                },
                'find-and-replace': {
                    type: 'function',
                    function: {
                        name: 'find_and_replace',
                        description: 'Edit the simulation JSON by finding and replacing a specific string. The system will show a diff view for user approval before applying changes.',
                        parameters: {
                            type: 'object',
                            properties: {
                                old_string: {
                                    type: 'string',
                                    description: 'The exact text to find in the simulation JSON (must match exactly, including whitespace and formatting)'
                                },
                                new_string: {
                                    type: 'string',
                                    description: 'The text to replace it with (must be valid JSON when replacing structured content)'
                                }
                            },
                            required: ['old_string', 'new_string']
                        }
                    }
                }
            };

            this.providers = {
                openai: {
                    name: 'OpenAI',
                    endpoint: 'https://api.openai.com/v1/chat/completions',
                    headers: (config) => ({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`,
                        ...(config.organization ? { 'OpenAI-Organization': config.organization } : {})
                    }),
                    formatRequest: this.formatOpenAIRequest.bind(this)
                },
                github: {
                    name: 'GitHub Models',
                    endpoint: 'https://models.github.ai/inference/chat/completions',
                    headers: (config) => ({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    }),
                    formatRequest: this.formatOpenAIRequest.bind(this)
                },
                openrouter: {
                    name: 'OpenRouter',
                    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
                    headers: (config) => ({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`,
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Universal Automation Wiki'
                    }),
                    formatRequest: this.formatOpenAIRequest.bind(this)
                },
                claude: {
                    name: 'Anthropic Claude',
                    endpoint: 'https://api.anthropic.com/v1/messages',
                    headers: (config) => ({
                        'Content-Type': 'application/json',
                        'x-api-key': config.apiKey,
                        'anthropic-version': '2023-06-01'
                    }),
                    formatRequest: this.formatClaudeRequest.bind(this)
                },
                gemini: {
                    name: 'Google Gemini',
                    endpoint: (config) => `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
                    headers: () => ({
                        'Content-Type': 'application/json'
                    }),
                    formatRequest: this.formatGeminiRequest.bind(this)
                },
                ollama: {
                    name: 'Ollama',
                    endpoint: 'http://localhost:11434/api/chat',
                    headers: () => ({
                        'Content-Type': 'application/json'
                    }),
                    formatRequest: this.formatOllamaRequest.bind(this)
                },
                custom: {
                    name: 'Custom Endpoint',
                    endpoint: (config) => config.baseUrl,
                    headers: (config) => ({
                        'Content-Type': 'application/json',
                        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
                        ...(config.organization ? { 'Organization': config.organization } : {})
                    }),
                    formatRequest: this.formatOpenAIRequest.bind(this) // Default to OpenAI format
                }
            };
        }

        /**
         * Send message to configured LLM provider
         * @param {Object} config - API configuration
         * @param {Array} messages - Chat messages
         * @param {Object} options - Additional options (streaming, onChunk)
         * @returns {Promise} API response (full text or final text if streaming)
         */
        async sendMessage(config, messages, options = {}) {
            try {
                const provider = this.providers[config.provider];
                if (!provider) {
                    throw new Error(`Unknown provider: ${config.provider}`);
                }

                const endpoint = typeof provider.endpoint === 'function'
                    ? provider.endpoint(config)
                    : provider.endpoint;

                const headers = provider.headers(config);
                const body = provider.formatRequest(config, messages, options);
                const requestBodyString = JSON.stringify(body);

                const tokenCount = this.estimateTokenCount(messages);
                const totalInputSize = requestBodyString.length;

                // Check for large requests (either character or token limits)
                const needsPermission = !this.isDomainAllowed() ||
                                      totalInputSize > 50000 ||
                                      tokenCount > 10000;

                if (needsPermission) {
                    const requestInfo = {
                        destination: endpoint,
                        model: config.model,
                        provider: provider.name,
                        tokenCount: tokenCount,
                        totalInputSize: totalInputSize,
                        systemMessageLength: messages.find(m => m.role === 'system')?.content?.length || 0,
                        userMessageCount: messages.filter(m => m.role === 'user').length,
                        assistantMessageCount: messages.filter(m => m.role === 'assistant').length,
                        isLargeRequest: totalInputSize > 50000 || tokenCount > 10000
                    };

                    const permission = await this.requestPermission(requestInfo);
                    if (!permission) {
                        throw new Error('Request cancelled by user');
                    }
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: requestBodyString
                });

                if (!response.ok) {
                    let errorText = await response.text();

                    // Try to parse error as JSON for better error messages
                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.error) {
                            errorText = errorJson.error.message || errorJson.error;
                        }
                    } catch (e) {
                        // Keep original error text if not JSON
                    }

                    console.error('SmartActionsClient: API error response:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorText,
                        provider: provider.name
                    });

                    throw new Error(`${provider.name} API error (${response.status}): ${errorText}`);
                }

                // Handle streaming if enabled
                if (options.streaming && response.body) {
                    return await this.handleStreamingResponse(config.provider, response, options.onChunk);
                }

                // Handle non-streaming response
                const data = await response.json();
                const message = this.extractMessage(config.provider, data);
                const toolCalls = this.extractToolCalls(config.provider, data);

                // Return both message and tool calls for UI to handle
                return {
                    content: message,
                    toolCalls: toolCalls,
                    rawResponse: data // Include for debugging
                };

            } catch (error) {
                console.error('SmartActionsClient: API request failed:', error);
                throw new Error(`Failed to communicate with ${config.provider}: ${error.message}`);
            }
        }

        /**
         * Handle streaming response from API
         * @param {string} provider - Provider name
         * @param {Response} response - Fetch response object
         * @param {Function} onChunk - Callback for each chunk
         * @returns {Promise<Object>} Object with content and toolCalls
         */
        async handleStreamingResponse(provider, response, onChunk) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';
            const toolCallsMap = {}; // Accumulate tool calls by index

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;

                        // Skip SSE comments (lines starting with ':' like ": OPENROUTER PROCESSING")
                        if (trimmed.startsWith(':')) continue;

                        // Remove 'data: ' prefix for SSE format
                        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
                        if (!jsonStr) continue;

                        try {
                            const parsed = JSON.parse(jsonStr);

                            // Extract text content chunk
                            const chunk = this.extractStreamChunk(provider, parsed);
                            if (chunk) {
                                fullText += chunk;
                                if (onChunk) {
                                    onChunk(chunk, fullText);
                                }
                            }

                            // Extract tool call deltas (OpenAI format)
                            if (provider === 'openai' || provider === 'github' || provider === 'openrouter' || provider === 'custom') {
                                const delta = parsed.choices?.[0]?.delta;
                                if (delta?.tool_calls) {
                                    for (const toolCallDelta of delta.tool_calls) {
                                        const index = toolCallDelta.index;

                                        // Initialize tool call if first time seeing this index
                                        if (!toolCallsMap[index]) {
                                            toolCallsMap[index] = {
                                                id: toolCallDelta.id || `call_${index}`,
                                                type: 'function',
                                                function: {
                                                    name: toolCallDelta.function?.name || '',
                                                    arguments: ''
                                                }
                                            };
                                        }

                                        // Accumulate function name if provided
                                        if (toolCallDelta.function?.name) {
                                            toolCallsMap[index].function.name = toolCallDelta.function.name;
                                        }

                                        // Accumulate function arguments
                                        if (toolCallDelta.function?.arguments) {
                                            toolCallsMap[index].function.arguments += toolCallDelta.function.arguments;
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // Skip malformed JSON chunks (shouldn't happen after comment filtering)
                            console.warn('SmartActionsClient: Failed to parse chunk:', jsonStr, e);
                        }
                    }
                }

                // Convert toolCallsMap to array
                const toolCalls = Object.keys(toolCallsMap).length > 0
                    ? Object.values(toolCallsMap)
                    : null;

                // Return both content and tool calls
                return {
                    content: fullText || 'No response received',
                    toolCalls: toolCalls
                };
            } catch (error) {
                console.error('SmartActionsClient: Streaming error:', error);
                throw new Error(`Streaming failed: ${error.message}`);
            }
        }

        /**
         * Extract text chunk from streaming response
         * @param {string} provider - Provider name
         * @param {Object} data - Parsed chunk data
         * @returns {string|null} Text chunk or null
         */
        extractStreamChunk(provider, data) {
            switch (provider) {
                case 'openai':
                case 'github':
                case 'openrouter':
                case 'custom':
                    return data.choices?.[0]?.delta?.content || null;

                case 'claude':
                    // Claude uses different streaming format
                    if (data.type === 'content_block_delta') {
                        return data.delta?.text || null;
                    }
                    return null;

                case 'gemini':
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;

                case 'ollama':
                    return data.message?.content || null;

                default:
                    return null;
            }
        }

        /**
         * Format request for OpenAI-compatible APIs
         */
        formatOpenAIRequest(config, messages, options) {
            const request = {
                model: config.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                temperature: config.temperature || 0.7,
                stream: options.streaming === true // Only stream if explicitly enabled
            };

            // Add tools if native tool calling is enabled and supported
            if (options.enableTools !== false) {
                request.tools = Object.values(this.toolDefinitions);
                request.tool_choice = 'auto'; // Let model decide when to use tools
            }

            return request;
        }

        /**
         * Format request for Claude API
         */
        formatClaudeRequest(config, messages, options) {
            // Claude requires system message separately
            const systemMessage = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const request = {
                model: config.model,
                temperature: config.temperature || 0.7,
                system: systemMessage ? systemMessage.content : undefined,
                messages: chatMessages.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                })),
                stream: options.streaming === true, // Only stream if explicitly enabled
                max_tokens: 4096
            };

            // Add tools if native tool calling is enabled and supported
            // Claude uses the same tool format as OpenAI since their Messages API update
            if (options.enableTools !== false) {
                request.tools = Object.values(this.toolDefinitions);
                request.tool_choice = { type: 'auto' }; // Claude requires object format
            }

            return request;
        }

        /**
         * Format request for Gemini API
         */
        formatGeminiRequest(config, messages, options) {
            const systemMessage = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            // Gemini uses different role names and structure
            const contents = chatMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const request = {
                contents,
                generationConfig: {
                    temperature: config.temperature || 0.7,
                    topP: 0.8,
                    topK: 40
                }
            };

            // Add system instruction if available
            if (systemMessage) {
                request.systemInstruction = {
                    parts: [{ text: systemMessage.content }]
                };
            }

            return request;
        }

        /**
         * Format request for Ollama API
         */
        formatOllamaRequest(config, messages, options) {
            return {
                model: config.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                options: {
                    temperature: config.temperature || 0.7
                },
                stream: options.streaming === true // Only stream if explicitly enabled
            };
        }

        /**
         * Extract message content from API response
         */
        extractMessage(provider, response) {
            switch (provider) {
                case 'openai':
                case 'github':
                case 'openrouter':
                case 'custom':
                    return response.choices?.[0]?.message?.content || 'No response received';

                case 'claude':
                    return response.content?.[0]?.text || 'No response received';

                case 'gemini':
                    return response.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';

                case 'ollama':
                    return response.message?.content || 'No response received';

                default:
                    throw new Error(`Unknown provider for response parsing: ${provider}`);
            }
        }

        /**
         * Check if response contains native tool calls
         * @param {string} provider - Provider name
         * @param {Object} response - API response
         * @returns {Array|null} Array of tool calls or null
         */
        extractToolCalls(provider, response) {
            switch (provider) {
                case 'openai':
                case 'github':
                case 'openrouter':
                case 'custom':
                    return response.choices?.[0]?.message?.tool_calls || null;

                case 'claude':
                    // Claude returns tool_use content blocks
                    const toolUseBlocks = response.content?.filter(block => block.type === 'tool_use');
                    if (toolUseBlocks && toolUseBlocks.length > 0) {
                        // Convert Claude format to OpenAI-compatible format
                        return toolUseBlocks.map(block => ({
                            id: block.id,
                            type: 'function',
                            function: {
                                name: block.name,
                                arguments: JSON.stringify(block.input)
                            }
                        }));
                    }
                    return null;

                default:
                    // Other providers don't support native tool calling yet
                    return null;
            }
        }

        /**
         * Parse tool call arguments safely
         * @param {string} argsString - JSON string of arguments
         * @returns {Object} Parsed arguments
         */
        parseToolArguments(argsString) {
            try {
                return JSON.parse(argsString);
            } catch (error) {
                console.warn('SmartActionsClient: Failed to parse tool arguments:', argsString, error);
                return {};
            }
        }

        /**
         * Test API configuration
         */
        async testConnection(config) {
            try {
                const testMessages = [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Say "Connection successful" if you can read this.' }
                ];

                console.log('SmartActionsClient: Testing connection with config:', {
                    provider: config.provider,
                    model: config.model,
                    hasApiKey: !!config.apiKey
                });

                // Disable tools for connection test
                const response = await this.sendMessage(config, testMessages, {
                    streaming: false,
                    enableTools: false
                });

                // Handle both string (legacy) and object (new) response formats
                const messageContent = typeof response === 'string' ? response : response.content;

                console.log('SmartActionsClient: Test connection successful, response:', messageContent.substring(0, 100));

                return {
                    success: true,
                    message: messageContent,
                    provider: config.provider
                };
            } catch (error) {
                console.error('SmartActionsClient: Test connection failed:', error);
                return {
                    success: false,
                    error: error.message,
                    provider: config.provider
                };
            }
        }

        /**
         * Get provider display information
         */
        getProviderInfo(provider) {
            const info = this.providers[provider];
            return info ? { name: info.name, provider } : null;
        }

        /**
         * Get list of all supported providers
         */
        getSupportedProviders() {
            return Object.keys(this.providers).map(key => ({
                value: key,
                name: this.providers[key].name
            }));
        }

        /**
         * Validate configuration
         */
        validateConfig(config) {
            const errors = [];

            if (!config.provider) {
                errors.push('Provider is required');
            } else if (!this.providers[config.provider]) {
                errors.push('Invalid provider selected');
            }

            if (!config.model) {
                errors.push('Model is required');
            }

            if (config.provider !== 'ollama' && !config.apiKey) {
                errors.push('API key is required for this provider');
            }

            if (config.provider === 'custom' && !config.baseUrl) {
                errors.push('Base URL is required for custom provider');
            }

            if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
                errors.push('Temperature must be between 0 and 2');
            }


            return {
                valid: errors.length === 0,
                errors
            };
        }

        /**
         * Check if current domain is allowed (universalautomation.wiki)
         */
        isDomainAllowed() {
            return window.location.hostname === 'universalautomation.wiki';
        }

        /**
         * Estimate token count for messages (rough approximation)
         */
        estimateTokenCount(messages) {
            const totalText = messages.map(m => m.content).join(' ');
            // Rough estimate: ~4 characters per token
            return Math.ceil(totalText.length / 4);
        }

        /**
         * Request permission from user to send API request
         */
        async requestPermission(requestInfo) {
            return new Promise((resolve) => {
                this.showPermissionModal(requestInfo, resolve);
            });
        }

        /**
         * Show permission modal
         */
        showPermissionModal(requestInfo, callback) {
            // Remove existing modal if present
            this.hidePermissionModal();

            const modal = document.createElement('div');
            modal.className = 'smart-actions-modal';
            modal.id = 'smart-actions-permission-modal';

            // Determine the primary reason for the permission request
            const isDebugMode = !this.isDomainAllowed();
            const isLargeRequest = requestInfo.isLargeRequest;

            let warningContent = '';
            let titleIcon = '🔒';
            let titleText = 'API Request Permission';

            if (isLargeRequest && isDebugMode) {
                titleIcon = '⚠️';
                titleText = 'Large Request Permission';
                warningContent = `
                    <div class="permission-warning large-request">
                        <p><strong>Large Request Detected:</strong> This request is ${requestInfo.tokenCount > 10000 ? 'over 10,000 tokens' : 'over 50,000 characters'}. This may use significant API credits.</p>
                        <p><strong>Debug Mode:</strong> Running on non-production domain.</p>
                    </div>
                `;
            } else if (isLargeRequest) {
                titleIcon = '⚠️';
                titleText = 'Large Request Permission';
                warningContent = `
                    <div class="permission-warning large-request">
                        <p><strong>Large Request Detected:</strong> This request is ${requestInfo.tokenCount > 10000 ? 'over 10,000 tokens' : 'over 50,000 characters'}. This may use significant API credits.</p>
                    </div>
                `;
            } else {
                warningContent = `
                    <div class="permission-warning">
                        <p><strong>Debug Mode:</strong> You are running on a non-production domain. This request will send data to an external API.</p>
                    </div>
                `;
            }

            modal.innerHTML = `
                <div class="smart-actions-modal-content">
                    <div class="smart-actions-modal-header">
                        <h3 class="smart-actions-modal-title">${titleIcon} ${titleText}</h3>
                    </div>
                    ${warningContent}
                    <div class="permission-details">
                        <h4>Request Summary:</h4>
                        <div class="permission-info-grid">
                            <div class="permission-info-item">
                                <span class="permission-label">Provider:</span>
                                <span class="permission-value">${this.escapeHtml(requestInfo.provider)}</span>
                            </div>
                            <div class="permission-info-item">
                                <span class="permission-label">Estimated Tokens:</span>
                                <span class="permission-value ${requestInfo.tokenCount > 10000 ? 'highlight-large' : ''}">${requestInfo.tokenCount.toLocaleString()}</span>
                            </div>
                            <div class="permission-info-item">
                                <span class="permission-label">Request Size:</span>
                                <span class="permission-value ${requestInfo.totalInputSize > 50000 ? 'highlight-large' : ''}">${(requestInfo.totalInputSize / 1024).toFixed(1)} KB</span>
                            </div>
                            <div class="permission-info-item">
                                <span class="permission-label">Messages:</span>
                                <span class="permission-value">${requestInfo.userMessageCount} user, ${requestInfo.assistantMessageCount} assistant</span>
                            </div>
                        </div>
                    </div>
                    <div class="smart-actions-form-actions">
                        <button type="button" class="smart-actions-btn-secondary" id="permission-cancel">
                            Cancel
                        </button>
                        <button type="button" class="smart-actions-btn-primary" id="permission-allow">
                            ${isLargeRequest ? 'Send Large Request' : 'Allow Request'}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            const cancelBtn = modal.querySelector('#permission-cancel');
            const allowBtn = modal.querySelector('#permission-allow');

            cancelBtn.addEventListener('click', () => {
                this.hidePermissionModal();
                callback(false);
            });

            allowBtn.addEventListener('click', () => {
                this.hidePermissionModal();
                callback(true);
            });

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hidePermissionModal();
                    callback(false);
                }
            });

            // ESC key to cancel
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    this.hidePermissionModal();
                    callback(false);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }

        /**
         * Hide permission modal
         */
        hidePermissionModal() {
            const modal = document.getElementById('smart-actions-permission-modal');
            if (modal) {
                modal.remove();
            }
        }

        /**
         * Escape HTML for security
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // Export to global scope
    window.SmartActionsClient = SmartActionsClient;

})();