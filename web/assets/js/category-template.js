document.addEventListener('DOMContentLoaded', function() {
    // Get category data from the page's data attributes
    const categoryContainer = document.getElementById('category-items');
    if (!categoryContainer) return;

    const categoryTitle = categoryContainer.getAttribute('data-category-title');
    const categoryItems = JSON.parse(categoryContainer.getAttribute('data-category-items'));
    
    // Create title
    document.title = `${categoryTitle} - Universal Automation Wiki`;
    const titleElement = document.querySelector('h1');
    if (titleElement) {
        titleElement.textContent = categoryTitle;
    }
    
    // Helper function to escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Helper function to validate URLs
    function isValidUrl(url) {
        try {
            // Allow relative URLs and absolute URLs
            return url.startsWith('/') || url.startsWith('#') || new URL(url);
        } catch {
            return false;
        }
    }
    
    // Create category cards using DOM methods to avoid XSS
    categoryContainer.innerHTML = ''; // Clear existing content
    
    categoryItems.forEach(item => {
        // Validate and sanitize the URL
        const safeUrl = isValidUrl(item.url) ? item.url : '#';
        
        // Create card element
        const card = document.createElement('div');
        card.className = 'category-card';
        
        // Create and append icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'category-icon';
        iconDiv.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        
        // Create and append title (escaped)
        const title = document.createElement('h3');
        title.textContent = item.title;
        
        // Create and append description (escaped)
        const description = document.createElement('p');
        description.textContent = item.description;
        
        // Create and append link (with validated URL)
        const link = document.createElement('a');
        link.href = safeUrl;
        link.className = 'category-link';
        link.textContent = 'View Details';
        
        // Assemble the card
        card.appendChild(iconDiv);
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(link);
        
        // Add to container
        categoryContainer.appendChild(card);
    });
    
    // Set breadcrumbs using DOM methods to avoid XSS
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    if (breadcrumbsContainer) {
        const breadcrumbs = JSON.parse(breadcrumbsContainer.getAttribute('data-breadcrumbs'));
        
        // Clear existing content
        breadcrumbsContainer.innerHTML = '';
        
        breadcrumbs.forEach((crumb, index) => {
            const span = document.createElement('span');
            
            if (index < breadcrumbs.length - 1) {
                // Validate and sanitize the URL
                const safeUrl = isValidUrl(crumb.url) ? crumb.url : '#';
                
                const link = document.createElement('a');
                link.href = safeUrl;
                link.textContent = crumb.title;
                span.appendChild(link);
            } else {
                span.textContent = crumb.title;
            }
            
            breadcrumbsContainer.appendChild(span);
        });
    }
});
