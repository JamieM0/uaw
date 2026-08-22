// UAW Playground v2 - one optional, project-aware agent surface
(function () {
    'use strict';

    const DEFAULT_ENDPOINT = 'http://127.0.0.1:4317';

    const escapeHTML = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    class PlaygroundAgent {
        constructor() {
            this.drawer = null;
            this.endpoint = this.loadConfig().endpoint || DEFAULT_ENDPOINT;
            this.connected = false;
            this.running = false;
            this.abortController = null;
            this.conversations = this.loadConversations();
        }

        loadConfig() {
            return { endpoint: window.UAWProjectStore?.getCurrent?.()?.settings?.agentEndpoint };
        }

        saveConfig() {
            const project = this.project;
            if (!project) return;
            project.settings = { ...(project.settings || {}), agentEndpoint: this.endpoint };
            window.UAWProjectStore.put(project).catch((error) => console.error('Failed to save agent endpoint:', error));
        }

        loadConversations() {
            return {};
        }

        saveConversations() {
            const project = this.project;
            if (!project) return;
            project.settings = { ...(project.settings || {}), agentConversation: this.conversation };
            window.UAWProjectStore.put(project).catch((error) => console.error('Failed to save agent conversation:', error));
        }

        get project() {
            return window.UAWProjectStore?.getCurrent?.() || null;
        }

        get projectId() {
            return this.project?.id || 'unassigned';
        }

        get conversation() {
            if (!this.conversations[this.projectId]) {
                this.conversations[this.projectId] = this.project?.settings?.agentConversation || { threadId: null, messages: [] };
            }
            return this.conversations[this.projectId];
        }

        initialize() {
            this.drawer = document.getElementById('uaw-agent-drawer');
            if (!this.drawer || this.drawer.dataset.agentReady === 'true') return;
            this.drawer.dataset.agentReady = 'true';
            this.render();
            this.setConnectionState('offline', 'Local bridge not connected');

            window.addEventListener('uaw:agent-opened', () => {
                this.renderConversation();
                this.drawer.querySelector('#uaw-agent-input')?.focus();
            });
            window.addEventListener('uaw:project-opened', () => this.renderConversation());
            window.addEventListener('uaw:settings-rendered', () => this.syncSettingsState());
        }

        render() {
            this.drawer.innerHTML = `
                <div class="uaw-agent-header">
                    <div><span class="uaw-agent-header__icon">AI</span><div><strong>Agent</strong><small id="uaw-agent-project-label">Project assistant</small></div></div>
                    <button type="button" class="uaw-icon-button" id="uaw-agent-close" aria-label="Close Agent">×</button>
                </div>
                <div class="uaw-agent-status" id="uaw-agent-status" data-state="offline">
                    <span class="uaw-agent-status__dot"></span>
                    <span id="uaw-agent-status-label">Local bridge not connected</span>
                    <button type="button" id="uaw-agent-setup-toggle">Setup</button>
                </div>
                <div class="uaw-agent-setup" id="uaw-agent-setup" hidden>
                    <label for="uaw-agent-endpoint">Local bridge address</label>
                    <div><input id="uaw-agent-endpoint" type="url" value="${escapeHTML(this.endpoint)}" spellcheck="false"><button type="button" id="uaw-agent-connect">Connect</button></div>
                    <p>Start the optional bridge from <code>web/agent-bridge</code>. Connecting may ask permission to communicate with software on this device. Codex receives a project snapshot and returns a reviewable WorkSpec proposal.</p>
                </div>
                <div class="uaw-agent-conversation" id="uaw-agent-conversation"></div>
                <form class="uaw-agent-composer" id="uaw-agent-form">
                    <textarea id="uaw-agent-input" rows="3" placeholder="Ask about this project or request a change…" aria-label="Message Agent"></textarea>
                    <div><span>Changes require review</span><button type="button" id="uaw-agent-stop" hidden>Stop</button><button type="submit" id="uaw-agent-send">Send</button></div>
                </form>
            `;

            this.drawer.querySelector('#uaw-agent-close').addEventListener('click', () => window.UAWPlaygroundShell?.toggleAgent(false));
            this.drawer.querySelector('#uaw-agent-setup-toggle').addEventListener('click', () => {
                const setup = this.drawer.querySelector('#uaw-agent-setup');
                setup.hidden = !setup.hidden;
                if (!setup.hidden) window.UAWMotion?.dialogEnter?.('#uaw-agent-setup');
            });
            this.drawer.querySelector('#uaw-agent-connect').addEventListener('click', () => {
                this.endpoint = this.drawer.querySelector('#uaw-agent-endpoint').value.replace(/\/$/, '') || DEFAULT_ENDPOINT;
                this.saveConfig();
                this.checkConnection();
            });
            this.drawer.querySelector('#uaw-agent-form').addEventListener('submit', (event) => {
                event.preventDefault();
                this.send();
            });
            this.drawer.querySelector('#uaw-agent-input').addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    this.send();
                }
            });
            this.drawer.querySelector('#uaw-agent-stop').addEventListener('click', () => this.stop());
            this.renderConversation();
        }

        async checkConnection() {
            this.setConnectionState('checking');
            try {
                const response = await fetch(`${this.endpoint}/health`, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(2200)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const health = await response.json();
                this.connected = true;
                this.setConnectionState('connected', health.codexAvailable === false ? 'Bridge ready · Codex unavailable' : 'Codex bridge connected');
            } catch (_error) {
                this.connected = false;
                this.setConnectionState('offline', 'Local bridge not connected');
            }
            this.syncSettingsState();
        }

        setConnectionState(state, label) {
            const status = this.drawer?.querySelector('#uaw-agent-status');
            const text = this.drawer?.querySelector('#uaw-agent-status-label');
            if (status) status.dataset.state = state;
            if (text) text.textContent = label || (state === 'checking' ? 'Checking local bridge…' : 'Local bridge not connected');
            document.body.classList.toggle('uaw-agent-connected', state === 'connected');
        }

        syncSettingsState() {
            const target = document.getElementById('uaw-settings-agent-state');
            if (target) target.textContent = this.connected ? 'Codex bridge connected' : 'Local bridge not connected';
        }

        renderConversation() {
            const container = this.drawer?.querySelector('#uaw-agent-conversation');
            if (!container) return;
            const projectLabel = this.drawer.querySelector('#uaw-agent-project-label');
            if (projectLabel) projectLabel.textContent = this.project?.name || 'Project assistant';

            const messages = this.conversation.messages;
            if (!messages.length) {
                container.innerHTML = `
                    <div class="uaw-agent-empty">
                        <strong>Work with the current project</strong>
                        <p>The Agent can explain WorkSpec, generate tasks, diagnose validation errors and propose optimisations.</p>
                        <div class="uaw-agent-prompts">
                            <button type="button" data-agent-prompt="Explain the current WorkSpec and identify the most important missing information.">Explain this WorkSpec</button>
                            <button type="button" data-agent-prompt="Validate the current WorkSpec and propose fixes for every error.">Fix validation errors</button>
                            <button type="button" data-agent-prompt="Inspect the schedule for conflicts, unnecessary waiting and resource bottlenecks.">Inspect the schedule</button>
                        </div>
                    </div>`;
                container.querySelectorAll('[data-agent-prompt]').forEach((button) => button.addEventListener('click', () => {
                    this.drawer.querySelector('#uaw-agent-input').value = button.dataset.agentPrompt;
                    this.send();
                }));
                return;
            }

            container.innerHTML = messages.map((message, index) => {
                if (message.role === 'user') {
                    return `<article class="uaw-agent-message uaw-agent-message--user"><span>You</span><p>${escapeHTML(message.content)}</p></article>`;
                }
                const activities = Array.isArray(message.activities) && message.activities.length
                    ? `<div class="uaw-agent-activities">${message.activities.map((activity) => `<details><summary><span class="uaw-tool-state ${escapeHTML(activity.status || 'completed')}"></span>${escapeHTML(activity.label || activity.tool || 'Tool')}</summary><pre>${escapeHTML(activity.detail || '')}</pre></details>`).join('')}</div>`
                    : '';
                const proposal = message.proposedWorkSpec
                    ? `<div class="uaw-agent-proposal"><strong>WorkSpec changes proposed</strong><span>${escapeHTML(message.proposalSummary || 'Review the complete diff before applying.')}</span><div><button type="button" data-reject-proposal="${index}">Reject</button><button type="button" data-review-proposal="${index}">Review changes</button></div></div>`
                    : '';
                return `<article class="uaw-agent-message uaw-agent-message--assistant"><span>Agent</span>${activities}<div class="uaw-agent-response">${this.renderText(message.content)}</div>${proposal}</article>`;
            }).join('');

            container.querySelectorAll('[data-review-proposal]').forEach((button) => button.addEventListener('click', () => this.reviewProposal(Number(button.dataset.reviewProposal))));
            container.querySelectorAll('[data-reject-proposal]').forEach((button) => button.addEventListener('click', () => this.rejectProposal(Number(button.dataset.rejectProposal))));
            container.scrollTop = container.scrollHeight;
        }

        renderText(value) {
            return escapeHTML(value || '')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/^/, '<p>')
                .replace(/$/, '</p>');
        }

        appendMessage(message) {
            this.conversation.messages.push({
                id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
                createdAt: new Date().toISOString(),
                ...message
            });
            this.conversation.messages = this.conversation.messages.slice(-60);
            this.saveConversations();
            this.renderConversation();
        }

        setRunning(running) {
            this.running = running;
            const send = this.drawer.querySelector('#uaw-agent-send');
            const stop = this.drawer.querySelector('#uaw-agent-stop');
            const input = this.drawer.querySelector('#uaw-agent-input');
            send.disabled = running;
            stop.hidden = !running;
            input.disabled = running;
        }

        async send() {
            if (this.running) return;
            const input = this.drawer.querySelector('#uaw-agent-input');
            const message = input.value.trim();
            if (!message) return;
            input.value = '';
            this.appendMessage({ role: 'user', content: message });

            if (!this.connected) {
                this.appendMessage({
                    role: 'assistant',
                    content: 'The local Codex bridge is not connected. Open Setup, start the bridge, and try again.'
                });
                this.drawer.querySelector('#uaw-agent-setup').hidden = false;
                return;
            }

            this.setRunning(true);
            this.abortController = new AbortController();
            const working = {
                role: 'assistant',
                content: 'Working on the project…',
                activities: [
                    { tool: 'read_project', label: 'Read project snapshot', status: 'completed', detail: this.project?.name || 'Current project' },
                    { tool: 'validate_workspec', label: 'Validate current WorkSpec', status: 'running', detail: 'Canonical WorkSpec validator' },
                    { tool: 'codex_thread', label: 'Run Codex thread', status: 'queued', detail: 'Waiting for validation' }
                ],
                transient: true
            };
            this.appendMessage(working);
            const transientIndex = this.conversation.messages.length - 1;

            try {
                const workSpec = window.monacoEditor?.getValue?.() || window.editor?.getValue?.() || '';
                const response = await fetch(`${this.endpoint}/v1/agent/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        projectId: this.projectId,
                        projectName: this.project?.name || 'Untitled project',
                        threadId: this.conversation.threadId,
                        message,
                        workSpec,
                        workspace: window.UAWPlaygroundShell?.workspace || 'build'
                    }),
                    signal: this.abortController.signal
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || `Bridge returned HTTP ${response.status}`);

                this.conversation.messages.splice(transientIndex, 1);
                this.conversation.threadId = payload.threadId || this.conversation.threadId;
                this.appendMessage({
                    role: 'assistant',
                    content: payload.finalResponse || 'Codex completed the request.',
                    activities: payload.activities || [],
                    proposedWorkSpec: payload.proposedWorkSpec || null,
                    proposalSummary: this.summarizeProposal(workSpec, payload.proposedWorkSpec)
                });
            } catch (error) {
                this.conversation.messages.splice(transientIndex, 1);
                this.appendMessage({
                    role: 'assistant',
                    content: error.name === 'AbortError' ? 'The run was stopped.' : `The Agent could not complete this request: ${error.message}`,
                    activities: [{ tool: 'codex_thread', label: 'Codex thread', status: 'failed', detail: error.message }]
                });
            } finally {
                this.setRunning(false);
                this.abortController = null;
                this.saveConversations();
            }
        }

        stop() {
            this.abortController?.abort();
        }

        summarizeProposal(original, proposed) {
            if (!proposed) return '';
            const oldLines = String(original).split('\n');
            const newLines = String(proposed).split('\n');
            let changed = Math.abs(oldLines.length - newLines.length);
            const shared = Math.min(oldLines.length, newLines.length);
            for (let index = 0; index < shared; index += 1) {
                if (oldLines[index] !== newLines[index]) changed += 1;
            }
            return `${changed} changed line${changed === 1 ? '' : 's'} · validation required before apply`;
        }

        reviewProposal(index) {
            const message = this.conversation.messages[index];
            if (!message?.proposedWorkSpec) return;
            const original = window.monacoEditor?.getValue?.() || '';
            const proposed = message.proposedWorkSpec;
            let proposalErrors = [];

            try {
                const parsed = JSON.parse(proposed);
                if (!window.WorkSpecValidator?.validate) {
                    window.UAWPlaygroundShell?.toast('Canonical WorkSpec validation is unavailable; the proposal cannot be reviewed safely');
                    return;
                }
                const validation = window.WorkSpecValidator.validate(parsed);
                proposalErrors = (validation?.problems || []).filter((problem) => problem.severity === 'error');
                if (proposalErrors.length) {
                    window.UAWPlaygroundShell?.toast(`Proposal has ${proposalErrors.length} validation error${proposalErrors.length === 1 ? '' : 's'} and cannot be applied`);
                }
            } catch (error) {
                window.UAWPlaygroundShell?.toast(`Proposal is not valid JSON: ${error.message}`);
                return;
            }

            window.UAWPlaygroundShell?.setWorkspace('source');
            if (window.SmartActionsDiff) {
                const diff = new window.SmartActionsDiff();
                diff.show(original, proposed, async (approved) => {
                    if (proposalErrors.length) {
                        window.UAWPlaygroundShell?.toast('Fix the proposal validation errors before applying it');
                        return;
                    }
                    await window.UAWProjectStore?.createCheckpoint?.('Before Agent changes');
                    window.monacoEditor?.setValue?.(approved);
                    window.validateJSON?.();
                    message.proposedWorkSpec = null;
                    message.proposalSummary = 'Applied';
                    this.saveConversations();
                    this.renderConversation();
                    window.UAWPlaygroundShell?.toast('Agent changes applied', { action: 'Undo', onAction: () => document.getElementById('undo-btn')?.click() });
                }, () => {
                    window.UAWPlaygroundShell?.toast('Agent changes left unapplied');
                });
            } else {
                window.UAWPlaygroundShell?.toast('Diff viewer is unavailable');
            }
        }

        rejectProposal(index) {
            const message = this.conversation.messages[index];
            if (!message) return;
            message.proposedWorkSpec = null;
            message.proposalSummary = 'Rejected';
            this.saveConversations();
            this.renderConversation();
        }
    }

    const agent = new PlaygroundAgent();
    window.UAWPlaygroundAgent = agent;
    window.addEventListener('uaw:shell-ready', () => agent.initialize());
    if (document.readyState !== 'loading') setTimeout(() => agent.initialize(), 0);
})();
