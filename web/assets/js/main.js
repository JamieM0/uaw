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
    initializePersonaFeatures();
    initializeCollapsibleSections();
});

// Initialize components like tabs, accordions, etc.
function initializeComponents() {
    // This function can be expanded as needed when new components are added
    console.log('Components initialized');
}

// --- Persona and Metrics Features ---

const CORE_PERSONAS = ['hobbyist', 'researcher', 'investor', 'educator', 'field_expert'];
const DEFAULT_PERSONA = 'hobbyist';
const PERSONA_STORAGE_KEY = 'uawSelectedPersona';

function initializePersonaFeatures() {
    const personaSelector = document.getElementById('persona-selector');
    const metricsModal = document.getElementById('metrics-modal');
    const metricsModalContent = document.getElementById('metrics-modal-content');
    const metricsModalTitle = document.getElementById('metrics-modal-title');

    if (!personaSelector) {
        console.warn('Persona selector not found.');
        return;
    }

    // Load stored persona or use default
    let currentPersona = localStorage.getItem(PERSONA_STORAGE_KEY) || DEFAULT_PERSONA;
    if (!CORE_PERSONAS.includes(currentPersona)) {
        currentPersona = DEFAULT_PERSONA;
    }
    personaSelector.value = currentPersona;

    // Apply initial filtering
    filterContentByPersona(currentPersona);

    // Handle persona change
    personaSelector.addEventListener('change', function() {
        currentPersona = this.value;
        localStorage.setItem(PERSONA_STORAGE_KEY, currentPersona);
        filterContentByPersona(currentPersona);
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
        try {
            const relevantPersonasJson = section.dataset.relevantPersonas;
            if (!relevantPersonasJson) {
                console.warn('Relevant personas data missing for section:', section.dataset.sectionId);
                section.style.display = 'none'; // Hide if data is missing
                return;
            }
            const relevantPersonas = JSON.parse(relevantPersonasJson);
            if (relevantPersonas.includes(persona)) {
                section.style.display = 'block';
                section.removeAttribute('hidden');
            } else {
                section.style.display = 'none';
                section.setAttribute('hidden', true);
            }
        } catch (e) {
            console.error('Error parsing relevant personas for section:', section.dataset.sectionId, e);
            section.style.display = 'none'; // Hide on error
            section.setAttribute('hidden', true);
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