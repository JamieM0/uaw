// Smart Actions UI - Event wiring, modal management, and chat rendering
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    if (typeof SmartActionsCrypto === 'undefined' ||
        typeof SmartActionsStorage === 'undefined' ||
        typeof SmartActionsAnalysis === 'undefined' ||
        typeof SmartActionsMarkdown === 'undefined') {
        throw new Error('Smart Actions modules are missing required dependencies.');
    }

    const state = {
        initialized: false,
        hasEncryptedConfig: false,
        setupMode: 'new',
        analysis: {
            context: null,
            messages: [],
            isLoading: false,
            abortController: null,
            config: null
        }
    };

    const elements = {};
    const FIXED_TEMPERATURE_HINT = 'This model uses a fixed temperature of 1.';
    const SetupModes = {
        NEW: 'new',
        LOCKED: 'locked',
        UNLOCKED: 'unlocked'
    };

    function providerSupportsCustomTemperature(provider, model) {
        if (!provider) {
            return true;
        }
        const normalizedProvider = String(provider).toLowerCase();
        const normalizedModel = String(model || '').toLowerCase();
        if (normalizedProvider === 'openai') {
            return !/^gpt-5/.test(normalizedModel);
        }
        return true;
    }

    function cacheElements() {
        elements.dropdown = document.getElementById('smart-actions-dropdown');
        elements.analysisTrigger = document.getElementById('smart-action-analysis');
        elements.setupTrigger = document.getElementById('smart-action-setup');
        elements.setupOverlay = document.getElementById('smart-actions-setup-overlay');
        elements.analysisOverlay = document.getElementById('smart-actions-analysis-overlay');
        elements.setupForm = document.getElementById('smart-setup-form');
        elements.setupPassword = document.getElementById('smart-setup-password-new');
        elements.setupPasswordConfirm = document.getElementById('smart-setup-password-confirm');
        elements.setupProvider = document.getElementById('smart-setup-provider');
        elements.setupModel = document.getElementById('smart-setup-model');
        elements.setupBaseUrl = document.getElementById('smart-setup-base-url');
        elements.setupApiKey = document.getElementById('smart-setup-api-key');
        elements.setupTemperature = document.getElementById('smart-setup-temperature');
        elements.setupTemperatureHint = document.getElementById('smart-setup-temperature-hint');
        elements.setupMaxTokens = document.getElementById('smart-setup-max-tokens');
        elements.setupOrganization = document.getElementById('smart-setup-organization');
        elements.setupLabel = document.getElementById('smart-setup-label');
        elements.setupError = document.getElementById('smart-setup-error');
        elements.setupSuccess = document.getElementById('smart-setup-success');
        elements.setupSaveButton = document.getElementById('smart-setup-save-btn');
        elements.setupCloseButtons = elements.setupOverlay?.querySelectorAll('[data-smart-close="setup"]') || [];
        elements.setupLockView = document.getElementById('smart-setup-lock-view');
        elements.setupUnlockPassword = document.getElementById('smart-setup-password');
        elements.setupUnlockButton = document.getElementById('smart-setup-unlock-btn');
        elements.setupUnlockError = document.getElementById('smart-setup-unlock-error');
        elements.setupResetButton = document.getElementById('smart-setup-reset-btn');
        elements.providerKeyLabel = document.querySelector('[data-provider-key-label]');
        elements.setupPasswordFields = document.querySelector('[data-smart-password-fields]');
        elements.passwordSection = document.querySelector('[data-smart-password-section]');
        elements.secureSection = document.querySelector('[data-smart-secure-section]');
        elements.setupPasswordHint = document.querySelector('[data-smart-password-hint]');
        elements.setupPasswordLockedMessage = document.querySelector('[data-smart-password-locked]');

        elements.analysisCloseButtons = elements.analysisOverlay?.querySelectorAll('[data-smart-close="analysis"]') || [];
        elements.chatLog = document.getElementById('smart-actions-chat-log');
        elements.chatForm = document.getElementById('smart-actions-chat-form');
        elements.chatInput = document.getElementById('smart-actions-chat-input');
        elements.chatSendButton = document.getElementById('smart-actions-send-btn');
        elements.chatRestartButton = document.getElementById('smart-actions-restart-btn');
        elements.analysisError = document.getElementById('smart-actions-analysis-error');
        elements.sessionLabel = document.getElementById('smart-actions-session-label');
        elements.sidebar = document.getElementById('smart-actions-sidebar');
        elements.snapshot = document.getElementById('smart-actions-snapshot');
        elements.refreshContextButton = document.getElementById('smart-actions-refresh-context');
    }

    function bindEvents() {
        if (elements.analysisTrigger) {
            elements.analysisTrigger.addEventListener('click', handleAnalysisClick);
        }
        if (elements.setupTrigger) {
            elements.setupTrigger.addEventListener('click', handleSetupClick);
        }
        elements.setupCloseButtons.forEach(button => {
            button.addEventListener('click', () => closeOverlay(elements.setupOverlay));
        });
        elements.analysisCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                abortInFlightRequest();
                closeOverlay(elements.analysisOverlay);
            });
        });
        if (elements.setupProvider) {
            elements.setupProvider.addEventListener('change', handleProviderChange);
        }
        if (elements.setupModel) {
            const handleModelInputChange = () => {
                updateTemperatureControls();
                try {
                    SmartActionsStorage.savePlainPreferences?.({
                        provider: elements.setupProvider?.value || '',
                        model: elements.setupModel?.value?.trim() || ''
                    });
                } catch (e) { /* ignore */ }
            };
            elements.setupModel.addEventListener('input', handleModelInputChange);
            elements.setupModel.addEventListener('blur', handleModelInputChange);
        }
        if (elements.setupForm) {
            elements.setupForm.addEventListener('submit', handleSetupSubmit);
        }
        if (elements.setupUnlockButton) {
            elements.setupUnlockButton.addEventListener('click', handleUnlockSubmit);
        }
        if (elements.setupResetButton) {
            elements.setupResetButton.addEventListener('click', handleSetupReset);
        }
        if (elements.chatForm) {
            elements.chatForm.addEventListener('submit', handleChatSubmit);
        }
        if (elements.chatRestartButton) {
            elements.chatRestartButton.addEventListener('click', () => startAnalysisSession(true));
        }
        if (elements.refreshContextButton) {
            elements.refreshContextButton.addEventListener('click', refreshSnapshot);
        }
        document.addEventListener('keydown', handleGlobalKeydown);
    }

    function getSetupSnapshot() {
        const encrypted = SmartActionsStorage.loadEncryptedConfig();
        const unlocked = SmartActionsStorage.getUnlockedConfiguration();
        const password = SmartActionsStorage.getUnlockedPassword();
        const hasEncrypted = Boolean(encrypted);
        const hasUnlocked = Boolean(unlocked && password);
        const mode = !hasEncrypted ? SetupModes.NEW : (hasUnlocked ? SetupModes.UNLOCKED : SetupModes.LOCKED);
        return {
            encrypted,
            unlocked,
            password,
            hasEncrypted,
            hasUnlocked,
            mode
        };
    }

    function applySetupSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        state.hasEncryptedConfig = snapshot.hasEncrypted;
        state.setupMode = snapshot.mode;
        switch (snapshot.mode) {
            case SetupModes.LOCKED:
                showLockView();
                // Prefill provider/model from plaintext prefs while locked
                populateSetupForm(null, false);
                break;
            case SetupModes.UNLOCKED:
                hideLockView();
                populateSetupForm(snapshot.unlocked || null, true);
                break;
            default:
                hideLockView();
                populateSetupForm(null, false);
        }
    }

    function handleGlobalKeydown(event) {
        if (event.key === 'Escape') {
            if (elements.analysisOverlay && elements.analysisOverlay.style.display === 'flex') {
                abortInFlightRequest();
                closeOverlay(elements.analysisOverlay);
            } else if (elements.setupOverlay && elements.setupOverlay.style.display === 'flex') {
                closeOverlay(elements.setupOverlay);
            }
        }
    }

    function openOverlay(overlay) {
        if (!overlay) {
            return;
        }
        overlay.style.display = 'flex';
        document.body.classList.add('smart-actions-modal-open');
    }

    function closeOverlay(overlay) {
        if (!overlay) {
            return;
        }
        overlay.style.display = 'none';
        if (!isAnyOverlayOpen()) {
            document.body.classList.remove('smart-actions-modal-open');
        }
    }

    function isAnyOverlayOpen() {
        return [elements.analysisOverlay, elements.setupOverlay].some(el => el && el.style.display === 'flex');
    }

    function sanitize(text) {
        return typeof sanitizeHTML === 'function' ? sanitizeHTML(text) : String(text || '');
    }

    function setTemperatureHint(message) {
        if (!elements.setupTemperatureHint) {
            return;
        }
        if (!message) {
            elements.setupTemperatureHint.hidden = true;
            elements.setupTemperatureHint.textContent = '';
        } else {
            elements.setupTemperatureHint.hidden = false;
            elements.setupTemperatureHint.textContent = message;
        }
    }

    function updateTemperatureControls() {
        if (!elements.setupTemperature) {
            return;
        }
        const provider = elements.setupProvider ? elements.setupProvider.value : '';
        const model = elements.setupModel ? elements.setupModel.value : '';
        const supportsCustom = providerSupportsCustomTemperature(provider, model);
        if (supportsCustom) {
            elements.setupTemperature.disabled = false;
            setTemperatureHint('');
        } else {
            elements.setupTemperature.disabled = true;
            elements.setupTemperature.value = '1';
            setTemperatureHint(FIXED_TEMPERATURE_HINT);
        }
    }

    function clearSetupMessages() {
        if (elements.setupError) {
            elements.setupError.hidden = true;
            elements.setupError.textContent = '';
        }
        if (elements.setupSuccess) {
            elements.setupSuccess.hidden = true;
            elements.setupSuccess.textContent = '';
        }
    }

    function showSetupError(message) {
        if (!elements.setupError) {
            return;
        }
        elements.setupError.hidden = false;
        elements.setupError.textContent = message;
    }

    function showSetupSuccess(message) {
        if (!elements.setupSuccess) {
            return;
        }
        elements.setupSuccess.hidden = false;
        elements.setupSuccess.textContent = message;
    }

    function handleSetupClick(event) {
        event.preventDefault();
        openSetupModal();
    }

    function handleAnalysisClick(event) {
        event.preventDefault();
        openAnalysisModal();
    }

    function openSetupModal() {
        clearSetupMessages();
        if (!SmartActionsCrypto.isCryptoSupported()) {
            showSetupError('Your browser does not support the Web Crypto API required for encryption.');
            openOverlay(elements.setupOverlay);
            return;
        }
        applySetupSnapshot(getSetupSnapshot());
        openOverlay(elements.setupOverlay);
    }

    function showLockView() {
        if (elements.setupLockView) {
            elements.setupLockView.hidden = false;
        }
        // Keep form visible so provider/model can be changed while locked
        if (elements.setupForm) {
            elements.setupForm.hidden = false;
        }
        if (elements.passwordSection) {
            elements.passwordSection.hidden = true;
        }
        if (elements.secureSection) {
            elements.secureSection.hidden = true;
        }
        if (elements.setupUnlockPassword) {
            elements.setupUnlockPassword.value = '';
            setTimeout(() => elements.setupUnlockPassword?.focus(), 50);
        }
        if (elements.setupSaveButton) {
            elements.setupSaveButton.disabled = true;
            elements.setupSaveButton.title = 'Unlock to save secure settings';
        }
        setTemperatureHint('');
    }

    function hideLockView() {
        if (elements.setupLockView) {
            elements.setupLockView.hidden = true;
        }
        if (elements.setupForm) {
            elements.setupForm.hidden = false;
        }
        if (elements.passwordSection) {
            elements.passwordSection.hidden = false;
        }
        if (elements.secureSection) {
            elements.secureSection.hidden = false;
        }
        if (elements.setupUnlockError) {
            elements.setupUnlockError.hidden = true;
            elements.setupUnlockError.textContent = '';
        }
        if (elements.setupSaveButton) {
            elements.setupSaveButton.disabled = false;
            elements.setupSaveButton.title = '';
        }
    }

    async function handleUnlockSubmit() {
        if (!elements.setupUnlockPassword) {
            return;
        }
        const password = elements.setupUnlockPassword.value.trim();
        if (!password) {
            if (elements.setupUnlockError) {
                elements.setupUnlockError.hidden = false;
                elements.setupUnlockError.textContent = 'Please enter the encryption password to continue.';
            }
            return;
        }
        const snapshot = getSetupSnapshot();
        if (!snapshot.hasEncrypted || !snapshot.encrypted) {
            applySetupSnapshot(snapshot);
            return;
        }
        try {
            const decrypted = await SmartActionsCrypto.decryptConfig(password, snapshot.encrypted);
            SmartActionsStorage.setUnlockedConfiguration(decrypted, password);
            applySetupSnapshot({
                encrypted: snapshot.encrypted,
                unlocked: SmartActionsStorage.getUnlockedConfiguration(),
                password,
                hasEncrypted: true,
                hasUnlocked: true,
                mode: SetupModes.UNLOCKED
            });
            if (elements.setupUnlockPassword) {
                elements.setupUnlockPassword.value = '';
            }
            showSetupSuccess('Configuration unlocked. Update settings and save to apply changes.');
        } catch (error) {
            if (elements.setupUnlockError) {
                elements.setupUnlockError.hidden = false;
                elements.setupUnlockError.textContent = error.message;
            }
        }
    }

    function handleSetupReset() {
        if (typeof window.confirm === 'function') {
            const confirmed = window.confirm('Reset Smart Actions configuration? Stored API keys will be removed.');
            if (!confirmed) {
                return;
            }
        }
        SmartActionsStorage.clearConfiguration();
        applySetupSnapshot(getSetupSnapshot());
        showSetupSuccess('Configuration reset. Enter new credentials to continue.');
    }

    function populateSetupForm(config, isExisting) {
        clearSetupMessages();
        if (!elements.setupProvider) {
            return;
        }
        if (elements.setupForm) {
            elements.setupForm.reset();
        }
        if (!config) {
            // Prefill provider/model from plaintext prefs if available
            const prefs = SmartActionsStorage.loadPlainPreferences?.() || null;
            elements.setupProvider.value = (prefs && prefs.provider) || '';
            elements.setupModel.value = (prefs && prefs.model) || '';
            elements.setupTemperature.value = 0.2;
            elements.setupMaxTokens.value = 20000;
            togglePasswordRequirements(true);
            updateProviderKeyLabel(elements.setupProvider.value);
            updateTemperatureControls();
            return;
        }
        elements.setupProvider.value = config.provider || '';
        elements.setupModel.value = config.model || '';
        elements.setupBaseUrl.value = config.baseUrl || '';
        elements.setupApiKey.value = config.apiKey || '';
        elements.setupTemperature.value = config.temperature !== undefined ? config.temperature : 0.2;
        elements.setupMaxTokens.value = config.maxTokens || 20000;
        elements.setupOrganization.value = config.organization || '';
        elements.setupLabel.value = config.label || '';
        togglePasswordRequirements(!isExisting);
        updateProviderKeyLabel(config.provider);
        updateTemperatureControls();
        setTimeout(() => elements.setupProvider?.dispatchEvent(new Event('change')), 0);
    }

    function togglePasswordRequirements(required) {
        if (!elements.setupPassword || !elements.setupPasswordConfirm) {
            return;
        }
        elements.setupPassword.required = required;
        elements.setupPasswordConfirm.required = required;
        elements.setupPassword.disabled = !required;
        elements.setupPasswordConfirm.disabled = !required;
        elements.setupPassword.value = '';
        elements.setupPasswordConfirm.value = '';
        if (required) {
            elements.setupPassword.placeholder = 'Create encryption password';
            elements.setupPasswordConfirm.placeholder = 'Re-enter password';
        } else {
            elements.setupPassword.placeholder = 'Leave blank to keep existing password';
            elements.setupPasswordConfirm.placeholder = 'Re-enter to change password';
        }
        if (elements.setupPasswordFields) {
            elements.setupPasswordFields.hidden = !required;
        }
        if (elements.setupPasswordHint) {
            elements.setupPasswordHint.hidden = !required;
        }
        if (elements.setupPasswordLockedMessage) {
            elements.setupPasswordLockedMessage.hidden = required;
        }
    }

    function handleProviderChange() {
        const provider = elements.setupProvider.value;
        updateProviderKeyLabel(provider);
        if (!elements.setupApiKey) {
            return;
        }
        if (provider === 'ollama') {
            elements.setupApiKey.value = '';
            elements.setupApiKey.disabled = true;
            elements.setupApiKey.placeholder = 'Not required for local Ollama';
        } else {
            elements.setupApiKey.disabled = false;
            elements.setupApiKey.placeholder = 'Paste your API key';
        }
        updateTemperatureControls();
        // Persist plaintext prefs as user selects
        try {
            SmartActionsStorage.savePlainPreferences?.({
                provider,
                model: elements.setupModel?.value?.trim() || ''
            });
        } catch (e) {
            // non-fatal
        }
    }

    function updateProviderKeyLabel(provider) {
        if (!elements.providerKeyLabel) {
            return;
        }
        const labelMap = {
            openai: 'API Key (sk-...)',
            openrouter: 'API Key (OpenRouter)',
            claude: 'API Key (Claude / Anthropic)',
            gemini: 'API Key (Gemini)',
            ollama: 'API Key (not required for local Ollama)'
        };
        elements.providerKeyLabel.textContent = labelMap[provider] || 'API Key';
    }

    async function handleSetupSubmit(event) {
        event.preventDefault();
        clearSetupMessages();
        if (!SmartActionsCrypto.isCryptoSupported()) {
            showSetupError('Encryption is not supported in this browser.');
            return;
        }
        const provider = elements.setupProvider.value;
        const model = elements.setupModel.value.trim();
        const baseUrl = elements.setupBaseUrl.value.trim();
        const apiKey = elements.setupApiKey.value.trim();
        const supportsCustomTemperature = providerSupportsCustomTemperature(provider, model);
        const temperatureRaw = Number(elements.setupTemperature.value);
        const normalizedTemperature = supportsCustomTemperature ? temperatureRaw : 1;
        const maxTokens = Number(elements.setupMaxTokens.value);
        const organization = elements.setupOrganization.value.trim();
        const label = elements.setupLabel.value.trim();
        const password = elements.setupPassword.value.trim();
        const passwordConfirm = elements.setupPasswordConfirm.value.trim();

        if (!provider) {
            showSetupError('Select an API provider to continue.');
            return;
        }
        if (!model) {
            showSetupError('Specify a model to use for Smart Analysis.');
            return;
        }
        if (provider !== 'ollama' && !apiKey) {
            showSetupError('Provide an API key for the selected provider.');
            return;
        }
        if (supportsCustomTemperature) {
            if (Number.isNaN(temperatureRaw) || temperatureRaw < 0 || temperatureRaw > 2) {
                showSetupError('Temperature must be between 0 and 2.');
                return;
            }
        }
        if (Number.isNaN(maxTokens) || maxTokens < 256) {
            showSetupError('Max tokens must be at least 256.');
            return;
        }

        const existingConfig = SmartActionsStorage.getUnlockedConfiguration();
        const existingPassword = SmartActionsStorage.getUnlockedPassword();
        let encryptionPassword = password;

        if (!existingConfig && !encryptionPassword) {
            showSetupError('Set an encryption password to protect your API key.');
            return;
        }
        if (encryptionPassword && encryptionPassword !== passwordConfirm) {
            showSetupError('Passwords do not match.');
            return;
        }
        if (!encryptionPassword) {
            if (!existingPassword) {
                showSetupError('Unlock the existing configuration before saving changes.');
                return;
            }
            encryptionPassword = existingPassword;
        }

        const config = {
            provider,
            model,
            baseUrl,
            apiKey,
            temperature: normalizedTemperature,
            maxTokens,
            organization,
            label
        };

        try {
            if (!supportsCustomTemperature && elements.setupTemperature) {
                elements.setupTemperature.value = '1';
            }
            const encrypted = await SmartActionsCrypto.encryptConfig(encryptionPassword, config);
            SmartActionsStorage.saveEncryptedConfig(encrypted);
            SmartActionsStorage.setUnlockedConfiguration(config, encryptionPassword);
            // Save plaintext preferences (provider/model)
            SmartActionsStorage.savePlainPreferences?.({ provider, model });
            applySetupSnapshot(getSetupSnapshot());
            showSetupSuccess('Smart Actions configuration saved successfully.');
        } catch (error) {
            showSetupError(error.message);
        }
    }

    function openAnalysisModal() {
        const unlocked = SmartActionsStorage.getUnlockedConfiguration();
        const encrypted = SmartActionsStorage.loadEncryptedConfig();
        if (!unlocked) {
            if (encrypted) {
                openSetupModal();
                showSetupError('Enter your encryption password to unlock Smart Actions.');
                return;
            }
            openSetupModal();
            showSetupError('Configure Smart Actions before running analysis.');
            return;
        }
        state.analysis.config = unlocked;
        renderSessionLabel(unlocked.label);
        renderEmptyChatState();
        elements.analysisError.hidden = true;
        openOverlay(elements.analysisOverlay);
        setTimeout(() => elements.chatInput?.focus(), 150);
        startAnalysisSession(true);
    }

    function renderSessionLabel(label) {
        if (!elements.sessionLabel) {
            return;
        }
        if (!label) {
            elements.sessionLabel.textContent = 'Using configured Smart Actions model.';
            return;
        }
        elements.sessionLabel.textContent = sanitize(label);
    }

    function renderEmptyChatState() {
        if (!elements.chatLog) {
            return;
        }
        elements.chatLog.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'smart-actions-empty-state';
        empty.innerHTML = '<strong>Smart Analysis is ready.</strong><span>We will start by examining your current simulation context.</span>';
        elements.chatLog.appendChild(empty);
    }

    function appendMessage(role, content) {
        if (!elements.chatLog) {
            return null;
        }
        const message = document.createElement('article');
        message.className = `smart-actions-message smart-actions-message-${role}`;

        const header = document.createElement('div');
        header.className = 'smart-actions-message-header';

        const title = document.createElement('strong');
        title.textContent = role === 'assistant' ? 'Smart Analysis' : role === 'user' ? 'You' : 'System';

        const timestamp = document.createElement('span');
        timestamp.className = 'smart-actions-message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        header.appendChild(title);
        header.appendChild(timestamp);

        const body = document.createElement('div');
        body.className = 'smart-actions-message-content';

        const updateContent = (nextContent) => {
            body.innerHTML = SmartActionsMarkdown.renderMarkdown(nextContent || '');
            elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
        };

        updateContent(content);

        message.appendChild(header);
        message.appendChild(body);
        elements.chatLog.appendChild(message);
        elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
        return {
            element: message,
            updateContent
        };
    }

    function setLoading(isLoading, placeholderText, options = {}) {
        const showMessage = options.showMessage !== false;
        state.analysis.isLoading = isLoading;
        if (elements.chatSendButton) {
            elements.chatSendButton.disabled = isLoading;
        }
        if (elements.chatInput) {
            elements.chatInput.disabled = isLoading;
        }
        if (isLoading && showMessage) {
            appendMessage('system', placeholderText || 'Analyzing your simulation...');
        }
    }

    function abortInFlightRequest() {
        if (state.analysis.abortController) {
            state.analysis.abortController.abort();
            state.analysis.abortController = null;
        }
        state.analysis.isLoading = false;
    }

    async function startAnalysisSession(forceRefresh) {
        if (!state.analysis.config) {
            return;
        }
        abortInFlightRequest();
        state.analysis.messages = [];
        elements.analysisError.hidden = true;
        if (elements.chatLog) {
            elements.chatLog.innerHTML = '';
        }
        setLoading(true, 'Gathering context and generating initial analysis...');
        let assistantHandle = null;
        let streamedContent = '';
        try {
            const { context, messages } = await SmartActionsAnalysis.buildInitialMessages(forceRefresh);
            state.analysis.context = context;
            state.analysis.messages = messages.slice();
            renderSnapshot(context);
            // The last appended message is the loading system note; remove it before continuing.
            if (elements.chatLog) {
                elements.chatLog.innerHTML = '';
            }
            appendMessage('user', messages[messages.length - 1].content);
            const controller = new AbortController();
            state.analysis.abortController = controller;
            assistantHandle = appendMessage('assistant', '');
            const response = await SmartActionsAnalysis.sendAnalysisRequest(state.analysis.config, messages, {
                signal: controller.signal,
                stream: true,
                onChunk(chunk) {
                    if (!chunk) {
                        return;
                    }
                    streamedContent += chunk;
                    if (assistantHandle) {
                        assistantHandle.updateContent(streamedContent);
                    }
                }
            });
            const assistantContent = response && typeof response.message === 'string' ? response.message : streamedContent;
            const finalContent = assistantContent || 'Smart Actions did not return any content.';
            if (assistantHandle) {
                assistantHandle.updateContent(finalContent);
            } else {
                appendMessage('assistant', finalContent);
            }
            state.analysis.messages.push({ role: 'assistant', content: finalContent });
        } catch (error) {
            if (assistantHandle && streamedContent === '' && assistantHandle.element?.parentNode) {
                assistantHandle.element.parentNode.removeChild(assistantHandle.element);
            }
            handleAnalysisError(error);
        } finally {
            state.analysis.abortController = null;
            setLoading(false);
        }
    }

    function handleAnalysisError(error) {
        if (!elements.analysisError) {
            return;
        }
        const isAbort = error && error.name === 'AbortError';
        if (isAbort) {
            return;
        }
        elements.analysisError.hidden = false;
        elements.analysisError.textContent = error.message || 'An unexpected error occurred while contacting the AI service.';
        appendMessage('system', 'Analysis failed. Adjust your configuration or try again later.');
    }

    async function handleChatSubmit(event) {
        event.preventDefault();
        if (!state.analysis.config || state.analysis.isLoading) {
            return;
        }
        const message = elements.chatInput.value.trim();
        if (!message) {
            return;
        }
        elements.chatInput.value = '';
        elements.analysisError.hidden = true;
        const userMessage = { role: 'user', content: message };
        state.analysis.messages.push(userMessage);
        appendMessage('user', message);
        setLoading(true, 'Smart Analysis is thinking...', { showMessage: false });
        let assistantHandle = null;
        let streamedContent = '';
        try {
            const controller = new AbortController();
            state.analysis.abortController = controller;
            assistantHandle = appendMessage('assistant', '');
            const response = await SmartActionsAnalysis.sendAnalysisRequest(state.analysis.config, state.analysis.messages, {
                signal: controller.signal,
                stream: true,
                onChunk(chunk) {
                    if (!chunk) {
                        return;
                    }
                    streamedContent += chunk;
                    if (assistantHandle) {
                        assistantHandle.updateContent(streamedContent);
                    }
                }
            });
            const assistantContent = response && typeof response.message === 'string' ? response.message : streamedContent;
            const assistantMessage = { role: 'assistant', content: assistantContent || 'Smart Actions did not return any content.' };
            state.analysis.messages.push(assistantMessage);
            if (assistantHandle) {
                assistantHandle.updateContent(assistantMessage.content);
            } else {
                appendMessage('assistant', assistantMessage.content);
            }
        } catch (error) {
            if (assistantHandle && streamedContent === '' && assistantHandle.element?.parentNode) {
                assistantHandle.element.parentNode.removeChild(assistantHandle.element);
            }
            handleAnalysisError(error);
        } finally {
            state.analysis.abortController = null;
            setLoading(false);
        }
    }

    async function refreshSnapshot() {
        try {
            const context = await SmartActionsAnalysis.fetchContext(true);
            state.analysis.context = context;
            renderSnapshot(context);
            appendMessage('system', 'Context refreshed. Use the latest data for your next request.');
        } catch (error) {
            appendMessage('system', `Unable to refresh context: ${error.message}`);
        }
    }

    function renderSnapshot(context) {
        if (!elements.snapshot) {
            return;
        }
        const container = elements.snapshot;
        container.innerHTML = '';
        if (!context || !context.currentSimulation || !context.currentSimulation.simulation) {
            container.innerHTML = '<p>No simulation is currently loaded.</p>';
            return;
        }
        const simulation = context.currentSimulation.simulation;
        const meta = simulation.meta || {};
        const stats = document.createElement('dl');
        stats.className = 'smart-actions-sidebar-content';

        function addStat(label, value) {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            stats.appendChild(dt);
            stats.appendChild(dd);
        }

        addStat('Title', sanitize(meta.title || 'Untitled'));
        addStat('Industry', sanitize(meta.industry || 'Unspecified'));
        addStat('Complexity', sanitize(meta.complexity_level || 'Unspecified'));
        addStat('Objects', Array.isArray(simulation.objects) ? simulation.objects.length : 0);
        addStat('Tasks', Array.isArray(simulation.tasks) ? simulation.tasks.length : 0);

        if (context.validationResults) {
            const validation = context.validationResults;
            addStat('Errors', validation.errorCount || 0);
            addStat('Warnings', validation.warningCount || 0);
            addStat('Suggestions', validation.suggestionCount || 0);
        }

        container.appendChild(stats);
    }

    function initializeSmartActions() {
        if (state.initialized) {
            return;
        }

        // Hide smart actions dropdown on production domain
        if (window.location.hostname === 'universalautomation.wiki') {
            const smartActionsDropdown = document.getElementById('smart-actions-dropdown');
            if (smartActionsDropdown) {
                smartActionsDropdown.style.display = 'none';
            }
            return; // Skip initialization entirely on production
        }

        cacheElements();
        if (!elements.dropdown || !elements.setupOverlay || !elements.analysisOverlay) {
            console.warn('SmartActions: Required UI elements are missing. Smart Actions will not initialize.');
            return;
        }
        bindEvents();
        updateProviderKeyLabel('');
        updateTemperatureControls();
        const snapshot = getSetupSnapshot();
        state.hasEncryptedConfig = snapshot.hasEncrypted;
        state.setupMode = snapshot.mode;
        state.initialized = true;
    }

    window.initializeSmartActions = initializeSmartActions;
})();
