/**
 * @module documentation
 * Provides functionality to render the documentation sidebar navigation.
 * Auto-generates navigation structure from actual HTML files in the docs directory.
 */

// Auto-generated documentation structure based on file system
// This will be populated dynamically by the generateDocsStructure function
let docsTree = [];

// Static mapping for known documentation files with their proper titles
// This helps provide clean titles without having to fetch each HTML file
const docTitles = {
  // Root level
  'architecture-overview': 'Architecture Overview',
  
  // Playground section
  'playground-guide': 'Playground Guide',
  'save-load': 'Save & Load System',
  'space-editor-guide': 'Space Editor Guide',
  
  // Routines section
  'assemble': 'Assemble',
  'automation-adoption': 'Automation Adoption',
  'basic-english': 'Basic English',
  'current-implementations': 'Current Implementations',
  'docs-translator': 'Docs Translator',
  'expand-node': 'Expand Node',
  'extract-steps': 'Extract Steps',
  'flow-maker': 'Flow Maker',
  'future-technology': 'Future Technology',
  'generate-automation-challenges': 'Generate Automation Challenges',
  'generate-automation-timeline': 'Generate Automation Timeline',
  'generate-metadata': 'Generate Metadata',
  'hallucinate-tree': 'Hallucinate Tree',
  'merge-duplicate-facts': 'Merge Duplicate Facts',
  'prompt': 'Prompt',
  'reconstructor': 'Reconstructor',
  'return-analysis': 'Return Analysis',
  'search-queries': 'Search Queries',
  'simplified-technical-english': 'Simplified Technical English',
  'specifications-industrial': 'Specifications Industrial',
  'summary': 'Summary',
  'utils': 'Utils',
  
  // Simulations section
  'constraints': 'Constraints',
  'metrics-editor': 'Metrics Editor',
  'validation': 'Validation',
  
  // Standards section
  'automation-status': 'Automation Status'
};

// Section display names for better presentation
const sectionNames = {
  'playground': 'Playground',
  'routines': 'Routines',
  'simulations': 'Simulations',
  'standards': 'Standards'
};

/**
 * Converts filename to a clean display title
 * @param {string} filename - The filename without extension
 * @returns {string} - Clean display title
 */
