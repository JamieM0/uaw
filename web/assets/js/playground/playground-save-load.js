// Playground Save-Load - Save/load functionality for simulations
// Universal Automation Wiki - Simulation Playground

// Constants
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1000;
const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const WORKSPEC_ZIP_EXTENSION = '.workspec.zip';
const STARTING_STATE_FILE = 'start.workspec.json';
const CHANGES_FILE = 'changes.workspec.js';
const GENERATOR_FILE = 'generator.workspec.js';

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
        .replace(/\.start\.workspec\.json$/i, '')
        .replace(/\.json$/i, '')
        .replace(/\.workspec$/i, '')
        .trim();
    return base || fallbackName;
}

function assetMimeTypeFromExtension(extension) {
    const mimeTypes = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        mp4: 'video/mp4',
        pdf: 'application/pdf'
    };
    return mimeTypes[String(extension || '').toLowerCase()] || 'application/octet-stream';
}

function parseImportedWorkSpec(content, sourceLabel = 'file') {
    const cleaned = typeof stripJsonComments === 'function' ? stripJsonComments(content) : content;
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || !data.simulation || typeof data.simulation !== 'object') {
        throw new Error(`WorkSpec import rejected (${sourceLabel}): missing a simulation object.`);
    }

    const sim = data.simulation;
    const isV2 = ['2.0', '2.1', '2.2'].includes(sim.schema_version) || sim.world || sim.process;
    if (isV2 && window.WorkSpecValidator?.validate) {
        const result = window.WorkSpecValidator.validate(data);
        const errors = (result?.problems || []).filter(problem => problem?.severity === 'error');
        if (errors.length > 0) {
            const details = errors.slice(0, 4).map(problem => `${problem.instance || '/'}: ${problem.detail || problem.title}`).join(' | ');
            throw new Error(`WorkSpec import rejected: ${details}`);
        }
    } else if (isV2) {
        if (!Array.isArray(sim.world?.objects)) throw new Error('WorkSpec import rejected: simulation.world.objects must be an array.');
        if (!Array.isArray(sim.process?.tasks)) throw new Error('WorkSpec import rejected: simulation.process.tasks must be an array.');
    } else {
        if (!Array.isArray(sim.objects)) throw new Error('Simulation import rejected: simulation.objects must be an array.');
        if (!Array.isArray(sim.tasks)) throw new Error('Simulation import rejected: simulation.tasks must be an array.');
    }

    return data;
}

function validateZipContents(zipContents) {
    const entries = Object.values(zipContents?.files || {});
    if (entries.length > MAX_ZIP_ENTRIES) {
        throw new Error(`ZIP import rejected: archive contains more than ${MAX_ZIP_ENTRIES} entries.`);
    }

    let totalBytes = 0;
    for (const entry of entries) {
        const names = [entry.name, entry.unsafeOriginalName].filter(Boolean);
        if (names.some(name => name.startsWith('/') || name.split('/').includes('..'))) {
            throw new Error('ZIP import rejected: archive contains an unsafe path.');
        }
        const uncompressedSize = Number(entry._data?.uncompressedSize);
        if (!Number.isFinite(uncompressedSize) || uncompressedSize < 0) continue;
        if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) {
            throw new Error(`ZIP import rejected: an entry exceeds ${MAX_ZIP_ENTRY_BYTES / (1024 * 1024)}MB uncompressed.`);
        }
        totalBytes += uncompressedSize;
        if (totalBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
            throw new Error(`ZIP import rejected: uncompressed content exceeds ${MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)}MB.`);
        }
    }
}

async function createImportedProject(projectName, data, fileName, directoryHandle = null, changes = null, generator = null, seed = 1) {
    const workSpec = JSON.stringify(data, null, 2);
    if (window.UAWPlaygroundShell?.requestProjectCreation) {
        return window.UAWPlaygroundShell.requestProjectCreation({
            kind: 'template',
            name: projectName,
            sourceLabel: `Import · ${fileName}`,
            workSpec,
            changes: typeof changes === 'string' ? changes : '',
            generator: typeof generator === 'string' ? generator : '',
            seed
        });
    }
    if (window.UAWProjectStore?.createFromTemplate) {
        const project = await window.UAWProjectStore.createFromTemplate(projectName, workSpec, directoryHandle, typeof changes === 'string' ? changes : null, typeof generator === 'string' ? generator : null);
        if (project && Number.isInteger(seed)) { project.seed = seed; await window.UAWProjectStore.put(project); }
        return project;
    }
    editor?.setValue?.(workSpec);
    return true;
}

