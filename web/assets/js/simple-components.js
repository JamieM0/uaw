document.addEventListener('DOMContentLoaded', function() {
    // Load all components with the 'data-component' attribute
    document.querySelectorAll('[data-component]').forEach(placeholder => {
        const componentName = placeholder.getAttribute('data-component');
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (this.readyState === 4 && this.status === 200) {
                placeholder.innerHTML = this.responseText;
                
                // If this is the header, initialize its functionality
                if (componentName === 'header') {
                    initializeHeaderFunctionality();
                }
            } else if (this.readyState === 4) {
                placeholder.innerHTML = `<p>Error loading ${componentName}</p>`;
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