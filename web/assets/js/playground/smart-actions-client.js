// Smart Actions Client - API communication with LLM providers
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * API client for communicating with various LLM providers
     * Supports: OpenAI, OpenRouter, Claude, Gemini, Ollama, and custom endpoints
     */
    class SmartActionsClient {
        constructor() {
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
         * @param {Object} options - Additional options
         * @returns {Promise} API response
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
                    const errorText = await response.text();
                    throw new Error(`${provider.name} API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                return this.extractMessage(config.provider, data);

            } catch (error) {
                console.error('SmartActionsClient: API request failed:', error);
                throw new Error(`Failed to communicate with ${config.provider}: ${error.message}`);
            }
        }

        /**
         * Format request for OpenAI-compatible APIs
         */
        formatOpenAIRequest(config, messages, options) {
            return {
                model: config.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                temperature: config.temperature || 0.7,
                stream: false
            };
        }

        /**
         * Format request for Claude API
         */
        formatClaudeRequest(config, messages, options) {
            // Claude requires system message separately
            const systemMessage = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            return {
                model: config.model,
                temperature: config.temperature || 0.7,
                system: systemMessage ? systemMessage.content : undefined,
                messages: chatMessages.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                }))
            };
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
                stream: false
            };
        }

        /**
         * Extract message content from API response
         */
        extractMessage(provider, response) {
            switch (provider) {
                case 'openai':
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
         * Test API configuration
         */
        async testConnection(config) {
            try {
                const testMessages = [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Say "Connection successful" if you can read this.' }
                ];

                const response = await this.sendMessage(config, testMessages);
                return {
                    success: true,
                    message: response,
                    provider: config.provider
                };
            } catch (error) {
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