function getDocTitle(filename) {
  // Use static mapping if available
  if (docTitles[filename]) {
    return docTitles[filename];
  }
  
  // Otherwise, convert kebab-case to Title Case
  return filename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates the documentation structure from the known file structure
 * This simulates auto-discovery but uses the known structure for performance
 */
function generateDocsStructure() {
  const structure = [];
  
  // Define the known structure based on the file system
  const fileStructure = {
    // Root level files (excluding index.html)
    root: [
      'architecture-overview'
    ],
    
    // Sections with their files
    sections: {
      'playground': [
        'playground-guide',
        'save-load',
        'space-editor-guide',
        'display-editor-guide'
      ],
      'routines': [
        'assemble',
        'automation-adoption',
        'basic-english',
        'current-implementations',
        'docs-translator',
        'expand-node',
        'extract-steps',
        'flow-maker',
        'future-technology',
        'generate-automation-challenges',
        'generate-automation-timeline',
        'generate-metadata',
        'hallucinate-tree',
        'merge-duplicate-facts',
        'prompt',
        'reconstructor',
        'return-analysis',
        'search-queries',
        'simplified-technical-english',
        'specifications-industrial',
        'summary',
        'utils'
      ],
      'simulations': [
        'constraints',
        'metrics-editor',
        'universal-object-model',
        'validation-rules-reference',
        'validation'
      ],
      'standards': [
        'automation-status'
      ]
    }
  };
  
  // Add Documentation Home first
  structure.push({
    title: 'Documentation Home',
    path: '/docs/',
    type: 'page'
  });
  
  // Add root level items
  fileStructure.root.forEach(filename => {
    structure.push({
      title: getDocTitle(filename),
      path: `/docs/${filename}.html`,
      type: 'page'
    });
  });
  
  // Add sections with their pages
  Object.entries(fileStructure.sections).forEach(([sectionKey, files]) => {
    const section = {
      title: sectionNames[sectionKey] || getDocTitle(sectionKey),
      path: `#${sectionKey}`, // No actual page, just a section
      type: 'section',
      children: files.map(filename => ({
        title: getDocTitle(filename),
        path: `/docs/${sectionKey}/${filename}.html`,
        type: 'page'
      }))
    };
    
    structure.push(section);
  });
  
  return structure;
}

/**
 * Checks if the given item or any of its descendants match the current path.
 * @param {object} item - The current navigation tree item.
 * @param {string} currentPath - The current page's path.
 * @returns {boolean} - True if the item or a descendant is the current page.
 */
function isCurrentOrAncestor(item, currentPath) {
  // Normalize paths for comparison (remove trailing .html, handle both with/without)
  const normalizedItemPath = item.path.replace(/\.html$/, '');
  const normalizedCurrentPath = currentPath.replace(/\.html$/, '');
  
  if (normalizedItemPath === normalizedCurrentPath) {
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
    ul.classList.add('docs-submenu');
  } else {
    ul.classList.add('docs-nav-list');
  }

  items.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    
    // Set up the link
    if (item.type === 'section') {
      // Section headers are not clickable but expand/collapse
      a.href = 'javascript:void(0)';
      a.setAttribute('role', 'button');
      a.setAttribute('aria-expanded', 'false');
      li.classList.add('docs-section');
    } else {
      // Regular page links
      a.href = item.path;
      li.classList.add('docs-page');
    }
    
    a.textContent = item.title;

    // Handle sections with children
    if (item.children && item.children.length > 0) {
      li.classList.add('has-children');
      
      // Add expand/collapse functionality for sections
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = li.classList.toggle('open');
        a.setAttribute('aria-expanded', isOpen.toString());
        
        // Smooth animation for the submenu
        const submenu = li.querySelector('.docs-submenu');
        if (submenu) {
          if (isOpen) {
            submenu.style.maxHeight = submenu.scrollHeight + 'px';
          } else {
            submenu.style.maxHeight = '0';
          }
        }
      });
    }

    // Check if current or ancestor
    const isCurrent = isCurrentOrAncestor(item, currentPath) && item.type === 'page';
    const isAncestor = !isCurrent && item.children && 
                      item.children.some(child => isCurrentOrAncestor(child, currentPath));

    // Add active states
    if (isCurrent) {
      a.classList.add('active');
      li.classList.add('current-page');
    }
    
    if (isAncestor) {
      li.classList.add('open', 'active-section');
      a.classList.add('active-ancestor');
      a.setAttribute('aria-expanded', 'true');
    }

    // Create the list item structure
    li.appendChild(a);

    // Add children if they exist
    if (item.children && item.children.length > 0) {
      const childrenUl = buildList(item.children, currentPath, true);
      childrenUl.classList.add('docs-submenu');
      
      // Set initial state for submenu
      if (isAncestor) {
        // Use setTimeout to ensure DOM is rendered and scrollHeight is accurate
        setTimeout(() => {
          childrenUl.style.maxHeight = childrenUl.scrollHeight + 'px';
        }, 0);
      } else {
        childrenUl.style.maxHeight = '0';
      }
      
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

  // Generate the docs structure dynamically
  docsTree = generateDocsStructure();

  // Clear existing content
  container.innerHTML = '';

  // Create the aside wrapper with improved structure
  const aside = document.createElement('aside');
  aside.classList.add('sidebar');

  // Create the nav element
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Documentation navigation');
  nav.classList.add('docs-nav');

  // Add the 'Documentation' header with modern styling
  const header = document.createElement('h3');
  header.textContent = 'Documentation';
  header.classList.add('docs-nav-header');
  nav.appendChild(header);

  // Build the navigation list
  const currentPath = window.location.pathname;
  const rootUl = buildList(docsTree, currentPath);
  nav.appendChild(rootUl);

  // Append nav to aside, and aside to container
  aside.appendChild(nav);
  container.appendChild(aside);
  
  // Add smooth scroll behavior for internal navigation
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.href && !e.target.href.includes('javascript:')) {
      // Add a subtle loading state for better UX
      e.target.style.opacity = '0.7';
      setTimeout(() => {
        e.target.style.opacity = '1';
      }, 150);
    }
  });
}