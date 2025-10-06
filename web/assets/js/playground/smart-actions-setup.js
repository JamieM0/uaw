// Smart Actions Setup - API configuration modal
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * Handles Smart Actions setup and configuration
     * Provides secure API key storage and provider configuration
     */
    class SmartActionsSetup {
        constructor() {
            this.isVisible = false;
            this.elements = {};
            this.currentConfig = null;
            this.client = null;
            this.savedApiKeys = {};
            this.savedModelNames = {};
        }

        /**
         * Initialize setup modal
         */
        init(client) {
            this.client = client;
            this.createModal();
            this.bindEvents();
            this.loadConfig();
        }

        /**
         * Show setup modal
         */
        show() {
            if (!this.elements.modal) return;

            this.elements.modal.style.display = 'flex';
            this.isVisible = true;
            this.resetForm();
            this.loadFormData();
        }

        /**
         * Hide setup modal
         */
        hide() {
            if (!this.elements.modal) return;

            this.elements.modal.style.display = 'none';
            this.isVisible = false;
            this.clearErrors();
        }

        /**
         * Create setup modal HTML
         */
        createModal() {
            const modal = document.createElement('div');
            modal.className = 'smart-actions-modal';
            modal.id = 'smart-actions-setup-modal';
            modal.style.display = 'none';

            modal.innerHTML = `
                <div class="smart-actions-modal-content">
                    <div class="smart-actions-modal-header">
                        <h2 class="smart-actions-modal-title">Configure Smart Actions</h2>
                        <p style="color: var(--text-color-secondary); margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                            Set up your AI provider to enable Smart Actions features
                        </p>
                    </div>

                    <form id="smart-actions-setup-form" class="smart-actions-setup-form">
                        <div class="smart-actions-form-group">
                            <label class="smart-actions-label" for="setup-provider">AI Provider *</label>
                            <select class="smart-actions-select" id="setup-provider" required>
                                <option value="">Select your AI service</option>
                                <option value="openai">OpenAI</option>
                                <option value="github">GitHub Models</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="claude">Anthropic Claude</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="ollama">Ollama (Local)</option>
                                <option value="custom">Custom API Endpoint</option>
                            </select>
                        </div>

                        <div class="smart-actions-form-group">
                            <label class="smart-actions-label" for="setup-model">Model Name *</label>
                            <input
                                type="text"
                                class="smart-actions-input"
                                id="setup-model"
                                placeholder="Enter model name"
                                required
                            />
                            <small style="color: var(--text-color-secondary); font-size: 0.8rem; display: block; margin-top: 0.25rem;">
                                Check your provider's documentation for available model names
                            </small>
                        </div>

                        <div class="smart-actions-form-group" id="api-key-group">
                            <label class="smart-actions-label" for="setup-api-key">API Key *</label>
                            <input
                                type="password"
                                class="smart-actions-input"
                                id="setup-api-key"
                                placeholder="Paste your API key here"
                                autocomplete="off"
                            />
                            <small style="color: var(--text-color-secondary); font-size: 0.8rem; display: block; margin-top: 0.25rem;">
                                Keys are stored locally in your browser only
                            </small>
                        </div>

                        <div class="smart-actions-form-group" id="base-url-group" style="display: none;">
                            <label class="smart-actions-label" for="setup-base-url">API Base URL *</label>
                            <input
                                type="url"
                                class="smart-actions-input"
                                id="setup-base-url"
                                placeholder="https://your-custom-endpoint.com/v1"
                            />
                        </div>

                        <div class="smart-actions-form-group">
                            <label class="smart-actions-label" for="setup-temperature">Temperature (Creativity)</label>
                            <input
                                type="number"
                                class="smart-actions-input"
                                id="setup-temperature"
                                min="0"
                                max="2"
                                step="0.1"
                                value="0.3"
                            />
                            <small style="color: var(--text-color-secondary); font-size: 0.8rem; display: block; margin-top: 0.25rem;">
                                Lower values = more focused, Higher values = more creative (0.0 - 2.0)
                            </small>
                        </div>

                        <div class="smart-actions-form-group">
                            <label class="smart-actions-label" for="setup-organization">Organization ID (Optional)</label>
                            <input
                                type="text"
                                class="smart-actions-input"
                                id="setup-organization"
                                placeholder="For providers that require it"
                            />
                        </div>

                        <div id="setup-error" class="setup-error" style="display: none;"></div>
                        <div id="setup-success" class="setup-success" style="display: none;"></div>

                        <div class="smart-actions-form-actions">
                            <button type="button" class="smart-actions-btn-secondary" id="setup-cancel">Cancel</button>
                            <button type="button" class="smart-actions-btn-secondary" id="setup-test">Test Connection</button>
                            <button type="submit" class="smart-actions-btn-primary" id="setup-save">Save & Enable</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            // Cache elements
            this.elements.modal = modal;
            this.elements.form = document.getElementById('smart-actions-setup-form');
            this.elements.provider = document.getElementById('setup-provider');
            this.elements.model = document.getElementById('setup-model');
            this.elements.apiKey = document.getElementById('setup-api-key');
            this.elements.baseUrl = document.getElementById('setup-base-url');
            this.elements.temperature = document.getElementById('setup-temperature');
            this.elements.organization = document.getElementById('setup-organization');
            this.elements.cancelBtn = document.getElementById('setup-cancel');
            this.elements.testBtn = document.getElementById('setup-test');
            this.elements.saveBtn = document.getElementById('setup-save');
            this.elements.error = document.getElementById('setup-error');
            this.elements.success = document.getElementById('setup-success');
            this.elements.apiKeyGroup = document.getElementById('api-key-group');
            this.elements.baseUrlGroup = document.getElementById('base-url-group');
        }

        /**
         * Bind event listeners
         */
        bindEvents() {
            // Provider selection change
            this.elements.provider.addEventListener('change', () => {
                this.handleProviderChange();
            });

            // Form submission
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSave();
            });

            // Button clicks
            this.elements.cancelBtn.addEventListener('click', () => this.hide());
            this.elements.testBtn.addEventListener('click', () => this.handleTest());
            this.elements.saveBtn.addEventListener('click', () => this.handleSave());

            // Close on backdrop click
            this.elements.modal.addEventListener('click', (e) => {
                if (e.target === this.elements.modal) {
                    this.hide();
                }
            });

            // ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hide();
                }
            });
        }

        /**
         * Handle provider selection change
         */
        handleProviderChange() {
            const provider = this.elements.provider.value;

            // Show/hide fields based on provider
            if (provider === 'ollama') {
                this.elements.apiKeyGroup.style.display = 'none';
                this.elements.apiKey.required = false;
            } else {
                this.elements.apiKeyGroup.style.display = 'block';
                this.elements.apiKey.required = true;
            }

            if (provider === 'custom') {
                this.elements.baseUrlGroup.style.display = 'block';
                this.elements.baseUrl.required = true;
            } else {
                this.elements.baseUrlGroup.style.display = 'none';
                this.elements.baseUrl.required = false;
            }

            // Load saved API key for this provider
            if (provider && this.savedApiKeys && this.savedApiKeys[provider]) {
                this.elements.apiKey.value = this.savedApiKeys[provider];
            } else {
                this.elements.apiKey.value = '';
            }

            // Load saved model name for this provider
            if (provider && this.savedModelNames && this.savedModelNames[provider]) {
                this.elements.model.value = this.savedModelNames[provider];
            } else {
                // Set default models for providers if no saved model exists
                if (provider === 'openai') {
                    this.elements.model.value = 'gpt-5-mini';
                }
                else {
                    this.elements.model.value = '';
                }
            }
        }

        /**
         * Test API connection
         */
        async handleTest() {
            if (!this.client) return;

            try {
                this.setButtonState('testing');
                this.clearMessages();

                const config = this.getFormConfig();
                const validation = this.client.validateConfig(config);

                if (!validation.valid) {
                    this.showError(validation.errors.join(', '));
                    return;
                }

                const result = await this.client.testConnection(config);

                if (result.success) {
                    this.showSuccess('✅ Connection successful! Ready to save configuration.');
                } else {
                    // Log detailed error for debugging
                    console.error('SmartActionsSetup: Connection test failed:', {
                        error: result.error,
                        provider: result.provider,
                        config: { ...config, apiKey: '***' } // Don't log API key
                    });
                    this.showError(`Connection failed: ${result.error}`);
                }

            } catch (error) {
                console.error('SmartActionsSetup: Test exception:', error);
                this.showError(`Test failed: ${error.message}`);
            } finally {
                this.setButtonState('normal');
            }
        }

        /**
         * Save configuration
         */
        async handleSave() {
            if (!this.client) return;

            try {
                this.setButtonState('saving');
                this.clearMessages();

                const config = this.getFormConfig();
                const validation = this.client.validateConfig(config);

                if (!validation.valid) {
                    this.showError(validation.errors.join(', '));
                    return;
                }

                // Test connection first
                const testResult = await this.client.testConnection(config);
                if (!testResult.success) {
                    this.showError(`Cannot save: ${testResult.error}`);
                    return;
                }

                // Save configuration
                this.saveConfig(config);
                this.currentConfig = config;

                this.showSuccess('✅ Configuration saved successfully!');

                // Close modal after short delay
                setTimeout(() => {
                    this.hide();
                    // Trigger configuration changed event
                    document.dispatchEvent(new CustomEvent('smart-actions-configured', {
                        detail: { config }
                    }));
                }, 1500);

            } catch (error) {
                this.showError(`Save failed: ${error.message}`);
            } finally {
                this.setButtonState('normal');
            }
        }

        /**
         * Get configuration from form
         */
        getFormConfig() {
            return {
                provider: this.elements.provider.value,
                model: this.elements.model.value,
                apiKey: this.elements.apiKey.value,
                baseUrl: this.elements.baseUrl.value,
                temperature: parseFloat(this.elements.temperature.value),
                organization: this.elements.organization.value
            };
        }

        /**
         * Load configuration from cookies
         */
        loadConfig() {
            try {
                // Load current active config
                const configData = this.getCookie('smart-actions-config');
                if (configData) {
                    this.currentConfig = JSON.parse(configData);
                }

                // Load saved API keys and model names for all providers
                this.savedApiKeys = this.loadSavedApiKeys();
                this.savedModelNames = this.loadSavedModelNames();
            } catch (error) {
                console.warn('SmartActionsSetup: Could not load config:', error);
            }
        }

        /**
         * Load saved API keys for all providers
         */
        loadSavedApiKeys() {
            try {
                const keysData = this.getCookie('smart-actions-api-keys');
                return keysData ? JSON.parse(keysData) : {};
            } catch (error) {
                console.warn('SmartActionsSetup: Could not load API keys:', error);
                return {};
            }
        }

        /**
         * Load saved model names for all providers
         */
        loadSavedModelNames() {
            try {
                const modelsData = this.getCookie('smart-actions-model-names');
                return modelsData ? JSON.parse(modelsData) : {};
            } catch (error) {
                console.warn('SmartActionsSetup: Could not load model names:', error);
                return {};
            }
        }

        /**
         * Save configuration to secure cookies
         */
        saveConfig(config) {
            try {
                // Save the main config
                this.setCookie('smart-actions-config', JSON.stringify(config), 365);

                // Save API key for this provider (if provided)
                if (config.apiKey && config.provider) {
                    this.saveApiKey(config.provider, config.apiKey);
                }

                // Save model name for this provider (if provided)
                if (config.model && config.provider) {
                    this.saveModelName(config.provider, config.model);
                }
            } catch (error) {
                throw new Error('Could not save configuration to cookies');
            }
        }

        /**
         * Save API key for specific provider
         * Each provider's API key is stored independently to allow switching between providers
         * without losing saved credentials
         */
        saveApiKey(provider, apiKey) {
            try {
                this.savedApiKeys = this.savedApiKeys || {};
                // Store each provider's key separately by provider name
                this.savedApiKeys[provider] = apiKey;

                const serialized = JSON.stringify(this.savedApiKeys);

                // Check cookie size limit (4KB)
                if (serialized.length > 4000) {
                    console.warn('SmartActionsSetup: API keys data exceeds recommended cookie size, storing only current provider');
                    // If too large, only store current provider's key
                    this.savedApiKeys = { [provider]: apiKey };
                }

                // Save all provider keys in a single cookie
                this.setCookie('smart-actions-api-keys', JSON.stringify(this.savedApiKeys), 365);
            } catch (error) {
                console.error('SmartActionsSetup: Could not save API key:', error);
                throw error; // Propagate error so caller knows save failed
            }
        }

        /**
         * Save model name for specific provider
         * Each provider's model name is stored independently to allow switching between providers
         * without losing saved model preferences
         */
        saveModelName(provider, modelName) {
            try {
                this.savedModelNames = this.savedModelNames || {};
                // Store each provider's model name separately by provider name
                this.savedModelNames[provider] = modelName;

                const serialized = JSON.stringify(this.savedModelNames);

                // Check cookie size limit (4KB)
                if (serialized.length > 4000) {
                    console.warn('SmartActionsSetup: Model names data exceeds recommended cookie size, storing only current provider');
                    // If too large, only store current provider's model name
                    this.savedModelNames = { [provider]: modelName };
                }

                // Save all provider model names in a single cookie
                this.setCookie('smart-actions-model-names', JSON.stringify(this.savedModelNames), 365);
            } catch (error) {
                console.error('SmartActionsSetup: Could not save model name:', error);
                throw error; // Propagate error so caller knows save failed
            }
        }

        /**
         * Load form with current configuration
         */
        loadFormData() {
            if (!this.currentConfig) return;

            const config = this.currentConfig;
            this.elements.provider.value = config.provider || '';
            this.elements.model.value = config.model || '';
            this.elements.apiKey.value = config.apiKey || '';
            this.elements.baseUrl.value = config.baseUrl || '';
            this.elements.temperature.value = config.temperature || 0.3;
            this.elements.organization.value = config.organization || '';

            this.handleProviderChange();
        }

        /**
         * Reset form to defaults
         */
        resetForm() {
            this.elements.form.reset();
            this.elements.temperature.value = 0.3;
            this.clearMessages();
            this.handleProviderChange();
        }

        /**
         * Set button states
         */
        setButtonState(state) {
            const isLoading = state !== 'normal';

            this.elements.testBtn.disabled = isLoading;
            this.elements.saveBtn.disabled = isLoading;

            switch (state) {
                case 'testing':
                    this.elements.testBtn.textContent = 'Testing...';
                    break;
                case 'saving':
                    this.elements.saveBtn.textContent = 'Saving...';
                    break;
                default:
                    this.elements.testBtn.textContent = 'Test Connection';
                    this.elements.saveBtn.textContent = 'Save & Enable';
            }
        }

        /**
         * Show error message
         */
        showError(message) {
            this.elements.error.textContent = message;
            this.elements.error.style.display = 'block';
            this.elements.success.style.display = 'none';
        }

        /**
         * Show success message
         */
        showSuccess(message) {
            this.elements.success.textContent = message;
            this.elements.success.style.display = 'block';
            this.elements.error.style.display = 'none';
        }

        /**
         * Clear all messages
         */
        clearMessages() {
            this.elements.error.style.display = 'none';
            this.elements.success.style.display = 'none';
        }

        /**
         * Clear form validation errors
         */
        clearErrors() {
            this.clearMessages();
        }

        /**
         * Check if Smart Actions is configured
         */
        isConfigured() {
            return this.currentConfig !== null;
        }

        /**
         * Get current configuration
         */
        getConfig() {
            return this.currentConfig;
        }

        /**
         * Set a secure cookie
         * @param {string} name - Cookie name
         * @param {string} value - Cookie value
         * @param {number} days - Expiration in days (default 365)
         */
        setCookie(name, value, days = 365) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;

            // Set secure cookie with SameSite=Strict for security
            // Note: Secure flag requires HTTPS, omit for localhost development
            const isSecure = window.location.protocol === 'https:';
            const secureFlag = isSecure ? '; Secure' : '';

            document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/; SameSite=Strict${secureFlag}`;
        }

        /**
         * Get cookie value by name
         * @param {string} name - Cookie name
         * @returns {string|null} Cookie value or null if not found
         */
        getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');

            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
            }
            return null;
        }

        /**
         * Delete a cookie
         * @param {string} name - Cookie name
         */
        deleteCookie(name) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
        }
    }

    // Export to global scope
    window.SmartActionsSetup = SmartActionsSetup;

})();