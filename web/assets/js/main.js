// Main JavaScript for Universal Automation Wiki

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            
            // Update aria-expanded attribute for accessibility
            const isExpanded = mainNav.classList.contains('active');
            menuToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (mainNav && mainNav.classList.contains('active') && 
            !event.target.closest('.main-nav') && 
            !event.target.closest('.mobile-menu-toggle')) {
            mainNav.classList.remove('active');
            if (menuToggle) {
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (mainNav && mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                    if (menuToggle) {
                        menuToggle.setAttribute('aria-expanded', 'false');
                    }
                }
            }
        });
    });
    
    // Load tree viewer if on the output page
    const treeViewerSection = document.getElementById('best-ranked-workflows');
    if (treeViewerSection) {
        // Simulate loading tree viewer
        setTimeout(() => {
            treeViewerSection.innerHTML = '<div id="tree-viewer">Tree Viewer Loaded</div>';
        }, 1000);
    }
    
    // Load alternative workflows if on the output page
    const alternativeWorkflowsSection = document.getElementById('alternative-workflows');
    if (alternativeWorkflowsSection) {
        // Simulate loading alternative workflows
        setTimeout(() => {
            alternativeWorkflowsSection.innerHTML = `
                <div class="workflow-option">
                    <h4>Alternative Approach 1</h4>
                    <p>This approach uses a different algorithm for task decomposition.</p>
                    <button class="button secondary vote-button" data-workflow="alt1">Vote for this approach</button>
                </div>
                <div class="workflow-option">
                    <h4>Alternative Approach 2</h4>
                    <p>This approach focuses on efficiency and minimal steps.</p>
                    <button class="button secondary vote-button" data-workflow="alt2">Vote for this approach</button>
                </div>
            `;
            
            // Add event listeners to vote buttons
            document.querySelectorAll('.vote-button').forEach(button => {
                button.addEventListener('click', function() {
                    const workflowId = this.getAttribute('data-workflow');
                    handleVote(workflowId);
                });
            });
        }, 1200);
    }
    
    // Handle votes for different workflows
    function handleVote(workflowId) {
        console.log(`Vote recorded for workflow: ${workflowId}`);
        // Here you would typically send this data to a server
        // For now, we'll just show a thank you message
        const voteButton = document.querySelector(`[data-workflow="${workflowId}"]`);
        if (voteButton) {
            const originalText = voteButton.textContent;
            voteButton.textContent = 'Thanks for your vote!';
            voteButton.disabled = true;
            voteButton.classList.add('voted');
            
            // Reset after 3 seconds
            setTimeout(() => {
                voteButton.textContent = originalText;
                voteButton.disabled = false;
                voteButton.classList.remove('voted');
            }, 3000);
        }
    }
    
    // Initialize any interactive components
    initializeComponents();
    // initializePersonaFeatures(); // Moved to be triggered by 'headerloaded' event
    initializeCollapsibleSections();
});

// Listen for the custom 'headerloaded' event dispatched by components.js
// This ensures persona features are initialized only after the header and its data are ready.
document.addEventListener('headerloaded', function() {
    console.log('main.js: "headerloaded" event received. Initializing persona features.');
    initializePersonaFeatures();
    initializeTransparencyFeatures();
});

// Initialize components like tabs, accordions, etc.
function initializeComponents() {
    // This function can be expanded as needed when new components are added
    console.log('Components initialized');
}

// --- Persona and Metrics Features ---

function populateHeaderPersonaSelector() {
    const selector = document.getElementById('persona-selector-header');
    const personasDataElement = document.getElementById('core-personas-data');

    if (!selector) {
        console.warn('Header persona selector (#persona-selector-header) not found by populateHeaderPersonaSelector. Selector will not be populated.');
        return;
    }
    if (!personasDataElement) {
        console.warn('Personas data element (#core-personas-data) not found by populateHeaderPersonaSelector. Selector will not be populated.');
        return;
    }

    try {
        const personas = JSON.parse(personasDataElement.textContent);
        if (personas && typeof personas === 'object') {
            // Add a "Select Persona" or "Default" option if needed, or just populate
            // selector.innerHTML = '<option value="">View as...</option>'; // Optional placeholder

            for (const key in personas) {
                if (Object.hasOwnProperty.call(personas, key)) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = personas[key];
                    selector.appendChild(option);
                }
            }
        } else {
            console.error('Core personas data is not a valid object:', personas);
        }
    } catch (e) {
        console.error('Error parsing core personas data:', e);
    }
}