// Load simulation from file input
function loadSimulationFromFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.start.workspec.json,.workspec.zip,.zip';

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
            else if (fileNameLower.endsWith('.start.workspec.json') || fileNameLower.endsWith('.json')) await loadFromJsonFile(file);
            else alert('Invalid file type. Please select start.workspec.json or a .workspec.zip project.');
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

                const data = parseImportedWorkSpec(content, file.name);

                // Load into editor
                if (typeof editor !== 'undefined' && editor) {
                    const projectName = data.simulation?.meta?.title || file.name.replace(/\.start\.workspec\.json$|\.json$/i, '');
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
        if (file?.size > MAX_FILE_SIZE_BYTES) throw new Error(`ZIP import rejected: compressed file exceeds ${MAX_FILE_SIZE_MB}MB.`);
        const zipContents = await zip.loadAsync(file);
        validateZipContents(zipContents);

        const simulationFile = zipContents.file(STARTING_STATE_FILE);
        if (!simulationFile) {
            alert(`Invalid ZIP file: missing ${STARTING_STATE_FILE}`);
            return;
        }

        const simulationContent = await simulationFile.async('text');

        // Validate and load simulation
        let data;
        try {
            data = parseImportedWorkSpec(simulationContent, `${file.name}:${STARTING_STATE_FILE}`);
        } catch (error) {
            alert('Invalid simulation.json in ZIP: ' + error.message);
            return;
        }

        const changesFile = zipContents.file(CHANGES_FILE);
        const generatorFile = zipContents.file(GENERATOR_FILE);
        const changes = changesFile ? await changesFile.async('text') : '';
        const generator = generatorFile ? await generatorFile.async('text') : '';
        const manifestFile = zipContents.file('workspec.manifest.json');
        const manifest = manifestFile ? JSON.parse(await manifestFile.async('text')) : {};

        // Load into editor
        if (typeof editor !== 'undefined' && editor) {
            const projectName = data.simulation?.meta?.title || file.name.replace(/\.workspec\.zip$|\.zip$/i, '');
            const importedProject = await createImportedProject(projectName, data, file.name, directoryHandle, changes, generator, Number.isInteger(manifest.seed) ? manifest.seed : 1);
            if (!importedProject) return;

            const assetEntries = [];
            zipContents.forEach((path, entry) => {
                if (!entry.dir && path.startsWith('assets/')) assetEntries.push([path, entry]);
            });
            for (const [path, entry] of assetEntries) {
                const fileName = path.split('/').pop();
                const id = fileName.replace(/\.[^.]+$/, '');
                const extension = (fileName.split('.').pop() || '').toLowerCase();
                const mime = assetMimeTypeFromExtension(extension);
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

function getCurrentChangesForExport() {
    return String(
        window.workSpecChangesEditor?.getValue?.()
        ?? window.UAWProjectStore?.getCurrent?.()?.changesDraft
        ?? ''
    );
}

function getCurrentGeneratorForExport() {
    return String(
        window.workSpecGeneratorEditor?.getValue?.()
        ?? window.UAWProjectStore?.getCurrent?.()?.generatorDraft
        ?? ''
    );
}

function hasNonDefaultChanges(changes) {
    const normalized = String(changes || '').trim();
    const defaultChanges = [
        '// WorkSpec 2.2 Changes',
        '// Register task behaviour with WorkSpec.task(...).',
        '// set, change, move, create and remove are available inside handlers.'
    ].join('\n');
    return Boolean(normalized && normalized !== defaultChanges);
}

function exportAssetExtension(mimeType) {
    const extensions = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'video/mp4': 'mp4',
        'application/pdf': 'pdf'
    };
    return extensions[String(mimeType || '').toLowerCase()] || 'bin';
}

function getExportableWorkSpec() {
    const raw = editor.getValue();
    const cleaned = typeof stripJsonComments === 'function' ? stripJsonComments(raw) : raw;
    const parsed = JSON.parse(cleaned);
    delete parsed.assets;
    if (parsed.simulation && typeof parsed.simulation === 'object') delete parsed.simulation.assets;
    parseImportedWorkSpec(JSON.stringify(parsed), 'current editor');
    return { parsed, content: JSON.stringify(parsed, null, 2) };
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
            const { parsed, content } = getExportableWorkSpec();
            const changes = getCurrentChangesForExport();
            const generator = getCurrentGeneratorForExport();
            const base = normalizeSimulationFileBaseName(nameInput.value);
            const assets = await window.UAWProjectStore?.listAssets?.() || [];
            const custom = Boolean(includeExtras.checked && hasCustomMetrics());
            if (window.JSZip) {
                const zip = new JSZip();
                zip.file(STARTING_STATE_FILE, content);
                zip.file(CHANGES_FILE, changes);
                zip.file(GENERATOR_FILE, generator);
                const exportedAssets = assets.map(asset => {
                    const id = String(asset.id || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_');
                    const extension = exportAssetExtension(asset.mimeType);
                    return { asset, id, extension, file: `assets/${id}.${extension}` };
                });
                exportedAssets.forEach(({ asset, file }) => {
                    const data = String(asset.data || '');
                    zip.file(file, data.split(',')[1] || data, { base64: data.startsWith('data:') });
                });
                if (custom) {
                    const metrics = getCustomMetricsContent();
                    if (metrics.catalog) zip.file('metrics-catalog-custom.json', metrics.catalog);
                    if (metrics.validator) zip.file('simulation-validator-custom.js', metrics.validator);
                }
                zip.file('workspec.manifest.json', JSON.stringify({
                    format_version: 2,
                    workspec_version: parsed.simulation?.schema_version || null,
                    starting_state_file: STARTING_STATE_FILE,
                    changes_file: CHANGES_FILE,
                    generator_file: GENERATOR_FILE,
                    seed: window.UAWProjectStore?.getCurrent?.()?.seed ?? 1,
                    assets: exportedAssets.map(({ asset, file }) => ({
                        id: asset.id,
                        file,
                        name: asset.name || file.split('/').pop(),
                        mime_type: asset.mimeType || 'application/octet-stream',
                        size: String(asset.data || '').length
                    })),
                    custom_metrics: custom ? {
                        catalog_file: 'metrics-catalog-custom.json',
                        validator_file: 'simulation-validator-custom.js'
                    } : null,
                    created_at: new Date().toISOString()
                }, null, 2));
                const fileName = `${base}${WORKSPEC_ZIP_EXTENSION}`;
                downloadSimulationFile(await zip.generateAsync({ type: 'blob' }), fileName);
                savedName.textContent = fileName;
            } else {
                downloadSimulationFile(new Blob([content], { type: 'application/json' }), STARTING_STATE_FILE);
                downloadSimulationFile(new Blob([changes], { type: 'text/javascript' }), CHANGES_FILE);
                downloadSimulationFile(new Blob([generator], { type: 'text/javascript' }), GENERATOR_FILE);
                savedName.textContent = `${STARTING_STATE_FILE}, ${CHANGES_FILE}, ${GENERATOR_FILE}`;
                showNotification('ZIP support is unavailable; downloaded the three project files separately.', 'warning');
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
    const existingFallback = document.getElementById('download-feedback-fallback');
    if (existingFallback) existingFallback.style.display = 'none';

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

            let fallbackButton = document.getElementById('download-feedback-fallback');
            if (!fallbackButton) {
                fallbackButton = document.createElement('button');
                fallbackButton.id = 'download-feedback-fallback';
                fallbackButton.type = 'button';
                fallbackButton.textContent = 'Download Feedback';
                fallbackButton.style.marginTop = '8px';
                messageDiv.insertAdjacentElement('afterend', fallbackButton);
            }
            fallbackButton.onclick = () => downloadSimulationFile(JSON.stringify(payload, null, 2), 'uaw-feedback.json');
            fallbackButton.style.display = 'inline-block';
        } finally {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Feedback';
        }
    };

    cancelBtn.onclick = () => {
        dialog.style.display = 'none';
    };
}
