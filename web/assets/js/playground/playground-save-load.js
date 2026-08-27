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

async function createImportedProject(projectName, data, fileName, directoryHandle = null) {
    const workSpec = JSON.stringify(data, null, 2);
    if (window.UAWPlaygroundShell?.requestProjectCreation) {
        return window.UAWPlaygroundShell.requestProjectCreation({
            kind: 'template',
            name: projectName,
            sourceLabel: `Import · ${fileName}`,
            workSpec
        });
    }
    if (window.UAWProjectStore?.createFromTemplate) {
        return window.UAWProjectStore.createFromTemplate(projectName, workSpec, directoryHandle);
    }
    editor?.setValue?.(workSpec);
    return true;
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
            const fileNameLower = file.name.toLowerCase();
            if (fileNameLower.endsWith('.zip')) await loadFromZipFile(file);
            else if (fileNameLower.endsWith('.workspec.json') || fileNameLower.endsWith('.json')) await loadFromJsonFile(file);
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
                const isV2 = sim && (sim.schema_version === '2.1' || sim.world || sim.process);

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
                    const project = await createImportedProject(projectName, data, file.name, directoryHandle);
                    if (!project) {
                        resolve(null);
                        return;
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
        const isV2 = sim && (sim.schema_version === '2.1' || sim.world || sim.process);

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
            const importedProject = await createImportedProject(projectName, data, file.name, directoryHandle);
            if (!importedProject) return;

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

// Project-system import/export surfaces. Projects provide local persistence;
// portable JSON and ZIP files are reserved for interchange and backup.
function openProjectImportDialog() {
    loadSimulationFromFileInput();
}

function openProjectExportDialog() {
    const dialog = document.getElementById('save-modal');
    if (!dialog) return;
    const nameInput = document.getElementById('local-file-name');
    const includeExtras = document.getElementById('include-custom-metrics-checkbox');
    const extrasOption = document.getElementById('custom-metrics-save-option');
    const confirm = document.getElementById('save-confirm-btn');
    const cancel = document.getElementById('save-cancel-btn');
    const result = document.getElementById('local-save-result');
    const savedName = document.getElementById('saved-filename');
    result.style.display = 'none';
    confirm.style.display = '';
    confirm.disabled = false;
    cancel.textContent = 'Cancel';
    nameInput.value = window.UAWProjectStore?.getCurrent?.()?.name || '';
    includeExtras.checked = false;
    if (extrasOption) extrasOption.style.display = hasCustomMetrics() ? 'block' : 'none';
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

// Backwards-compatible aliases for integrations that still call the old entry points.
function openSaveDialog() { openProjectExportDialog(); }
function openLoadDialog() { openProjectImportDialog(); }

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