const CORE_PERSONAS_FROM_JS = ['hobbyist', 'researcher', 'investor', 'educator', 'field_expert']; // Fallback if JSON data fails
const DEFAULT_PERSONA = 'hobbyist';
const PERSONA_STORAGE_KEY = 'uawSelectedPersona';

function initializePersonaFeatures() {
    populateHeaderPersonaSelector(); // Populate the new header selector

    const personaSelector = document.getElementById('persona-selector-header'); // Target new selector
    const metricsModal = document.getElementById('metrics-modal');
    const metricsModalContent = document.getElementById('metrics-modal-content');
    const metricsModalTitle = document.getElementById('metrics-modal-title');

    if (!personaSelector) {
        // console.warn('Header persona selector not found after populating. Filtering will not work.');
        // This might happen on pages where the header exists but it's not an article page
        // with persona-filterable content.
        return;
    }

    // Load stored persona or use default
    let currentPersona = localStorage.getItem(PERSONA_STORAGE_KEY) || DEFAULT_PERSONA;
    
    // Ensure the stored persona is valid, using the options now in the selector
    let isValidPersona = false;
    for (let i = 0; i < personaSelector.options.length; i++) {
        if (personaSelector.options[i].value === currentPersona) {
            isValidPersona = true;
            break;
        }
    }
    if (!isValidPersona) {
        currentPersona = personaSelector.options.length > 0 ? personaSelector.options[0].value : DEFAULT_PERSONA;
        // If selector is empty (e.g. data load failed), use hardcoded default.
        // If selector has options, use the first one as default if stored is invalid.
    }
    
    personaSelector.value = currentPersona;

    // Apply initial filtering only if on a page with filterable content
    if (document.querySelector('.content-section[data-relevant-personas]')) {
        filterContentByPersona(currentPersona);
    }


    // Handle persona change
    personaSelector.addEventListener('change', function() {
        currentPersona = this.value;
        localStorage.setItem(PERSONA_STORAGE_KEY, currentPersona);
        // Apply filtering only if on a page with filterable content
        if (document.querySelector('.content-section[data-relevant-personas]')) {
            filterContentByPersona(currentPersona);
        }
    });

    // Handle metrics icon clicks
    document.querySelectorAll('.metrics-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            const sectionId = this.dataset.sectionId;
            const sectionTitleElement = document.getElementById(`section-title-${sectionId}`);
            const sectionTitle = sectionTitleElement ? sectionTitleElement.textContent.replace('📊','').trim() : 'Section';
            
            try {
                const metricsDataString = this.dataset.metrics;
                if (!metricsDataString) {
                    console.error('Metrics data not found for section:', sectionId);
                    metricsModalContent.innerHTML = '<p>Error: Metrics data is missing for this section.</p>';
                    openModal(metricsModal);
                    return;
                }
                const metrics = JSON.parse(metricsDataString);
                
                metricsModalTitle.textContent = `Metrics for: ${sectionTitle}`;
                populateMetricsModal(metrics, currentPersona, metricsModalContent);
                openModal(metricsModal);
            } catch (e) {
                console.error('Error parsing metrics data for section:', sectionId, e);
                metricsModalContent.innerHTML = '<p>Error: Could not load metrics data for this section.</p>';
                openModal(metricsModal);
            }
        });
    });

    // Modal close functionality (basic, can be enhanced with a library like Micromodal.js if available)
    if (metricsModal) {
        metricsModal.querySelectorAll('[data-micromodal-close]').forEach(el => {
            el.addEventListener('click', () => closeModal(metricsModal));
        });
        // Close on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && metricsModal.getAttribute('aria-hidden') === 'false') {
                closeModal(metricsModal);
            }
        });
    }
}

function filterContentByPersona(persona) {
    document.querySelectorAll('.content-section').forEach(section => {
        const relevantPersonasAttr = section.getAttribute('data-relevant-personas');
        const sectionId = section.getAttribute('data-section-id');
        
        // Always show simulation section regardless of persona
        if (sectionId && sectionId.includes('simulation')) {
            section.style.display = 'block';
            return;
        }
        
        if (relevantPersonasAttr) {
            try {
                const relevantPersonas = JSON.parse(relevantPersonasAttr);
                if (relevantPersonas.includes(persona)) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            } catch (e) {
                console.warn('Could not parse relevant personas for section:', section);
                section.style.display = 'block'; // Show by default if parsing fails
            }
        } else {
            section.style.display = 'block'; // Show sections without persona data
        }
    });
}

