document.addEventListener('DOMContentLoaded', function() {
    // Helper function to escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Helper function to validate component names (only allow alphanumeric and hyphens)
    function isValidComponentName(name) {
        return /^[a-zA-Z0-9-]+$/.test(name);
    }
    
    // Load all components with the 'data-component' attribute
    document.querySelectorAll('[data-component]').forEach(placeholder => {
        const componentName = placeholder.getAttribute('data-component');
        
        // Validate component name to prevent path traversal attacks
        if (!isValidComponentName(componentName)) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Error: Invalid component name';
            placeholder.appendChild(errorMsg);
            return;
        }
        
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (this.readyState === 4 && this.status === 200) {
                // Only set innerHTML if we explicitly trust the response content
                // In a production environment, you should validate/sanitize the response
                placeholder.innerHTML = this.responseText;
                
                // If this is the header, initialize its functionality
                if (componentName === 'header') {
                    initializeHeaderFunctionality();
                }
            } else if (this.readyState === 4) {
                // Use DOM methods to safely create error message
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Error loading ${componentName}`;
                placeholder.appendChild(errorMsg);
            }
        };
        xhr.open('GET', `components/${componentName}.html`, true);
        xhr.send();
    });
});

// Same initializeHeaderFunctionality function as before
function initializeHeaderFunctionality() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    mobileMenuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('open');
    });
}