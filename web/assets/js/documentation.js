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
  },
  {
    title: "Routines",
    path: "/docs/routines",
    children: [
      { title: "- Assemble", path: "/docs/routines/assemble" },
      { title: "- Automation Adoption", path: "/docs/routines/automation-adoption" },
      { title: "- Basic English", path: "/docs/routines/basic-english" },
      { title: "- Current Implementations", path: "/docs/routines/current-implementations" },
      { title: "- Docs Translator", path: "/docs/routines/docs-translator" },
      { title: "- Expand Node", path: "/docs/routines/expand-node" },
      { title: "- Extract Steps", path: "/docs/routines/extract-steps" },
      { title: "- Flow Maker", path: "/docs/routines/flow-maker" },
      { title: "- Future Technology", path: "/docs/routines/future-technology" },
      { title: "- Generate Automation Challenges", path: "/docs/routines/generate-automation-challenges" },
      { title: "- Generate Automation Timeline", path: "/docs/routines/generate-automation-timeline" },
      { title: "- Generate Metadata", path: "/docs/routines/generate-metadata" },
      { title: "- Hallucinate Tree", path: "/docs/routines/hallucinate-tree" },
      { title: "- Merge Duplicate Facts", path: "/docs/routines/merge-duplicate-facts" },
      { title: "- Prompt", path: "/docs/routines/prompt" },
      { title: "- Reconstructor", path: "/docs/routines/reconstructor" },
      { title: "- Return Analysis", path: "/docs/routines/return-analysis" },
      { title: "- Search Queries", path: "/docs/routines/search-queries" },
      { title: "- Simplified Technical English", path: "/docs/routines/simplified-technical-english" },
      { title: "- Specifications Industrial", path: "/docs/routines/specifications-industrial" },
      { title: "- Summary", path: "/docs/routines/summary" },
      { title: "- Utils", path: "/docs/routines/utils" }
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
function buildList(items, currentPath, isSubmenu = false) {
  const ul = document.createElement('ul');
  if (isSubmenu) {
    ul.classList.add('submenu');
  }

  items.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.path;
    a.textContent = item.title;

    if (item.children && item.children.length > 0) {
      li.classList.add('has-children');
      // Make parent item clickable to toggle submenu
      a.href = 'javascript:void(0)'; // Prevent navigation
      a.addEventListener('click', (e) => {
        e.preventDefault();
        li.classList.toggle('open');
        // Ensure the link still navigates if it's a direct page link too
        // For now, we assume parent items are categories, not pages themselves
        // If a parent could be a page, this logic needs adjustment
      });
    } else if (isSubmenu) {
      li.classList.add('submenu-item');
    } else {
      li.classList.add('main-topic-item');
    }


    const isCurrent = item.path === currentPath;
    // An ancestor is active if one of its children is the current path
    const isAncestor = !isCurrent && item.children && item.children.some(child => isCurrentOrAncestor(child, currentPath));

    // Always append the link directly
    li.appendChild(a);

    // Add 'active' class if it's the current page or an ancestor
    if (isCurrent) {
      a.classList.add('active');
    }
    if (isAncestor) {
      // If an ancestor is active, it should also be open
      li.classList.add('open');
      // The direct link of the ancestor itself might not be 'active' unless it's also the current page
      // but we want to highlight it if a child is active.
      // We can add a specific class for this or rely on styling .has-children.open > a
      a.classList.add('active-ancestor'); // New class for styling active ancestors
    }


    if (item.children && item.children.length > 0) {
      const childrenUl = buildList(item.children, currentPath, true); // Pass true for isSubmenu
      li.appendChild(childrenUl);
      // If it's an ancestor of the current page, ensure it's open by default
      if (isAncestor) {
        li.classList.add('open');
      }
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