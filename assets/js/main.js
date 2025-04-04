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
});

// Initialize components like tabs, accordions, etc.
function initializeComponents() {
    // This function can be expanded as needed when new components are added
    console.log('Components initialized');
}