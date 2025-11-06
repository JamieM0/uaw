// Playground Save-Load - Save/load functionality for simulations
// Universal Automation Wiki - Simulation Playground

// Constants
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Setup save/load buttons
function setupSaveLoadButtons() {
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    const feedbackBtn = document.getElementById("feedback-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openSaveDialog);
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openLoadDialog);
    }

    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", openFeedbackDialog);
    }
    
    // Setup copy save code button
    const copyBtn = document.getElementById("copy-save-code-btn");
    if (copyBtn) {
        copyBtn.addEventListener("click", function() {
            const input = document.getElementById('save-code-result');
            if (input && input.value) {
                input.select();
                input.setSelectionRange(0, 99999);
                
                // Try modern clipboard API first, fall back to execCommand
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = 'Copy';
                        }, 2000);
                    }).catch(err => {
                        console.error('Clipboard API failed:', err);
                        // Fallback to execCommand
                        try {
                            document.execCommand('copy');
                            this.textContent = 'Copied!';
                            setTimeout(() => {
                                this.textContent = 'Copy';
                            }, 2000);
                        } catch (e) {
                            console.error('Copy fallback failed:', e);
                            alert('Copy failed - please select and copy manually');
                        }
                    });
                } else {
                    // Fallback for older browsers
                    try {
                        document.execCommand('copy');
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = 'Copy';
                        }, 2000);
                    } catch (e) {
                        console.error('Copy fallback failed:', e);
                        alert('Copy failed - please select and copy manually');
                    }
                }
            }
        });
    }
}

// Simple file download function
function downloadSimulationFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Get custom metrics content for export
function getCustomMetricsContent() {
    const catalog = localStorage.getItem('uaw-metrics-catalog-custom');
    const validator = localStorage.getItem('uaw-metrics-validator-custom');

    return {
        catalog: catalog || null,
        validator: validator || null
    };
}

// Check if there are custom metrics
function hasCustomMetrics() {
    // Check if there are any custom metrics in localStorage
    const customCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
    const customValidator = localStorage.getItem('uaw-metrics-validator-custom');

    if (!customCatalog || !customValidator) return false;

    // Check if catalog has meaningful content (not just empty array)
    try {
        const catalog = JSON.parse(customCatalog);
        return Array.isArray(catalog) && catalog.length > 0;
    } catch {
        return false;
    }
}

// Load simulation from file input
function loadSimulationFromFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';

    input.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
            alert(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
            return;
        }

        // Check if it's a ZIP file
        if (file.name.endsWith('.zip')) {
            await loadFromZipFile(file);
        } else if (file.name.endsWith('.json')) {
            await loadFromJsonFile(file);
        } else {
            alert('Invalid file type. Please select a .json or .zip file.');
        }
    });

    input.click();
}

// Load simulation from JSON file
async function loadFromJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;

                // Validate it's not empty
                if (!content || content.trim() === '') {
                    alert('File is empty');
                    reject(new Error('Empty file'));
                    return;
                }

                const data = JSON.parse(content);

                // Validate that it's a simulation file
                if (!data.simulation) {
                    alert('Invalid simulation file: missing "simulation" property');
                    reject(new Error('Missing simulation property'));
                    return;
                }

                // Validate simulation structure
                if (!data.simulation.objects || !Array.isArray(data.simulation.objects)) {
                    alert('Invalid simulation file: simulation.objects must be an array');
                    reject(new Error('Invalid objects structure'));
                    return;
                }

                if (!data.simulation.tasks || !Array.isArray(data.simulation.tasks)) {
                    alert('Invalid simulation file: simulation.tasks must be an array');
                    reject(new Error('Invalid tasks structure'));
                    return;
                }

                // Load into editor
                if (typeof editor !== 'undefined' && editor) {
                    editor.setValue(JSON.stringify(data, null, 2));

                    // Auto-collapse assets object
                    setTimeout(async () => {
                        if (typeof autoCollapseAssetsObject === 'function') {
                            await autoCollapseAssetsObject(true);
                        }
                    }, 100);

                    if (typeof autoRender !== 'undefined' && autoRender) {
                        renderSimulation();
                    }

                    showNotification(`Loaded simulation from ${file.name}`);
                    resolve(data);
                } else {
                    alert('Editor not initialized');
                    reject(new Error('Editor not initialized'));
                }

            } catch (error) {
                console.error('Error loading JSON file:', error);
                alert(`Error loading file: ${error.message}`);
                reject(error);
            }
        };

        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            alert('Error reading file. Please try again.');
            reject(error);
        };

        reader.readAsText(file);
    });
}

