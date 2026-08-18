// Playground Save-Load - Save/load functionality for simulations
// Universal Automation Wiki - Simulation Playground

// Constants
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const WORKSPEC_FILE_EXTENSION = '.workspec.json';
const WORKSPEC_ZIP_EXTENSION = '.workspec.zip';

// Setup save/load buttons
function setupSaveLoadButtons() {
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    const feedbackBtn = document.getElementById("feedback-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openProjectExportDialog);
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openProjectImportDialog);
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
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
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
    const saved = window.UAWProjectStore?.getCurrent?.()?.settings?.customMetrics || {};
    const catalog = window.metricsCatalogEditor?.getValue?.() || saved.catalog || null;
    const validator = window.metricsValidatorEditor?.getValue?.() || saved.validator || null;

    return {
        catalog: catalog || null,
        validator: validator || null
    };
}

// Check if there are custom metrics
function hasCustomMetrics() {
    const custom = getCustomMetricsContent();
    const customCatalog = custom.catalog;
    const customValidator = custom.validator;

    if (!customCatalog || !customValidator) return false;

    // Check if catalog has meaningful content (not just empty array)
    try {
        const catalog = JSON.parse(customCatalog);
        return Array.isArray(catalog) && catalog.length > 0;
    } catch {
        return false;
    }
}

function normalizeSimulationFileBaseName(rawName) {
    const fallbackName = 'simulation';
    let base = (rawName || fallbackName).trim();
    base = base
        .replace(/\.workspec\.json$/i, '')
        .replace(/\.json$/i, '')
        .replace(/\.workspec$/i, '')
        .trim();
    return base || fallbackName;
}

// Load simulation from file input
function loadSimulationFromFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.workspec.json,.zip';

    input.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
            alert(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
            return;
        }

        try {
            // Choose the destination while the file-selection gesture is active.
            const directoryHandle = await window.UAWProjectStore?.chooseProjectDirectory?.('uaw-import-project');
            if (!directoryHandle) return;
            const fileNameLower = file.name.toLowerCase();
            if (fileNameLower.endsWith('.zip')) await loadFromZipFile(file, directoryHandle);
            else if (fileNameLower.endsWith('.workspec.json') || fileNameLower.endsWith('.json')) await loadFromJsonFile(file, directoryHandle);
            else alert('Invalid file type. Please select a .workspec.json, .json, or .zip file.');
        } catch (error) {
            if (error?.name !== 'AbortError') alert(`Import failed: ${error.message}`);
        }
    });

    input.click();
}

