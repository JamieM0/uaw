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
    
    // Create category cards
    let categoryHTML = '';
    
    categoryItems.forEach(item => {
        categoryHTML += `
            <div class="category-card">
                <div class="category-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <h3>${item.title}</h3>
                <p>${item.description}</p>
                <a href="${item.url}" class="category-link">View Details</a>
            </div>
        `;
    });
    
    categoryContainer.innerHTML = categoryHTML;
    
    // Set breadcrumbs
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    if (breadcrumbsContainer) {
        const breadcrumbs = JSON.parse(breadcrumbsContainer.getAttribute('data-breadcrumbs'));
        let breadcrumbsHTML = '';
        
        breadcrumbs.forEach((crumb, index) => {
            if (index < breadcrumbs.length - 1) {
                breadcrumbsHTML += `<span><a href="${crumb.url}">${crumb.title}</a></span>`;
            } else {
                breadcrumbsHTML += `<span>${crumb.title}</span>`;
            }
        });
        
        breadcrumbsContainer.innerHTML = breadcrumbsHTML;
    }
});