// Load simulation from ZIP file (with custom metrics)
async function loadFromZipFile(file) {
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
        alert('ZIP file support is not available. JSZip library not loaded.');
        return;
    }

    try {
        const zip = new JSZip();
        const zipContents = await zip.loadAsync(file);

        // Extract simulation.json
        const simulationFile = zipContents.file('simulation.json');
        if (!simulationFile) {
            alert('Invalid ZIP file: missing simulation.json');
            return;
        }

        const simulationContent = await simulationFile.async('text');

        // Validate and load simulation
        let data;
        try {
            data = JSON.parse(simulationContent);
        } catch (error) {
            alert('Invalid simulation.json in ZIP: ' + error.message);
            return;
        }

        // Validate simulation structure
        if (!data.simulation) {
            alert('Invalid simulation file: missing "simulation" property');
            return;
        }

        if (!data.simulation.objects || !Array.isArray(data.simulation.objects)) {
            alert('Invalid simulation file: simulation.objects must be an array');
            return;
        }

        if (!data.simulation.tasks || !Array.isArray(data.simulation.tasks)) {
            alert('Invalid simulation file: simulation.tasks must be an array');
            return;
        }

        // Load into editor
        if (typeof editor !== 'undefined' && editor) {
            editor.setValue(JSON.stringify(data, null, 2));

            // Check for custom metrics files
            const catalogFile = zipContents.file('metrics-catalog-custom.json');
            const validatorFile = zipContents.file('simulation-validator-custom.js');

            if (catalogFile || validatorFile) {
                const loadMetrics = confirm('This ZIP file contains custom metrics. Do you want to load them? (This will replace your current custom metrics)');

                if (loadMetrics) {
                    if (catalogFile) {
                        const catalogContent = await catalogFile.async('text');
                        try {
                            // Validate JSON before storing
                            JSON.parse(catalogContent);
                            localStorage.setItem('uaw-metrics-catalog-custom', catalogContent);
                        } catch (error) {
                            console.error('Invalid metrics catalog in ZIP:', error);
                            alert('Warning: Custom metrics catalog is invalid and was not loaded.');
                        }
                    }

                    if (validatorFile) {
                        const validatorContent = await validatorFile.async('text');
                        localStorage.setItem('uaw-metrics-validator-custom', validatorContent);
                    }

                    showNotification(`Loaded simulation and custom metrics from ${file.name}`);
                } else {
                    showNotification(`Loaded simulation from ${file.name} (custom metrics not loaded)`);
                }
            } else {
                showNotification(`Loaded simulation from ${file.name}`);
            }

            // Auto-collapse assets object
            setTimeout(async () => {
                if (typeof autoCollapseAssetsObject === 'function') {
                    await autoCollapseAssetsObject(true);
                }
            }, 100);

            if (typeof autoRender !== 'undefined' && autoRender) {
                renderSimulation();
            }
        } else {
            alert('Editor not initialized');
        }

    } catch (error) {
        console.error('Error loading ZIP file:', error);
        alert(`Error loading ZIP file: ${error.message}`);
    }
}

// Disclaimer functions (kept for backward compatibility)
function hasAcceptedDisclaimer() {
    return localStorage.getItem('uaw-privacy-disclaimer-accepted') === 'true';
}

function setDisclaimerAccepted() {
    try {
        localStorage.setItem('uaw-privacy-disclaimer-accepted', 'true');
    } catch (e) {
        console.warn('Could not save privacy disclaimer acceptance:', e.message);
    }
}