// Load simulation from JSON file
async function loadFromJsonFile(file, directoryHandle = null) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
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

                // Validate simulation structure (WorkSpec v2 preferred; support v1 for compatibility)
                const sim = data.simulation;
                const isV2 = sim && (sim.schema_version === '2.0' || sim.world || sim.process);

                if (isV2) {
                    if (!sim.world || !Array.isArray(sim.world.objects)) {
                        alert('Invalid WorkSpec v2 file: simulation.world.objects must be an array');
                        reject(new Error('Invalid world.objects structure'));
                        return;
                    }

                    if (!sim.process || !Array.isArray(sim.process.tasks)) {
                        alert('Invalid WorkSpec v2 file: simulation.process.tasks must be an array');
                        reject(new Error('Invalid process.tasks structure'));
                        return;
                    }
                } else {
                    if (!sim.objects || !Array.isArray(sim.objects)) {
                        alert('Invalid simulation file: simulation.objects must be an array');
                        reject(new Error('Invalid objects structure'));
                        return;
                    }

                    if (!sim.tasks || !Array.isArray(sim.tasks)) {
                        alert('Invalid simulation file: simulation.tasks must be an array');
                        reject(new Error('Invalid tasks structure'));
                        return;
                    }
                }

                // Load into editor
                if (typeof editor !== 'undefined' && editor) {
                    const projectName = data.simulation?.meta?.title || file.name.replace(/\.workspec\.json$|\.json$/i, '');
                    if (window.UAWProjectStore?.createFromTemplate) {
                        await window.UAWProjectStore.createFromTemplate(projectName, JSON.stringify(data, null, 2), directoryHandle);
                    } else {
                        editor.setValue(JSON.stringify(data, null, 2));
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
async function loadFromZipFile(file, directoryHandle = null) {
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
        alert('ZIP file support is not available. JSZip library not loaded.');
        return;
    }

    try {
        const zip = new JSZip();
        const zipContents = await zip.loadAsync(file);

        // Accept current and legacy package entry names.
        const simulationFile = zipContents.file('simulation.workspec.json') || zipContents.file('simulation.json');
        if (!simulationFile) {
            alert('Invalid ZIP file: missing simulation.workspec.json');
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

        // Validate simulation structure (WorkSpec v2 preferred; support v1 for compatibility)
        const sim = data.simulation;
        const isV2 = sim && (sim.schema_version === '2.0' || sim.world || sim.process);

        if (isV2) {
            if (!sim.world || !Array.isArray(sim.world.objects)) {
                alert('Invalid WorkSpec v2 file: simulation.world.objects must be an array');
                return;
            }

            if (!sim.process || !Array.isArray(sim.process.tasks)) {
                alert('Invalid WorkSpec v2 file: simulation.process.tasks must be an array');
                return;
            }
        } else {
            if (!sim.objects || !Array.isArray(sim.objects)) {
                alert('Invalid simulation file: simulation.objects must be an array');
                return;
            }

            if (!sim.tasks || !Array.isArray(sim.tasks)) {
                alert('Invalid simulation file: simulation.tasks must be an array');
                return;
            }
        }

        // Load into editor
        if (typeof editor !== 'undefined' && editor) {
            const projectName = data.simulation?.meta?.title || file.name.replace(/\.workspec\.zip$|\.zip$/i, '');
            if (window.UAWProjectStore?.createFromTemplate) {
                await window.UAWProjectStore.createFromTemplate(projectName, JSON.stringify(data, null, 2), directoryHandle);
            } else {
                editor.setValue(JSON.stringify(data, null, 2));
            }

            const assetEntries = [];
            zipContents.forEach((path, entry) => {
                if (!entry.dir && path.startsWith('assets/')) assetEntries.push([path, entry]);
            });
            for (const [path, entry] of assetEntries) {
                const fileName = path.split('/').pop();
                const id = fileName.replace(/\.[^.]+$/, '');
                const extension = (fileName.split('.').pop() || '').toLowerCase();
                const mime = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'svg' ? 'image/svg+xml' : extension === 'mp3' ? 'audio/mpeg' : 'application/octet-stream';
                const base64 = await entry.async('base64');
                await window.UAWProjectStore?.putAsset?.({ id, data: `data:${mime};base64,${base64}`, mimeType: mime, name: fileName });
            }
            await window.AssetManager?.loadProjectAssets?.();

            // Check for custom metrics files
            const catalogFile = zipContents.file('metrics-catalog-custom.json');
            const validatorFile = zipContents.file('simulation-validator-custom.js');

            if (catalogFile || validatorFile) {
                const loadMetrics = confirm('This ZIP file contains custom metrics. Do you want to load them? (This will replace your current custom metrics)');

                if (loadMetrics) {
                    const project = window.UAWProjectStore?.getCurrent?.();
                    const customMetrics = { ...(project?.settings?.customMetrics || {}) };
                    if (catalogFile) {
                        const catalogContent = await catalogFile.async('text');
                        try {
                            JSON.parse(catalogContent);
                            customMetrics.catalog = catalogContent;
                            window.metricsCatalogEditor?.setValue?.(catalogContent);
                        } catch (error) {
                            console.error('Invalid metrics catalog in ZIP:', error);
                            alert('Warning: Custom metrics catalog is invalid and was not loaded.');
                        }
                    }

                    if (validatorFile) {
                        const validatorContent = await validatorFile.async('text');

                        // SECURITY: Double confirmation for custom validators from ZIP files
                        const firstConfirm = confirm(
                            '⚠️ WARNING: This ZIP file contains a custom JavaScript validator.\n\n' +
                            'Custom validators are executed in a sandboxed environment but still pose potential security risks.\n\n' +
                            'Only proceed if you trust the source of this file.\n\n' +
                            'Do you want to continue loading the custom validator?'
                        );

                        if (firstConfirm) {
                            const secondConfirm = prompt(
                                '⛔ CRITICAL SECURITY WARNING ⛔\n\n' +
                                'You are about to execute arbitrary JavaScript code from this ZIP file.\n\n' +
                                'This code will have access to:\n' +
                                '  - Your simulation data (read-only)\n' +
                                '  - Validation results (can add)\n\n' +
                                'This code CANNOT access:\n' +
                                '  - The global window object\n' +
                                '  - Local storage\n' +
                                '  - Network requests\n\n' +
                                'By typing "I UNDERSTAND THE RISKS" below, you acknowledge that:\n' +
                                '  1. You have reviewed the validator code\n' +
                                '  2. You trust the source completely\n' +
                                '  3. You accept all responsibility for any consequences\n\n' +
                                'Type "I UNDERSTAND THE RISKS" to proceed:'
                            );

                            if (secondConfirm === 'I UNDERSTAND THE RISKS') {
                                customMetrics.validator = validatorContent;
                                window.metricsValidatorEditor?.setValue?.(validatorContent);
                                showNotification('✓ Custom validator loaded (user acknowledged security risks)');
                            } else {
                                showNotification('Custom validator was not loaded (cancelled by user)');
                            }
                        } else {
                            showNotification('Custom validator was not loaded (cancelled by user)');
                        }
                    }

                    if (project) {
                        project.settings = { ...(project.settings || {}), customMetrics };
                        await window.UAWProjectStore.put(project);
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

// Project-system import/export surfaces. These intentionally replace the old
// browser save-code workflow; projects already provide local persistence.
function openProjectImportDialog() {
    loadSimulationFromFileInput();
}

function openProjectExportDialog() {
    const dialog = document.getElementById('save-modal');
    if (!dialog) return;
    const nameInput = document.getElementById('local-file-name');
    const includeExtras = document.getElementById('include-custom-metrics-checkbox');
    const confirm = document.getElementById('save-confirm-btn');
    const cancel = document.getElementById('save-cancel-btn');
    const result = document.getElementById('local-save-result');
    const savedName = document.getElementById('saved-filename');
    result.style.display = 'none';
    confirm.style.display = '';
    confirm.disabled = false;
    cancel.textContent = 'Cancel';
    nameInput.value = window.UAWProjectStore?.getCurrent?.()?.name || '';
    cancel.onclick = () => { dialog.style.display = 'none'; };
    confirm.onclick = async () => {
        try {
            const parsed = JSON.parse(editor.getValue());
            delete parsed.assets;
            const content = JSON.stringify(parsed, null, 2);
            const base = normalizeSimulationFileBaseName(nameInput.value);
            const assets = await window.UAWProjectStore?.listAssets?.() || [];
            const custom = Boolean(includeExtras.checked && hasCustomMetrics());
            if ((assets.length || custom) && window.JSZip) {
                const zip = new JSZip();
                zip.file('simulation.workspec.json', content);
                assets.forEach(asset => zip.file(`assets/${asset.id}.${(asset.mimeType || '').split('/')[1] || 'bin'}`, asset.data.split(',')[1] || asset.data, { base64: asset.data.startsWith('data:') }));
                if (custom) {
                    const metrics = getCustomMetricsContent();
                    if (metrics.catalog) zip.file('metrics-catalog-custom.json', metrics.catalog);
                    if (metrics.validator) zip.file('simulation-validator-custom.js', metrics.validator);
                }
                const fileName = `${base}${WORKSPEC_ZIP_EXTENSION}`;
                downloadSimulationFile(await zip.generateAsync({ type: 'blob' }), fileName);
                savedName.textContent = fileName;
            } else {
                const fileName = `${base}${WORKSPEC_FILE_EXTENSION}`;
                downloadSimulationFile(new Blob([content], { type: 'application/json' }), fileName);
                savedName.textContent = fileName;
            }
            result.style.display = 'block';
            confirm.style.display = 'none';
            cancel.textContent = 'Close';
        } catch (error) {
            showNotification(`Export failed: ${error.message}`, 'error');
        }
    };
    dialog.style.display = 'flex';
    requestAnimationFrame(() => nameInput.focus());
}

// Legacy dialog implementation retained only for backwards-compatible direct
// integrations. Product UI routes to the project import/export functions above.
// Open save dialog
function openSaveDialog() {
    openProjectExportDialog();
    return;
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

            if (saveCloudRadio.checked) {
                // Save code mode: persist simulation in local storage with a 16-char code
                const saveData = { simulation: simulationData.simulation };
                let saveCode = null;
                let attempts = 0;
                while (attempts < 5 && !saveCode) {
                    attempts += 1;
                    const candidate = generateSaveCode();
                    if (candidate) {
                        saveCode = candidate;
                    }
                }

                if (!saveCode) {
                    throw new Error('Unable to generate a unique save code. Please try again.');
                }

                const stored = storeSaveCodePayload(saveCode, saveData);
                if (!stored) {
                    throw new Error('Could not store save code data in this browser.');
                }

                saveCodeResult.value = saveCode;
                cloudSaveResultDiv.style.display = 'block';
                localSaveResultDiv.style.display = 'none';
            } else {
                // Local save to file
                const fileNameBase = normalizeSimulationFileBaseName(localFileNameInput.value);

                // Validate filename
                const invalidChars = /[<>:"/\\|?*]/g;
                if (invalidChars.test(fileNameBase)) {
                    throw new Error('Filename contains invalid characters. Please use only letters, numbers, and basic punctuation.');
                }

                const includeMetrics = includeCustomMetricsCheckbox.checked;

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
                        const fileName = `${fileNameBase}${WORKSPEC_ZIP_EXTENSION}`;
                        downloadSimulationFile(blob, fileName);
                        savedFileNameSpan.textContent = fileName;
                    } catch (zipError) {
                        console.error('ZIP creation failed:', zipError);
                        // Fallback to JSON save
                        const blob = new Blob([simulationContent], { type: 'application/json' });
                        const fileName = `${fileNameBase}${WORKSPEC_FILE_EXTENSION}`;
                        downloadSimulationFile(blob, fileName);
                        savedFileNameSpan.textContent = fileName;
                        showNotification('ZIP creation failed, saved as WorkSpec JSON instead', 'warning');
                    }

                } else {
                    const blob = new Blob([simulationContent], { type: 'application/json' });
                    const fileName = `${fileNameBase}${WORKSPEC_FILE_EXTENSION}`;
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
    openProjectImportDialog();
    return;
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
    const errorDiv = document.getElementById('load-error');
    const errorMessage = document.getElementById('load-error-message');

    if (errorDiv) errorDiv.style.display = 'none';
    if (errorMessage) errorMessage.textContent = '';

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
        const saveCode = saveCodeInput ? saveCodeInput.value.trim().toUpperCase() : '';

        if (cloudRadio.checked) {
            if (!saveCode) {
                showLoadError('Please enter a save code');
                return;
            }

            // Validate save code format (basic check)
            if (saveCode.length !== SAVE_CODE_LENGTH) {
                showLoadError(`Save code must be ${SAVE_CODE_LENGTH} characters.`);
                return;
            }

            try {
                const saveData = getSaveCodePayload(saveCode);
                if (!saveData) {
                    throw new Error('Save code not found in this browser');
                }

                // Validate structure
                if (!saveData.simulation) {
                    throw new Error('Invalid save code: missing simulation data');
                }

                // Validate simulation structure (WorkSpec v2 preferred; support v1 for compatibility)
                const sim = saveData.simulation;
                const isV2 = sim && (sim.schema_version === '2.0' || sim.world || sim.process);

                if (isV2) {
                    if (!sim.world || !Array.isArray(sim.world.objects)) {
                        throw new Error('Invalid WorkSpec v2 save code: simulation.world.objects must be an array');
                    }

                    if (!sim.process || !Array.isArray(sim.process.tasks)) {
                        throw new Error('Invalid WorkSpec v2 save code: simulation.process.tasks must be an array');
                    }
                } else {
                    if (!sim.objects || !Array.isArray(sim.objects)) {
                        throw new Error('Invalid save code: simulation.objects must be an array');
                    }

                    if (!sim.tasks || !Array.isArray(sim.tasks)) {
                        throw new Error('Invalid save code: simulation.tasks must be an array');
                    }
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
                    showNotification('Simulation loaded successfully from save code');
                } else {
                    throw new Error('Editor not initialized');
                }
            } catch (error) {
                console.error('Error loading from save code:', error);
                showLoadError(`Error loading simulation: ${error.message}`);
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

    if (form) {
        const firstField = form.querySelector('input, textarea, select');
        if (firstField) {
            setTimeout(() => firstField.focus(), 50);
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const sendButton = document.getElementById('send-feedback');
        const nameInput = document.getElementById('feedback-name');
        const emailInput = document.getElementById('feedback-email');
        const subjectInput = document.getElementById('feedback-subject');
        const bodyInput = document.getElementById('feedback-body');

        const subject = (subjectInput?.value || '').trim();
        const body = (bodyInput?.value || '').trim();

        if (!subject || !body) {
            messageDiv.textContent = 'Please fill in both Subject and Feedback Details.';
            messageDiv.style.display = 'block';
            messageDiv.style.color = 'crimson';
            return;
        }

        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        const apiUrl = 'https://4hmwnax7r1.execute-api.us-east-1.amazonaws.com/default/uaw-feedback-handler';
        const payload = {
            name: (nameInput?.value || 'Anonymous').trim() || 'Anonymous',
            email: (emailInput?.value || '').trim(),
            message: `${subject}\n\n${body}`,
            pageUrl: window.location.href
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'cors'
            });

            let result = {};
            try {
                result = await response.json();
            } catch (parseError) {
                console.warn('Feedback response was not JSON:', parseError);
            }

            if (!response.ok) {
                throw new Error(result.message || `Request failed (${response.status})`);
            }

            messageDiv.textContent = 'Thank you for your feedback!';
            messageDiv.style.display = 'block';
            messageDiv.style.color = 'green';

            setTimeout(() => {
                dialog.style.display = 'none';
                messageDiv.style.display = 'none';
                form.reset();
            }, 2000);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            messageDiv.textContent = `Error submitting feedback: ${error.message}`;
            messageDiv.style.display = 'block';
            messageDiv.style.color = 'crimson';
        } finally {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Feedback';
        }
    };

    cancelBtn.onclick = () => {
        dialog.style.display = 'none';
    };
}

// Show load error
function showLoadError(message) {
    const errorDiv = document.getElementById('load-error');
    const errorMessage = document.getElementById('load-error-message');
    if (errorDiv) {
        if (errorMessage) {
            errorMessage.textContent = message;
        } else {
            errorDiv.textContent = message;
        }
        errorDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}
