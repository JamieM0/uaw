// Playground Save-Load - Save/load functionality for simulations
// Universal Automation Wiki - Simulation Playground

// Save/Load state variables
let loadedSaveCode = null; // Track the save code we loaded (for lineage)
let hasShownDisclaimer = false; // Track if user has seen disclaimer this session

// Setup save/load buttons
function setupSaveLoadButtons() {
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openSaveDialog);
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openLoadDialog);
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
    input.accept = '.json';
    
    input.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const data = JSON.parse(content);
                
                // Validate that it's a simulation file
                if (!data.simulation) {
                    alert('Invalid simulation file: missing "simulation" property');
                    return;
                }
                
                // Load into editor
                editor.setValue(JSON.stringify(data, null, 2));
                clearSaveState();
                
                if (autoRender) {
                    renderSimulation();
                }
                
                showNotification(`Loaded simulation from ${file.name}`);
                
            } catch (error) {
                console.error('Error loading file:', error);
                alert(`Error loading file: ${error.message}`);
            }
        };
        
        reader.readAsText(file);
    });
    
    input.click();
}

// Disclaimer functions
function hasAcceptedDisclaimer() {
    return localStorage.getItem('uaw-privacy-disclaimer-accepted') === 'true';
}

function setDisclaimerAccepted() {
    localStorage.setItem('uaw-privacy-disclaimer-accepted', 'true');
}

// Clear save state
function clearSaveState() {
    loadedSaveCode = null;
}

// Open save dialog
function openSaveDialog() {
    const dialog = document.getElementById('save-dialog');
    const privacyDisclaimer = document.getElementById('privacy-disclaimer');
    const saveForm = document.getElementById('save-form');
    
    if (!dialog) {
        console.error('Save dialog not found');
        return;
    }
    
    // Show/hide privacy disclaimer based on whether user has accepted
    if (hasAcceptedDisclaimer() || hasShownDisclaimer) {
        privacyDisclaimer.style.display = 'none';
        saveForm.style.display = 'block';
    } else {
        privacyDisclaimer.style.display = 'block';
        saveForm.style.display = 'none';
    }
    
    dialog.style.display = 'flex';
    
    // Setup privacy disclaimer buttons
    const acceptBtn = document.getElementById('accept-privacy-btn');
    const declineBtn = document.getElementById('decline-privacy-btn');
    const permanentCheckbox = document.getElementById('remember-privacy-choice');
    
    const handleAccept = () => {
        if (permanentCheckbox.checked) {
            setDisclaimerAccepted();
        } else {
            hasShownDisclaimer = true;
        }
        privacyDisclaimer.style.display = 'none';
        saveForm.style.display = 'block';
    };
    
    const handleDecline = () => {
        dialog.style.display = 'none';
    };
    
    // Remove existing listeners and add new ones
    acceptBtn.replaceWith(acceptBtn.cloneNode(true));
    declineBtn.replaceWith(declineBtn.cloneNode(true));
    
    document.getElementById('accept-privacy-btn').addEventListener('click', handleAccept);
    document.getElementById('decline-privacy-btn').addEventListener('click', handleDecline);
    
    // Setup save form
    const saveFormElement = document.getElementById('save-simulation-form');
    if (saveFormElement) {
        saveFormElement.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const title = formData.get('simulation-title')?.trim();
            const description = formData.get('simulation-description')?.trim();
            
            if (!title) {
                alert('Please provide a title for your simulation');
                return;
            }
            
            try {
                const simulationData = JSON.parse(editor.getValue());
                
                // Include custom metrics if they exist
                const saveData = {
                    simulation: simulationData.simulation,
                    meta: {
                        title: title,
                        description: description,
                        created: new Date().toISOString(),
                        version: '1.0',
                        parentSaveCode: loadedSaveCode
                    }
                };
                
                if (hasCustomMetrics()) {
                    saveData.customMetrics = {
                        catalog: JSON.parse(localStorage.getItem('uaw-metrics-catalog-custom') || '[]'),
                        validator: localStorage.getItem('uaw-metrics-validator-custom') || ''
                    };
                }
                
                // Create save code (simple base64 encoding for now)
                const saveCode = btoa(JSON.stringify(saveData));
                
                // Display result
                const resultSection = document.getElementById('save-result-section');
                const saveCodeInput = document.getElementById('save-code-result');
                
                saveCodeInput.value = saveCode;
                resultSection.style.display = 'block';
                
                // Offer download
                const downloadBtn = document.getElementById('download-simulation-btn');
                if (downloadBtn) {
                    downloadBtn.onclick = () => {
                        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_simulation.json`;
                        downloadSimulationFile(JSON.stringify(saveData, null, 2), filename);
                    };
                }
                
                showNotification('Simulation saved successfully!');
                
            } catch (error) {
                console.error('Error saving simulation:', error);
                alert(`Error saving simulation: ${error.message}`);
            }
        });
    }
    
    // Setup close button
    const closeBtn = document.getElementById('close-save-dialog');
    if (closeBtn) {
        closeBtn.onclick = () => {
            dialog.style.display = 'none';
        };
    }
}

// Open load dialog  
function openLoadDialog() {
    const dialog = document.getElementById('load-dialog');
    
    if (!dialog) {
        console.error('Load dialog not found');
        return;
    }
    
    dialog.style.display = 'flex';
    
    // Setup load form
    const loadForm = document.getElementById('load-simulation-form');
    if (loadForm) {
        loadForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const saveCode = formData.get('save-code')?.trim();
            
            if (!saveCode) {
                showLoadError('Please enter a save code');
                return;
            }
            
            try {
                // Decode save code
                const saveData = JSON.parse(atob(saveCode));
                
                if (!saveData.simulation) {
                    throw new Error('Invalid save code: missing simulation data');
                }
                
                // Load simulation
                editor.setValue(JSON.stringify({ simulation: saveData.simulation }, null, 2));
                
                // Load custom metrics if they exist
                if (saveData.customMetrics) {
                    localStorage.setItem('uaw-metrics-catalog-custom', JSON.stringify(saveData.customMetrics.catalog || []));
                    localStorage.setItem('uaw-metrics-validator-custom', saveData.customMetrics.validator || '');
                }
                
                // Track the loaded save code for lineage
                loadedSaveCode = saveCode;
                
                if (autoRender) {
                    renderSimulation();
                }
                
                dialog.style.display = 'none';
                showNotification('Simulation loaded successfully!');
                
            } catch (error) {
                console.error('Error loading simulation:', error);
                showLoadError(`Error loading simulation: ${error.message}`);
            }
        });
    }
    
    // Setup file load button
    const fileLoadBtn = document.getElementById('load-from-file-btn');
    if (fileLoadBtn) {
        fileLoadBtn.onclick = () => {
            dialog.style.display = 'none';
            loadSimulationFromFileInput();
        };
    }
    
    // Setup close button
    const closeBtn = document.getElementById('close-load-dialog');
    if (closeBtn) {
        closeBtn.onclick = () => {
            dialog.style.display = 'none';
        };
    }
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