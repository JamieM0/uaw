/**
 * @module documentation
 * Provides functionality to render the documentation sidebar navigation.
 */

// Define the structure of the documentation navigation tree.
// Paths should be relative to the web root.
const docsTree = [
  { title: "Home", path: "/docs" },
  {
    title: "Standards",
    path: "/docs/standards",
    children: [
      { title: "- Automation Status", path: "/docs/standards/automation-status" }
    ]
  }
];

/**
 * Checks if the given item or any of its descendants match the current path.
 * @param {object} item - The current navigation tree item.
 * @param {string} currentPath - The current page's path.
 * @returns {boolean} - True if the item or a descendant is the current page.
 */
function isCurrentOrAncestor(item, currentPath) {
  if (item.path === currentPath) {
    return true;
  }
  if (item.children) {
    return item.children.some(child => isCurrentOrAncestor(child, currentPath));
  }
  return false;
}

/**
 * Recursively builds the HTML list for the navigation tree.
 * @param {Array<object>} items - An array of navigation tree items.
 * @param {string} currentPath - The current page's path.
 * @returns {HTMLUListElement} - The generated UL element.
 */
function buildList(items, currentPath) {
  const ul = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.path;
    a.textContent = item.title;

    const isCurrent = item.path === currentPath;
    const isAncestor = !isCurrent && item.children && isCurrentOrAncestor(item, currentPath);

    // Always append the link directly
    li.appendChild(a);

    // Add 'active' class if it's the current page or an ancestor
    if (isCurrent || isAncestor) {
      a.classList.add('active');
    }

    if (item.children && item.children.length > 0) {
      const childrenUl = buildList(item.children, currentPath);
      li.appendChild(childrenUl);
    }
    ul.appendChild(li);
  });
  return ul;
}

/**
 * Renders the documentation sidebar navigation into the specified container.
 * @param {string} containerSelector - CSS selector for the container element.
 */
function renderDocumentationSidebar(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error(`Documentation sidebar container not found: ${containerSelector}`);
    return;
  }
  // Ensure container has the 'sidebar' class
  // The 'sidebar' class should only be on the <aside> element, not the container

  // Clear existing content
  container.innerHTML = '';

  // Create the aside wrapper
  const aside = document.createElement('aside');
  aside.classList.add('sidebar'); // Add sidebar class to the aside element

  // Create the nav element
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Documentation pages');

  // Add the 'Documentation' header inside nav
  const header = document.createElement('h3');
  header.textContent = 'Documentation';
  nav.appendChild(header);

  // Build the navigation list
  const currentPath = window.location.pathname;
  const rootUl = buildList(docsTree, currentPath);
  nav.appendChild(rootUl);

  // Append nav to aside, and aside to container
  aside.appendChild(nav);
  container.appendChild(aside);
}

// Example usage (optional, could be called from another script or inline):
// document.addEventListener('DOMContentLoaded', () => {
//   renderDocumentationSidebar('#documentation-sidebar-container');
// });

// Export the function if using modules (adjust based on project setup)
// export { renderDocumentationSidebar, docsTree };