function populateMetricsModal(metrics, currentPersona, modalContentElement) {
    if (!metrics || typeof metrics !== 'object') {
        modalContentElement.innerHTML = '<p>No metrics data available for this section.</p>';
        return;
    }

    const personaSpecificMetrics = metrics[currentPersona];

    if (!personaSpecificMetrics) {
        modalContentElement.innerHTML = `<p>No metrics data available for persona: ${currentPersona.replace('_', ' ')}.</p>`;
        return;
    }

    let html = `<p><strong>Relevance for ${currentPersona.replace('_', ' ')}:</strong>
                ${personaSpecificMetrics.is_relevant_to_persona ?
                    '<span class="metric-pass">Relevant</span>' :
                    '<span class="metric-fail">Not Relevant</span>'}</p>`;

    // Add relevance reasoning if available
    if (personaSpecificMetrics.relevance_reasoning) {
        html += `<p class="metric-relevance-reasoning"><strong>Reasoning:</strong> ${personaSpecificMetrics.relevance_reasoning}</p>`;
    }
    
    if (personaSpecificMetrics.evaluated_metrics && personaSpecificMetrics.evaluated_metrics.length > 0) {
        html += '<h4>Evaluated Metrics:</h4><ul>';
        personaSpecificMetrics.evaluated_metrics.forEach(metric => {
            html += `<li>
                        <strong>${metric.name}:</strong>
                        ${metric.passed ?
                            '<span class="metric-pass">True</span>' :
                            '<span class="metric-fail">False</span>'}
                        ${metric.description ? `<p class="metric-description">${metric.description}</p>` : ''}
                     </li>`;
        });
        html += '</ul>';
    } else if (personaSpecificMetrics.is_relevant_to_persona) {
        html += '<p>This section is relevant, but no specific metrics were evaluated for this persona.</p>';
    } else {
        html += '<p>No specific metrics applicable or evaluated for this persona in this section.</p>';
    }
    
    modalContentElement.innerHTML = html;
}

// Basic Modal Open/Close (can be replaced with Micromodal.js or similar if integrated)
let previouslyFocusedElement;

function openModal(modalElement) {
    if (!modalElement) return;
    previouslyFocusedElement = document.activeElement;
    modalElement.setAttribute('aria-hidden', 'false');
    modalElement.style.display = 'flex'; // Or 'block', depending on CSS for modal
    document.body.classList.add('modal-open'); // Prevent background scrolling
    // Focus trap (basic)
    const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }
    
    modalElement.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastFocusableElement) {
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.style.display = 'none';
    document.body.classList.remove('modal-open'); // Allow background scrolling
    if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
    }
}

