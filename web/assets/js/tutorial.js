class TutorialManager {
    constructor(tutorialData, editor, playgroundElements) {
        this.tutorialData = tutorialData;
        this.editor = editor;
        this.elements = playgroundElements; // { panel, content, nextBtn, prevBtn, etc. }
        this.isActive = false;
        this.currentStepIndex = -1;

        this.elements.nextBtn.addEventListener('click', () => this.nextStep());
        this.elements.prevBtn.addEventListener('click', () => this.prevStep());
        if (this.elements.skipBtn) {
            this.elements.skipBtn.addEventListener('click', () => this.skipStep());
        }
        this.elements.exitBtn.addEventListener('click', () => this.end());
    }

    getPrimaryEditor() {
        return window.monacoEditor || this.editor || window.editor || null;
    }

    normalizeLegacyStepDocument(rootDoc) {
        if (!rootDoc || typeof rootDoc !== 'object' || !rootDoc.simulation) return rootDoc;

        const simulation = rootDoc.simulation;
        if (simulation.meta && simulation.meta.article_title && !simulation.meta.title) {
            simulation.meta.title = simulation.meta.article_title;
        }
        return rootDoc;
    }

    applyTutorialDefaults(rootDoc) {
        if (!rootDoc || typeof rootDoc !== 'object') return rootDoc;
        const simulation = rootDoc.simulation;
        if (!simulation || typeof simulation !== 'object') return rootDoc;

        const objects = Array.isArray(simulation?.world?.objects)
            ? simulation.world.objects
            : Array.isArray(simulation.objects)
                ? simulation.objects
                : [];

        const defaultStateByType = {
            actor: 'available',
            equipment: 'idle',
            service: 'available',
            display: 'off',
            screen_element: 'hidden',
            digital_object: 'available'
        };

        objects.forEach((obj) => {
            if (!obj || typeof obj !== 'object') return;
            const type = typeof obj.type === 'string' ? obj.type : '';
            const defaultState = defaultStateByType[type];
            if (!defaultState) return;

            if (!obj.properties || typeof obj.properties !== 'object' || Array.isArray(obj.properties)) {
                obj.properties = {};
            }

            const currentState = obj.properties.state;
            if (typeof currentState !== 'string' || !currentState.trim()) {
                obj.properties.state = defaultState;
            }
        });

        return rootDoc;
    }

    ensureWorkSpecV2Document(initialDoc) {
        if (!initialDoc || typeof initialDoc !== 'object') return initialDoc;

        let rootDoc;
        try {
            rootDoc = JSON.parse(JSON.stringify(initialDoc));
        } catch (error) {
            console.warn('Tutorial: failed to clone step document, using original.', error);
            rootDoc = initialDoc;
        }

        const sim = rootDoc?.simulation;
        const isV2 = sim?.schema_version === '2.0' && sim?.world && sim?.process;
        if (isV2) return this.applyTutorialDefaults(rootDoc);

        if (window.WorkSpecMigration && typeof window.WorkSpecMigration.migrate === 'function') {
            try {
                const migrated = window.WorkSpecMigration.migrate(rootDoc, {
                    addSchema: true,
                    defaultCurrency: 'USD',
                    defaultLocale: 'en-US',
                    defaultTimezone: 'UTC'
                });
                return this.applyTutorialDefaults(migrated);
            } catch (error) {
                console.warn('Tutorial: step migration to WorkSpec v2 failed; falling back to legacy shape.', error);
            }
        }

        return this.applyTutorialDefaults(this.normalizeLegacyStepDocument(rootDoc));
    }

    start() {
        this.isActive = true;
        this.elements.panel.style.display = 'flex';
        document.body.classList.add('tutorial-active'); // For hiding buttons via CSS

        // Keep menu buttons enabled during tutorial

        // Force auto-render ON
        if (window.autoRender === false) {
            window.autoRender = true;
            window.updateAutoRenderUI();
        }

        this.loadStep(0);
    }

    end() {
        this.isActive = false;
        this.currentStepIndex = -1; // Reset the step index
        this.elements.panel.style.display = 'none';
        document.body.classList.remove('tutorial-active');
        
        // Load the default sample simulation (from playground.js)
        if (window.sampleSimulation) {
            this.editor.setValue(JSON.stringify(window.sampleSimulation, null, 2));
        }

        // Menu buttons remain enabled throughout tutorial

        if (window.autoRender) {
            window.debounceRender();
        }
        window.validateJSON();
    }

    enableMenuButtons() {
        // Re-enable all header buttons
        const buttons = [
            'load-sample-btn',
            'format-json-btn', 
            'clear-editor-btn',
            'add-task-btn',
            'add-actor-btn',
            'add-resource-btn',
            'auto-render-toggle',
            'fullscreen-btn',
            'undo-btn',
            'submit-btn'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.style.pointerEvents = 'auto';
                button.style.opacity = '1';
            }
        });

        // Re-enable player controls
        const playerButtons = [
            'player-play-pause-btn',
            'player-speed-select'
        ];
        
        playerButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.style.pointerEvents = 'auto';
                button.style.opacity = '1';
            }
        });
    }

    disableMenuButtons() {
        // Disable header buttons during tutorial
        const buttons = [
            'load-sample-btn',
            'format-json-btn', 
            'clear-editor-btn',
            'add-task-btn',
            'add-actor-btn',
            'add-resource-btn',
            'auto-render-toggle',
            'fullscreen-btn',
            'undo-btn',
            'submit-btn'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.style.pointerEvents = 'none';
                button.style.opacity = '0.5';
            }
        });

        // Disable player controls during tutorial  
        const playerButtons = [
            'player-play-pause-btn',
            'player-speed-select'
        ];
        
        playerButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.style.pointerEvents = 'none';
                button.style.opacity = '0.5';
            }
        });
    }

    loadStep(index) {
        if (index < 0 || index >= this.tutorialData.steps.length) return;
        
        this.currentStepIndex = index;
        const step = this.tutorialData.steps[index];
        const totalSteps = this.tutorialData?.steps?.length || 1;
        const progressPercent = Math.max(0, Math.min(100, ((index + 1) / totalSteps) * 100));

        this.elements.title.textContent = step.title;
        this.elements.instructions.innerHTML = step.instructions;

        this.elements.panel.style.setProperty('--tutorial-progress', `${progressPercent}%`);
        const header = this.elements.title?.closest('.tutorial-header');
        if (header) {
            header.setAttribute('data-step', `Step ${index + 1} of ${totalSteps}`);
        }

        const stepDocument = this.ensureWorkSpecV2Document(step.initial_json);
        const activeEditor = this.getPrimaryEditor();
        if (activeEditor && typeof activeEditor.setValue === 'function') {
            activeEditor.setValue(JSON.stringify(stepDocument, null, 2));
        }

        this.updateNavButtons();
        
        if (window.renderSimulation) {
            window.renderSimulation();
        }
        
        // For steps involving space editor, ensure content is visible
        if (step.id === 'space_design_challenge' && window.spaceEditor) {
            // Small delay to ensure rendering is complete
            setTimeout(() => {
                window.spaceEditor.ensureContentVisible();
            }, 100);
        }

        // Ensure step status updates immediately, even if editor events do not fire.
        this.runStepValidation();
    }

    runStepValidation() {
        if (!this.isActive) return;

        // First, run the main validation engine to update the validation panel.
        // This gives the user feedback from the full metrics catalog.
        if (window.validateJSON) {
            window.validateJSON();
        }

        // Now, run the specific check for this tutorial step to see if it's "solved".
        const step = this.tutorialData.steps[this.currentStepIndex];
        const validationConfig = step.validation;
        
        if (validationConfig.type === 'none') {
            this.setStepCompleted(true, step.success_message);
            return;
        }

        try {
            const activeEditor = this.getPrimaryEditor();
            if (!activeEditor || typeof activeEditor.getValue !== 'function') {
                this.setStepCompleted(false);
                return;
            }

            const currentJson = JSON.parse(activeEditor.getValue());
            let isSuccess = false;

            if (validationConfig.type === 'custom_function') {
                const funcName = validationConfig.function_name;
                if (typeof TutorialValidators[funcName] === 'function') {
                    // The custom validator for this step determines if the user can proceed.
                    isSuccess = TutorialValidators[funcName](currentJson.simulation);
                } else {
                    console.error(`Tutorial validation function not found: ${funcName}`);
                }
            }
            
            this.setStepCompleted(isSuccess, step.success_message);
        } catch (e) {
            this.setStepCompleted(false); // JSON is invalid, so not complete.
        }
    }
    
    setStepCompleted(isCompleted, successMessage = "") {
        if (isCompleted) {
            this.elements.nextBtn.disabled = false;
            this.elements.status.innerHTML = `<div class="validation-success">${successMessage}</div>`;
            this.elements.status.style.display = 'block';
        } else {
            this.elements.nextBtn.disabled = true;
            this.elements.status.style.display = 'none';
        }
    }

    updateNavButtons() {
        this.elements.prevBtn.disabled = (this.currentStepIndex <= 0);
        // Next button is handled by setStepCompleted
    }

    nextStep() {
        // If we're at the last step, end the tutorial
        if (this.currentStepIndex >= this.tutorialData.steps.length - 1) {
            this.end();
        } else {
            this.loadStep(this.currentStepIndex + 1);
        }
    }

    prevStep() {
        this.loadStep(this.currentStepIndex - 1);
    }

    skipStep() {
        // Force complete the current step and move to the next part immediately.
        const step = this.tutorialData.steps[this.currentStepIndex];
        this.setStepCompleted(true, step.success_message || "Step skipped!");
        this.nextStep();
    }
}
