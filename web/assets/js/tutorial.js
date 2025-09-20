class TutorialManager {
    constructor(tutorialData, editor, playgroundElements) {
        this.tutorialData = tutorialData;
        this.editor = editor;
        this.elements = playgroundElements; // { panel, content, nextBtn, prevBtn, etc. }
        this.isActive = false;
        this.currentStepIndex = -1;

        this.elements.nextBtn.addEventListener('click', () => this.nextStep());
        this.elements.prevBtn.addEventListener('click', () => this.prevStep());
        this.elements.exitBtn.addEventListener('click', () => this.end());
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

        this.elements.title.textContent = step.title;
        this.elements.instructions.innerHTML = step.instructions;
        
        this.editor.setValue(JSON.stringify(step.initial_json, null, 2));

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
            const currentJson = JSON.parse(this.editor.getValue());
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
        // Force complete the current step and move to next
        const step = this.tutorialData.steps[this.currentStepIndex];
        this.setStepCompleted(true, step.success_message || "Step skipped!");
        this.elements.nextBtn.disabled = false;
    }
}