// --- Collapsible Sections ---
function initializeCollapsibleSections() {
    const sectionToggleButtons = document.querySelectorAll('.section-toggle-button');

    sectionToggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sectionHeader = this.closest('.section-header');
            const contentSection = sectionHeader.closest('.content-section');
            const sectionBody = contentSection.querySelector('.section-body');
            const indicator = this.querySelector('.toggle-indicator');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                // Collapse
                this.setAttribute('aria-expanded', 'false');
                sectionBody.setAttribute('hidden', true);
                contentSection.classList.add('collapsed');
                if (indicator) indicator.textContent = '►';
            } else {
                // Expand
                this.setAttribute('aria-expanded', 'true');
                sectionBody.removeAttribute('hidden');
                contentSection.classList.remove('collapsed');
                if (indicator) indicator.textContent = '▼';
            }
        });
    });
}
// Audio Banner Logic
document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('banner-audio');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const seekBar = document.getElementById('seek-bar');
    const timeDisplay = document.getElementById('time-display');
    const closeBtn = document.getElementById('close-btn');
    const audioBanner = document.querySelector('.audio-banner');

    // Check if all elements exist before proceeding
    if (!audio || !playPauseBtn || !seekBar || !timeDisplay) {
        // console.warn("Audio player elements not found. Skipping audio banner initialization.");
        return; 
    }

    // Constants for localStorage
    const AUDIO_BANNER_STORAGE_KEY = 'uawAudioBannerClosed';

    // Check if banner was previously closed and hide it if so
    if (audioBanner && localStorage.getItem(AUDIO_BANNER_STORAGE_KEY) === 'true') {
        audioBanner.style.display = 'none';
        return; // Exit early since banner is hidden
    }

    // Close button functionality
    if (closeBtn && audioBanner) {
        closeBtn.addEventListener('click', () => {
            audioBanner.style.display = 'none';
            // Remember that the banner was closed
            localStorage.setItem(AUDIO_BANNER_STORAGE_KEY, 'true');
            // Pause audio if playing
            if (!audio.paused) {
                audio.pause();
            }
        });
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
            seekBar.max = audio.duration;
            timeDisplay.textContent = `${formatTime(0)} / ${formatTime(audio.duration)}`;
        } else {
            // Fallback if duration is not available or invalid
            timeDisplay.textContent = `0:00 / --:--`;
        }
    });

    playPauseBtn.addEventListener('click', () => {
        if (audio.paused || audio.ended) {
            audio.play().catch(error => console.error("Error playing audio:", error));
            // playPauseBtn.textContent = 'Pause'; // Updated in 'play' event
        } else {
            audio.pause();
            // playPauseBtn.textContent = 'Play'; // Updated in 'pause' event
        }
    });

    audio.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<span id="pause-icon">&#10074;&#10074;</span>';
        playPauseBtn.setAttribute('aria-label', 'Pause audio');
    });

    audio.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<span id="play-icon">&#9654;</span>';
        playPauseBtn.setAttribute('aria-label', 'Play audio');
    });
    
    audio.addEventListener('ended', () => {
        playPauseBtn.innerHTML = '<span id="play-icon">&#9654;</span>';
        playPauseBtn.setAttribute('aria-label', 'Play audio');
        seekBar.value = 0; // Reset seek bar to beginning
        // Update time display to show 0:00 / total_duration
        if (audio.duration && isFinite(audio.duration)) {
            timeDisplay.textContent = `${formatTime(0)} / ${formatTime(audio.duration)}`;
        }
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration && isFinite(audio.duration)) {
            seekBar.value = audio.currentTime;
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        }
    });

    seekBar.addEventListener('input', () => {
        if (audio.duration && isFinite(audio.duration)) {
            audio.currentTime = seekBar.value;
        }
    });

    // Ensure duration is available for the initial time display if metadata loads quickly
    // and also handle cases where it might not be available immediately
    if (audio.readyState >= 1) { // HAVE_METADATA or higher
         if (audio.duration && isFinite(audio.duration)) {
            seekBar.max = audio.duration;
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        } else if (audio.duration === Infinity || isNaN(audio.duration)) {
            // Handle live streams or unknown durations gracefully
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / --:--`;
            seekBar.disabled = true; // Disable seek bar if duration is unknown/infinite
        }
    } else {
        // If metadata is not yet loaded, set a placeholder or wait for 'loadedmetadata'
        timeDisplay.textContent = `0:00 / --:--`;
    }

    // Error handling for audio element
    audio.addEventListener('error', (e) => {
        console.error("Error with audio element:", e);
        playPauseBtn.disabled = true;
        seekBar.disabled = true;
        timeDisplay.textContent = "Error";
        // Optionally, display a user-friendly message in the banner
        const bannerText = document.querySelector('.audio-banner p');
        if (bannerText) {
            bannerText.textContent = "Audio could not be loaded.";
        }
    });
});

// --- Transparency Modal Features ---

function initializeTransparencyFeatures() {
    const transparencyModal = document.getElementById('transparency-modal');
    
    if (!transparencyModal) {
        // console.warn('Transparency modal not found. Transparency features will not be available.');
        return;
    }

    // Add click events to all transparency icons
    document.querySelectorAll('.transparency-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section-id');
            console.log(`Transparency icon clicked for section: ${sectionId}`);
            openSectionTransparencyModal(sectionId);
        });
    });

    // Modal close functionality
    transparencyModal.querySelectorAll('[data-micromodal-close]').forEach(el => {
        el.addEventListener('click', () => closeModal(transparencyModal));
    });

    // Close on escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && transparencyModal.getAttribute('aria-hidden') === 'false') {
            closeModal(transparencyModal);
        }
    });
}

function openSectionTransparencyModal(sectionId) {
    const transparencyModal = document.getElementById('transparency-modal');
    const transparencyModalTitle = document.getElementById('transparency-modal-title');
    
    if (!transparencyModal) return;
    
    // Update modal title to include section info
    if (transparencyModalTitle) {
        const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
        const sectionTitle = sectionElement ? 
            sectionElement.querySelector('.section-title-text')?.textContent || `Section ${sectionId}` :
            `Section ${sectionId}`;
        transparencyModalTitle.textContent = `Transparency Data - ${sectionTitle}`;
    }
    
    // Load transparency data from embedded data instead of network call
    loadEmbeddedTransparencyData(sectionId);
    
    // Open the modal
    openModal(transparencyModal);
}

function openTransparencyModal() {
    const transparencyModal = document.getElementById('transparency-modal');
    const flowUuidElement = document.getElementById('flow-uuid-data');
    
    if (!transparencyModal) return;
    
    // Get flow UUID from the page
    let flowUuid = null;
    if (flowUuidElement) {
        flowUuid = flowUuidElement.textContent.trim();
    }
    
    if (!flowUuid) {
        console.error('Flow UUID not found. Transparency data cannot be loaded.');
        return;
    }
    
    // Load transparency data
    loadTransparencyData(flowUuid);
    
    // Open the modal
    openModal(transparencyModal);
}

function loadEmbeddedTransparencyData(sectionId) {
    console.log(`Loading embedded transparency data for section: ${sectionId}`);
    
    // Find the transparency icon for this section to get embedded data
    const transparencyIcon = document.querySelector(`.transparency-icon[data-section-id="${sectionId}"]`);
    
    if (!transparencyIcon) {
        displayTransparencyError(`Transparency icon not found for section: ${sectionId}`);
        return;
    }
    
    try {
        const transparencyDataString = transparencyIcon.getAttribute('data-transparency');
        if (!transparencyDataString) {
            displayTransparencyError(`No transparency data available for section: ${sectionId}`);
            return;
        }
        
        const transparencyData = JSON.parse(transparencyDataString);
        
        // Display the embedded transparency data
        displayEmbeddedTransparencyData(transparencyData);
        
    } catch (error) {
        console.error('Error parsing transparency data for section:', sectionId, error);
        displayTransparencyError(`Failed to load transparency data: ${error.message}`);
    }
}

function displayEmbeddedTransparencyData(data) {
    const stepInputElement = document.getElementById('step-input');
    const stepOutputElement = document.getElementById('step-output');
    
    // Display input data
    if (stepInputElement) {
        if (data.input && Object.keys(data.input).length > 0) {
            stepInputElement.innerHTML = formatJsonData(data.input);
        } else {
            stepInputElement.innerHTML = '<p class="no-data">No input data available</p>';
        }
    }
    
    // Display output data
    if (stepOutputElement) {
        if (data.output && Object.keys(data.output).length > 0) {
            stepOutputElement.innerHTML = formatJsonData(data.output);
        } else {
            stepOutputElement.innerHTML = '<p class="no-data">No output data available</p>';
        }
    }
}

// Helper function to extract base section ID from prefixed section ID
function extractBaseSectionId(sectionId) {
    // Extract base section ID from the prefixed section ID
    // Section IDs are in format: "page-slug-section-name" (e.g., "coffee-brewing-process-steps")
    // We need to extract just the section name part (e.g., "process-steps")
    const knownSections = ['process-steps', 'timeline', 'challenges', 'adoption-framework', 
                          'implementation-levels', 'roi-analysis', 'automation-technologies', 
                          'technical-specifications'];
    
    for (const knownSection of knownSections) {
        if (sectionId.endsWith('-' + knownSection)) {
            return knownSection;
        }
    }
    
    return sectionId; // Return original if no match found
}

function loadSectionTransparencyData(flowUuid, sectionId) {
    console.log(`Loading transparency data for section ${sectionId} in flow: ${flowUuid}`);
    
    // Extract base section ID from the prefixed section ID
    const baseSectionId = extractBaseSectionId(sectionId);
    
    // Map section IDs to their corresponding step numbers
    const sectionToStepMap = {
        'process-steps': '2',
        'timeline': '3',
        'challenges': '4',
        'adoption-framework': '5',
        'implementation-levels': '6',
        'roi-analysis': '7',
        'automation-technologies': '8',
        'technical-specifications': '9'
    };
    
    const stepId = sectionToStepMap[baseSectionId];
    if (!stepId) {
        displayTransparencyError(`No transparency data available for section: ${baseSectionId}`);
        return;
    }
    
    // Update step info
    updateStepInfo(stepId, baseSectionId);
    
    // Load the actual JSON data for this step
    loadStepInputOutput(flowUuid, stepId);
}

function updateStepInfo(stepId, sectionId) {
    const stepInfoTitle = document.getElementById('step-info-title');
    const stepInfoDescription = document.getElementById('step-info-description');
    
    const stepNames = {
        '2': 'Hallucinate Tree',
        '3': 'Generate Timeline',
        '4': 'Generate Challenges',
        '5': 'Automation Adoption',
        '6': 'Current Implementations',
        '7': 'ROI Analysis',
        '8': 'Future Technology',
        '9': 'Technical Specifications'
    };
    
    const sectionNames = {
        'process-steps': 'Process Steps/Tree Structure',
        'timeline': 'Timeline & Milestones',
        'challenges': 'Automation Challenges',
        'adoption-framework': 'Adoption Framework',
        'implementation-levels': 'Implementation Levels',
        'roi-analysis': 'ROI Analysis',
        'automation-technologies': 'Automation Technologies',
        'technical-specifications': 'Technical Specifications'
    };
    
    const stepName = stepNames[stepId] || `Step ${stepId}`;
    const sectionDisplayName = sectionNames[sectionId] || sectionId;
    
    if (stepInfoTitle) {
        stepInfoTitle.textContent = `Step ${stepId}: ${stepName}`;
    }
    
    if (stepInfoDescription) {
        stepInfoDescription.textContent = `This section (${sectionDisplayName}) was generated using step ${stepId} of the processing pipeline. Below you can see the input data that was processed and the output data that was generated.`;
    }
}

function loadStepInputOutput(flowUuid, stepId) {
    const stepInputElement = document.getElementById('step-input');
    const stepOutputElement = document.getElementById('step-output');
    
    if (stepInputElement) {
        stepInputElement.innerHTML = '<p>Loading input data...</p>';
    }
    if (stepOutputElement) {
        stepOutputElement.innerHTML = '<p>Loading output data...</p>';
    }
    
    // Load the JSON file for this step
    const jsonUrl = `/flow/${flowUuid}/${stepId}.json`;
    
    fetch(jsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            displayStepInputOutput(data, stepId);
        })
        .catch(error => {
            console.error('Error loading step data:', error);
            displayTransparencyError(`Failed to load transparency data for step ${stepId}: ${error.message}`);
        });
}

function displayStepInputOutput(data, stepId) {
    const stepInputElement = document.getElementById('step-input');
    const stepOutputElement = document.getElementById('step-output');
    
    // Extract input and output data
    let inputData = null;
    let outputData = {};
    
    // Look for input data (usually in 'input' field)
    if (data.input) {
        inputData = data.input;
    }
    
    // Everything else except input and metadata is output
    Object.keys(data).forEach(key => {
        if (key !== 'input' && key !== 'process_metadata') {
            outputData[key] = data[key];
        }
    });
    
    // Display input data
    if (stepInputElement) {
        if (inputData) {
            stepInputElement.innerHTML = formatJsonData(inputData);
        } else {
            stepInputElement.innerHTML = '<p class="no-data">No input data available</p>';
        }
    }
    
    // Display output data
    if (stepOutputElement) {
        if (Object.keys(outputData).length > 0) {
            stepOutputElement.innerHTML = formatJsonData(outputData);
        } else {
            stepOutputElement.innerHTML = '<p class="no-data">No output data available</p>';
        }
    }
}

function formatJsonData(data) {
    if (typeof data === 'string') {
        return `<pre class="json-data">${escapeHtml(data)}</pre>`;
    }
    
    try {
        const formatted = JSON.stringify(data, null, 2);
        return `<pre class="json-data">${escapeHtml(formatted)}</pre>`;
    } catch (error) {
        return `<p class="error">Error formatting data: ${error.message}</p>`;
    }
}

function displayTransparencyError(message) {
    const stepInputElement = document.getElementById('step-input');
    const stepOutputElement = document.getElementById('step-output');
    
    const errorHtml = `<p class="error">${escapeHtml(message)}</p>`;
    
    if (stepInputElement) {
        stepInputElement.innerHTML = errorHtml;
    }
    if (stepOutputElement) {
        stepOutputElement.innerHTML = errorHtml;
    }
}

function loadSectionFlowOverview(flowUuid, sectionId, stepId) {
    const overviewContent = document.getElementById('flow-overview-content');
    if (!overviewContent) return;
    
    // Extract base section ID from the prefixed section ID
    const baseSectionId = extractBaseSectionId(sectionId);
    
    // Create a section-focused view
    const sectionStepMap = {
        'process-steps': { id: '2', name: 'Hallucinate Tree', file: '2.json' },
        'timeline': { id: '3', name: 'Timeline', file: '3.json' },
        'challenges': { id: '4', name: 'Challenges', file: '4.json' },
        'adoption-framework': { id: '5', name: 'Adoption', file: '5.json' },
        'implementation-levels': { id: '6', name: 'Implementations', file: '6.json' },
        'roi-analysis': { id: '7', name: 'ROI Analysis', file: '7.json' },
        'automation-technologies': { id: '8', name: 'Future Tech', file: '8.json' },
        'technical-specifications': { id: '9', name: 'Specifications', file: '9.json' }
    };
    
    const currentStep = sectionStepMap[baseSectionId];
    if (!currentStep) {
        overviewContent.innerHTML = '<div class="error">Section transparency data not available</div>';
        return;
    }
    
    const diagramHtml = `
        <div class="flow-diagram">
            <h4>Section Processing Details</h4>
            <div class="flow-steps">
                <div class="flow-step current-step" data-step="${currentStep.id}">
                    <div class="step-number">${currentStep.id}</div>
                    <div class="step-name">${currentStep.name}</div>
                    <div class="step-file">${currentStep.file}</div>
                    <div class="step-status">Current Section</div>
                </div>
            </div>
            <div class="flow-info">
                <p><strong>Section:</strong> ${sectionId}</p>
                <p><strong>Processing Step:</strong> ${currentStep.name}</p>
                <p><strong>Flow UUID:</strong> <code>${flowUuid}</code></p>
                <p>This section was generated using step ${currentStep.id} of the processing pipeline.</p>
            </div>
        </div>
    `;
    
    overviewContent.innerHTML = diagramHtml;
}

function loadTransparencyData(flowUuid) {
    console.log(`Loading transparency data for flow: ${flowUuid}`);
    
    // Load flow overview
    loadFlowOverview(flowUuid);
    
    // Load step list
    loadStepList(flowUuid);
}

function loadFlowOverview(flowUuid) {
    const overviewContent = document.getElementById('flow-overview-content');
    if (!overviewContent) return;
    
    // Create a visual representation of the flow
    const flowSteps = [
        { id: '1', name: 'Generate Metadata', file: '1.json' },
        { id: '2', name: 'Hallucinate Tree', file: '2.json' },
        { id: '3', name: 'Timeline', file: '3.json' },
        { id: '4', name: 'Challenges', file: '4.json' },
        { id: '5', name: 'Adoption', file: '5.json' },
        { id: '6', name: 'Implementations', file: '6.json' },
        { id: '7', name: 'ROI Analysis', file: '7.json' },
        { id: '8', name: 'Future Tech', file: '8.json' },
        { id: '9', name: 'Specifications', file: '9.json' }
    ];
    
    const diagramHtml = `
        <div class="flow-diagram">
            <h4>Processing Pipeline</h4>
            <div class="flow-steps">
                ${flowSteps.map(step => `
                    <div class="flow-step" data-step="${step.id}">
                        <div class="step-number">${step.id}</div>
                        <div class="step-name">${step.name}</div>
                        <div class="step-file">${step.file}</div>
                    </div>
                `).join('')}
            </div>
            <div class="flow-info">
                <p><strong>Flow UUID:</strong> <code>${flowUuid}</code></p>
                <p><strong>Total Steps:</strong> ${flowSteps.length}</p>
                <p>Each step takes the input.json and produces its respective output file with captured input/output data for transparency.</p>
            </div>
        </div>
    `;
    
    overviewContent.innerHTML = diagramHtml;
    
    // Add click handlers to flow steps
    document.querySelectorAll('.flow-step').forEach(step => {
        step.addEventListener('click', function() {
            const stepId = this.dataset.step;
            // Switch to step details tab and load this step
            switchToStepDetailsTab(stepId);
        });
    });
}

function loadStepList(flowUuid) {
    const stepSelector = document.getElementById('step-selector');
    if (!stepSelector) return;
    
    // Clear existing options
    stepSelector.innerHTML = '<option value="">Select a step...</option>';
    
    // Add step options
    const steps = [
        { value: '1', label: 'Step 1: Generate Metadata' },
        { value: '2', label: 'Step 2: Hallucinate Tree' },
        { value: '3', label: 'Step 3: Timeline' },
        { value: '4', label: 'Step 4: Challenges' },
        { value: '5', label: 'Step 5: Adoption' },
        { value: '6', label: 'Step 6: Implementations' },
        { value: '7', label: 'Step 7: ROI Analysis' },
        { value: '8', label: 'Step 8: Future Tech' },
        { value: '9', label: 'Step 9: Specifications' }
    ];
    
    steps.forEach(step => {
        const option = document.createElement('option');
        option.value = step.value;
        option.textContent = step.label;
        stepSelector.appendChild(option);
    });
}

function switchToStepDetailsTab(stepId) {
    // Switch to step details tab
    const stepDetailsButton = document.querySelector('[data-tab="step-details"]');
    const stepDetailsTab = document.getElementById('step-details-tab');
    
    if (stepDetailsButton && stepDetailsTab) {
        // Remove active from all tabs
        document.querySelectorAll('#transparency-modal .tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#transparency-modal .tab-content').forEach(content => content.classList.remove('active'));
        
        // Activate step details tab
        stepDetailsButton.classList.add('active');
        stepDetailsTab.classList.add('active');
        
        // Set the step selector and load details
        const stepSelector = document.getElementById('step-selector');
        if (stepSelector) {
            stepSelector.value = stepId;
            loadStepDetails(stepId);
        }
    }
}

function loadStepDetails(stepId) {
    if (!stepId) {
        clearStepDetails();
        return;
    }
    
    const flowUuidElement = document.getElementById('flow-uuid-data');
    const flowUuid = flowUuidElement ? flowUuidElement.textContent.trim() : null;
    
    if (!flowUuid) {
        displayStepError('Flow UUID not found');
        return;
    }
    
    // Attempt to load step data from the flow directory
    loadStepData(flowUuid, stepId);
}

function loadStepData(flowUuid, stepId) {
    const stepInputDiv = document.getElementById('step-input');
    const stepOutputDiv = document.getElementById('step-output');
    
    if (!stepInputDiv || !stepOutputDiv) return;
    
    // Show loading state
    stepInputDiv.innerHTML = '<div class="loading">Loading input data...</div>';
    stepOutputDiv.innerHTML = '<div class="loading">Loading output data...</div>';
    
    // Construct the path to the step file
    const stepFile = `${stepId}.json`;
    const filePath = `/flow/${flowUuid}/${stepFile}`;
    
    // Attempt to fetch the step data
    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            displayStepData(data, stepId);
        })
        .catch(error => {
            console.error(`Error loading step ${stepId} data:`, error);
            displayStepError(`Could not load data for step ${stepId}: ${error.message}`);
        });
}

function displayStepData(data, stepId) {
    const stepInputDiv = document.getElementById('step-input');
    const stepOutputDiv = document.getElementById('step-output');
    
    if (!stepInputDiv || !stepOutputDiv) return;
    
    // Display input data
    if (data.input) {
        stepInputDiv.innerHTML = `
            <h4>Input Data</h4>
            <pre><code>${JSON.stringify(data.input, null, 2)}</code></pre>
        `;
    } else {
        stepInputDiv.innerHTML = '<div class="no-data">No input data captured for this step</div>';
    }
    
    // Display output data - treat everything except 'input' as output
    const outputData = Object.keys(data)
        .filter(key => key !== 'input')
        .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
        }, {});
    
    if (Object.keys(outputData).length > 0) {
        stepOutputDiv.innerHTML = `
            <h4>Output Data</h4>
            <pre><code>${JSON.stringify(outputData, null, 2)}</code></pre>
        `;
    } else {
        stepOutputDiv.innerHTML = '<div class="no-data">No output data captured for this step</div>';
    }
}

function displayStepError(message) {
    const stepInputDiv = document.getElementById('step-input');
    const stepOutputDiv = document.getElementById('step-output');
    
    if (stepInputDiv) {
        stepInputDiv.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
    if (stepOutputDiv) {
        stepOutputDiv.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
}

function clearStepDetails() {
    const stepInputDiv = document.getElementById('step-input');
    const stepOutputDiv = document.getElementById('step-output');
    
    if (stepInputDiv) {
        stepInputDiv.innerHTML = '<div class="placeholder">Select a step to view its input data</div>';
    }
    if (stepOutputDiv) {
        stepOutputDiv.innerHTML = '<div class="placeholder">Select a step to view its output data</div>';
    }
}

// Utility function to escape HTML characters
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return text;
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}