// Open save dialog
function openSaveDialog() {
    const dialog = document.getElementById('save-modal');
    if (!dialog) {
        console.error('Save dialog not found');
        return;
    }

    // Get all relevant elements within the save modal
    const saveLocalRadio = document.getElementById('save-local-radio');
    const saveCloudRadio = document.getElementById('save-cloud-radio');
    const cloudPrivacyWarning = document.getElementById('cloud-privacy-warning');
    const privacyConsentCheckbox = document.getElementById('privacy-consent-checkbox');
    const localSaveNameDiv = document.getElementById('local-save-name');
    const saveConfirmBtn = document.getElementById('save-confirm-btn');
    const saveCancelBtn = document.getElementById('save-cancel-btn');
    const saveSuccessDiv = document.getElementById('save-success');
    const saveLoadingDiv = document.getElementById('save-loading');
    const cloudSaveResultDiv = document.getElementById('cloud-save-result');
    const localSaveResultDiv = document.getElementById('local-save-result');
    const saveCodeResult = document.getElementById('save-code-result');
    const copySaveCodeBtn = document.getElementById('copy-save-code-btn');
    const savedFileNameSpan = document.getElementById('saved-filename');
    const includeCustomMetricsCheckbox = document.getElementById('include-custom-metrics-checkbox');
    const customMetricsSaveOption = document.getElementById('custom-metrics-save-option');
    const localFileNameInput = document.getElementById('local-file-name');

    // Helper to update save button state
    const updateSaveButtonState = () => {
        if (saveCloudRadio.checked) {
            saveConfirmBtn.disabled = !privacyConsentCheckbox.checked;
        } else if (saveLocalRadio.checked) {
            saveConfirmBtn.disabled = false; // Local save doesn't require consent
        }
    };

    // Reset modal to initial state
    const resetSaveDialog = () => {
        saveSuccessDiv.style.display = 'none';
        saveLoadingDiv.style.display = 'none';
        saveConfirmBtn.style.display = 'inline-block';
        saveCancelBtn.textContent = 'Cancel';

        cloudSaveResultDiv.style.display = 'none';
        localSaveResultDiv.style.display = 'none';

        // Check if we should hide cloud save option
        const shouldHideCloudSave = isMetricsMode || hasCustomMetrics();
        const cloudSaveOption = saveCloudRadio.closest('.save-method-option');

        if (shouldHideCloudSave) {
            // Hide cloud save option entirely
            if (cloudSaveOption) {
                cloudSaveOption.style.display = 'none';
            }
            // Force local save selection
            saveLocalRadio.checked = true;
            saveCloudRadio.checked = false;
        } else {
            // Show cloud save option
            if (cloudSaveOption) {
                cloudSaveOption.style.display = '';
            }
            // Default to local save
            saveLocalRadio.checked = true;
            saveCloudRadio.checked = false;
        }

        cloudPrivacyWarning.style.display = 'none'; // Hide for local default
        localSaveNameDiv.style.display = 'block'; // Show for local default

        privacyConsentCheckbox.checked = false;
        updateSaveButtonState(); // Set initial button state

        localFileNameInput.value = '';
        includeCustomMetricsCheckbox.checked = false;

        // Check if custom metrics are present and show the option
        if (hasCustomMetrics()) {
            customMetricsSaveOption.style.display = 'block';
        } else {
            customMetricsSaveOption.style.display = 'none';
            includeCustomMetricsCheckbox.checked = false;
        }
    };

    // Event Listeners
    saveLocalRadio.onchange = () => {
        if (saveLocalRadio.checked) {
            cloudPrivacyWarning.style.display = 'none';
            localSaveNameDiv.style.display = 'block';
            updateSaveButtonState();
        }
    };

    saveCloudRadio.onchange = () => {
        // Prevent cloud save selection if in metrics mode or has custom metrics
        const shouldHideCloudSave = isMetricsMode || hasCustomMetrics();
        if (shouldHideCloudSave && saveCloudRadio.checked) {
            // Force back to local save
            saveLocalRadio.checked = true;
            saveCloudRadio.checked = false;
            cloudPrivacyWarning.style.display = 'none';
            localSaveNameDiv.style.display = 'block';
            updateSaveButtonState();
            return;
        }

        if (saveCloudRadio.checked) {
            cloudPrivacyWarning.style.display = 'block';
            localSaveNameDiv.style.display = 'none';
            updateSaveButtonState();
        }
    };

    privacyConsentCheckbox.onchange = updateSaveButtonState;

    saveCancelBtn.onclick = () => {
        dialog.style.display = 'none';
    };

    saveConfirmBtn.onclick = async () => {
        saveLoadingDiv.style.display = 'flex';
        saveConfirmBtn.disabled = true;
        
        try {
            const simulationContent = editor.getValue(); // Assuming 'editor' is globally available
            if (!simulationContent) {
                throw new Error("Simulation content is empty or invalid.");
            }

            if (saveCloudRadio.checked) {
                // Cloud save: encode simulation data as base64
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Parse simulation to ensure it's valid
                let simulationData;
                try {
                    simulationData = JSON.parse(simulationContent);
                    if (!simulationData.simulation) {
                        throw new Error('Invalid simulation format');
                    }
                } catch (error) {
                    throw new Error('Cannot save: Invalid simulation data - ' + error.message);
                }

                // Create save data object with just the simulation
                const saveData = { simulation: simulationData.simulation };
                const saveCode = btoa(JSON.stringify(saveData));

                saveCodeResult.value = saveCode;
                cloudSaveResultDiv.style.display = 'block';
                localSaveResultDiv.style.display = 'none';
            } else {
                // Local save to file
                const fileNameBase = localFileNameInput.value.trim() || 'simulation';

                // Validate filename
                const invalidChars = /[<>:"/\\|?*]/g;
                if (invalidChars.test(fileNameBase)) {
                    throw new Error('Filename contains invalid characters. Please use only letters, numbers, and basic punctuation.');
                }

                const includeMetrics = includeCustomMetricsCheckbox.checked;

                // Validate simulation data before saving
                let simulationData;
                try {
                    simulationData = JSON.parse(simulationContent);
                    if (!simulationData.simulation) {
                        throw new Error('Invalid simulation format');
                    }
                } catch (error) {
                    throw new Error('Cannot save: Invalid simulation data - ' + error.message);
                }

                if (includeMetrics) {
                    // Check JSZip availability early
                    if (!window.JSZip) {
                        throw new Error("JSZip library is not loaded. Cannot create a zip file with custom metrics.");
                    }

                    try {
                        const zip = new JSZip();
                        zip.file("simulation.json", simulationContent);

                        // Get custom metrics content with error handling
                        let catalog, validator;
                        try {
                            const customContent = getCustomMetricsContent();
                            catalog = customContent.catalog;
                            validator = customContent.validator;
                        } catch (metricsError) {
                            console.warn('Error getting custom metrics content:', metricsError);
                            // Continue with just simulation file
                        }

                        if (catalog) { zip.file("metrics-catalog-custom.json", catalog); }
                        if (validator) { zip.file("simulation-validator-custom.js", validator); }

                        const blob = await zip.generateAsync({ type: "blob" });
                        const fileName = `${fileNameBase}.zip`;
                        downloadSimulationFile(blob, fileName);
                        savedFileNameSpan.textContent = fileName;
                    } catch (zipError) {
                        console.error('ZIP creation failed:', zipError);
                        // Fallback to JSON save
                        const blob = new Blob([simulationContent], { type: 'application/json' });
                        const fileName = `${fileNameBase}.json`;
                        downloadSimulationFile(blob, fileName);
                        savedFileNameSpan.textContent = fileName;
                        showNotification('ZIP creation failed, saved as JSON instead', 'warning');
                    }

                } else {
                    const blob = new Blob([simulationContent], { type: 'application/json' });
                    const fileName = `${fileNameBase}.json`;
                    downloadSimulationFile(blob, fileName);
                    savedFileNameSpan.textContent = fileName;
                }
                localSaveResultDiv.style.display = 'block';
                cloudSaveResultDiv.style.display = 'none';
            }
            
            saveLoadingDiv.style.display = 'none';
            saveSuccessDiv.style.display = 'block';
            saveConfirmBtn.style.display = 'none';
            saveCancelBtn.textContent = 'Close';

        } catch (error) {
            console.error('Save failed:', error);
            alert(`Error saving simulation: ${error.message}`);
            saveLoadingDiv.style.display = 'none';
            saveConfirmBtn.disabled = false;
        }
    };

    // Initial reset when dialog opens
    resetSaveDialog();
    dialog.style.display = 'flex';
}

// Open load dialog  
function openLoadDialog() {
    const dialog = document.getElementById('load-modal');
    if (!dialog) {
        console.error('Load dialog not found');
        return;
    }
    
    dialog.style.display = 'flex';

    const localRadio = document.getElementById('load-local-radio');
    const cloudRadio = document.getElementById('load-cloud-radio');
    const localSection = document.getElementById('local-load-section');
    const cloudSection = document.getElementById('cloud-load-section');
    const cancelBtn = document.getElementById('load-cancel-btn');
    const loadBtn = document.getElementById('load-confirm-btn');
    const browseBtn = document.getElementById('browse-local-file-btn');

    // Set local as default
    localRadio.checked = true;
    cloudRadio.checked = false;
    localSection.style.display = 'block';
    cloudSection.style.display = 'none';

    localRadio.onchange = () => {
        if (localRadio.checked) {
            localSection.style.display = 'block';
            cloudSection.style.display = 'none';
        }
    };

    cloudRadio.onchange = () => {
        if (cloudRadio.checked) {
            localSection.style.display = 'none';
            cloudSection.style.display = 'block';
        }
    };

    cancelBtn.onclick = () => {
        dialog.style.display = 'none';
    };

    browseBtn.onclick = () => {
        loadSimulationFromFileInput();
    };

    loadBtn.onclick = async () => {
        // This needs to be implemented based on which radio is selected
        const saveCodeInput = document.getElementById('load-code-input');
        const saveCode = saveCodeInput ? saveCodeInput.value.trim() : '';

        if (cloudRadio.checked) {
            if (!saveCode) {
                showLoadError('Please enter a save code');
                return;
            }

            // Validate save code format (basic check)
            if (saveCode.length < 10) {
                showLoadError('Save code appears to be too short. Please check and try again.');
                return;
            }

            try {
                // Decode base64
                const decoded = atob(saveCode);
                const saveData = JSON.parse(decoded);

                // Validate structure
                if (!saveData.simulation) {
                    throw new Error('Invalid save code: missing simulation data');
                }

                if (!saveData.simulation.objects || !Array.isArray(saveData.simulation.objects)) {
                    throw new Error('Invalid save code: simulation.objects must be an array');
                }

                if (!saveData.simulation.tasks || !Array.isArray(saveData.simulation.tasks)) {
                    throw new Error('Invalid save code: simulation.tasks must be an array');
                }

                // Load into editor
                if (typeof editor !== 'undefined' && editor) {
                    editor.setValue(JSON.stringify({ simulation: saveData.simulation }, null, 2));

                    // Auto-collapse assets object
                    setTimeout(async () => {
                        if (typeof autoCollapseAssetsObject === 'function') {
                            await autoCollapseAssetsObject(true);
                        }
                    }, 100);

                    if (typeof autoRender !== 'undefined' && autoRender) {
                        renderSimulation();
                    }

                    dialog.style.display = 'none';
                    showNotification('Simulation loaded successfully from cloud save!');
                } else {
                    throw new Error('Editor not initialized');
                }
            } catch (error) {
                console.error('Error loading from cloud:', error);
                if (error.name === 'InvalidCharacterError') {
                    showLoadError('Invalid save code format. Please check and try again.');
                } else {
                    showLoadError(`Error loading simulation: ${error.message}`);
                }
            }
        } else {
            // Local file is handled by loadSimulationFromFileInput, but we can close the dialog
            dialog.style.display = 'none';
        }
    };
}

function openFeedbackDialog() {
    const dialog = document.getElementById('feedback-modal');
    if (!dialog) {
        console.error('Feedback dialog not found');
        return;
    }
    dialog.style.display = 'flex';

    const form = document.getElementById('feedback-form');
    const cancelBtn = document.getElementById('cancel-feedback');
    const messageDiv = document.getElementById('feedback-message');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const sendButton = document.getElementById('send-feedback');
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        // Mock sending feedback
        await new Promise(resolve => setTimeout(resolve, 1000));

        messageDiv.textContent = '✅ Thank you for your feedback!';
        messageDiv.style.display = 'block';
        messageDiv.style.color = 'green';

        setTimeout(() => {
            dialog.style.display = 'none';
            messageDiv.style.display = 'none';
            sendButton.disabled = false;
            sendButton.textContent = 'Send Feedback';
            form.reset();
        }, 2000);
    };

    cancelBtn.onclick = () => {
        dialog.style.display = 'none';
    };
}

// Show load error
function showLoadError(message) {
    const errorDiv = document.getElementById('load-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}
