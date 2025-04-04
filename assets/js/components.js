document.addEventListener('DOMContentLoaded', function() {
    // Define the header content directly in the script to avoid network request delay
    const headerHTML = `
        <header class="site-header">
            <div class="container header-container">
                <div class="logo">
                    <a href="index.html">
                        <img src="assets/images/uaw-logo.png" alt="Universal Automation Wiki Logo">
                    </a>
                </div>
                <nav class="main-nav">
                    <ul>
                        <li><a href="technical.html">Technical Details</a></li>
                        <li><a href="output.html">Example Workflows</a></li>
                        <li><a href="https://jamiem.me/iterative-code" target="_blank">GitHub</a></li>
                    </ul>
                </nav>
                <button class="mobile-menu-toggle" aria-label="Toggle menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </header>
    `;

    // Define the footer content directly in the script
    const footerHTML = `
        <footer class="site-footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-logo">
                        <img src="assets/images/uaw-logo.png" alt="Universal Automation Wiki Logo">
                    </div>
                    <div class="footer-links">
                        <div class="footer-links-column">
                            <h4>Platform</h4>
                            <ul>
                                <li><a href="output.html">Example Workflows</a></li>
                                <li><a href="technical.html">Technical Details</a></li>
                            </ul>
                        </div>
                        <div class="footer-links-column">
                            <h4>Resources</h4>
                            <ul>
                                <li><a href="https://github.com/iterative-ai/">GitHub</a></li>
                                <li><a href="#">Documentation</a></li>
                            </ul>
                        </div>
                        <div class="footer-links-column">
                            <h4>Connect</h4>
                            <ul>
                                <li><a href="#">Twitter</a></li>
                                <li><a href="#">LinkedIn</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="copyright">
                    <p>&copy; 2025 Universal Automation Wiki. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;

    // Insert the header and footer without making network requests
    const headerPlaceholder = document.querySelector('#header-placeholder');
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = headerHTML;
        initializeHeaderFunctionality();
    }
    
    const footerPlaceholder = document.querySelector('#footer-placeholder');
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = footerHTML;
    }
});

// Re-initialize header functionality after dynamically loading the header
function initializeHeaderFunctionality() {
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
}
