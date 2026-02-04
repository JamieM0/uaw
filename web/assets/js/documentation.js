/**
 * @module documentation
 * Provides functionality to render the documentation sidebar navigation.
 *
 * Note: This is a static structure that maps to generated HTML in `web/docs/`.
 * If you move/add docs, update `generateDocsStructure()`.
 */

// Auto-generated documentation structure based on file system
// This will be populated dynamically by the generateDocsStructure function
let docsTree = [];

function makePage(title, path) {
    return {
        title,
        path,
        type: "page",
    };
}

function makeSection(title, key, children) {
    return {
        title,
        path: `#${key}`,
        type: "section",
        children,
    };
}

/**
 * Generates the documentation structure for the left navigation.
 */
function generateDocsStructure() {
    return [
        makePage("Documentation Home", "/docs/"),
        makePage("Architecture Overview", "/docs/architecture-overview"),

        makeSection("WorkSpec", "workspec", [
            makePage("Cheatsheet", "/docs/workspec/cheatsheet"),

            makeSection("Guides", "workspec-guides", [
                makePage("Quickstart", "/docs/workspec/guides/quickstart"),
                makePage("Migration", "/docs/workspec/guides/migration"),
                makePage("AI Generation", "/docs/workspec/guides/ai-generation"),
                makePage("Cookbook", "/docs/workspec/guides/cookbook"),
            ]),

            makeSection("Reference", "workspec-reference", [
                makePage("Types", "/docs/workspec/reference/types"),
                makePage("Properties", "/docs/workspec/reference/properties"),
                makePage("Errors", "/docs/workspec/reference/errors"),
            ]),

            makeSection("Specification", "workspec-specification", [
                makeSection("v2.0", "workspec-specification-v2", [
                    makePage(
                        "Overview",
                        "/docs/workspec/specification/v2.0/",
                    ),
                    makePage("Schema", "/docs/workspec/specification/v2.0/schema"),
                    makePage(
                        "Objects",
                        "/docs/workspec/specification/v2.0/objects",
                    ),
                    makePage("Tasks", "/docs/workspec/specification/v2.0/tasks"),
                    makePage(
                        "Interactions",
                        "/docs/workspec/specification/v2.0/interactions",
                    ),
                    makePage(
                        "Validation",
                        "/docs/workspec/specification/v2.0/validation",
                    ),
                    makePage(
                        "Changelog",
                        "/docs/workspec/specification/v2.0/changelog",
                    ),
                ]),

                makeSection("v1.0", "workspec-specification-v1", [
                    makePage(
                        "Overview",
                        "/docs/workspec/specification/v1.0/",
                    ),
                    makePage(
                        "Universal Object Model",
                        "/docs/workspec/specification/v1.0/universal-object-model",
                    ),
                ]),
            ]),
        ]),

        makeSection("Playground", "playground", [
            makeSection("Guides", "playground-guides", [
                makePage("Playground Guide", "/docs/playground/playground-guide"),
                makePage(
                    "Space Editor Guide",
                    "/docs/playground/space-editor-guide",
                ),
                makePage(
                    "Display Editor Guide",
                    "/docs/playground/display-editor-guide",
                ),
                makePage("Smart Actions", "/docs/playground/smart-actions"),
                makePage("Save & Load", "/docs/playground/save-load"),
                makePage(
                    "Multi-Day Simulations",
                    "/docs/playground/multi-day-simulations",
                ),
            ]),

            makeSection("Simulation & Validation", "playground-simulation", [
                makePage(
                    "Universal Object Model (Simulation)",
                    "/docs/simulations/universal-object-model",
                ),
                makePage("Actor Movement", "/docs/simulations/actor-movement"),
                makePage(
                    "Simulation & Validation System",
                    "/docs/simulations/validation",
                ),
                makePage(
                    "Validation Rules Reference",
                    "/docs/simulations/validation-rules-reference",
                ),
                makePage(
                    "Metric & Constraint ID Standardization",
                    "/docs/simulations/constraints",
                ),
                makePage("Metrics Editor", "/docs/simulations/metrics-editor"),
            ]),
        ]),

        makeSection("Developer", "developer", [
            makeSection("Routines", "developer-routines", [
                makePage("Flow Maker", "/docs/routines/flow-maker"),
                makePage("Assemble", "/docs/routines/assemble"),
                makePage(
                    "Generate Metadata",
                    "/docs/routines/generate-metadata",
                ),
                makePage("Hallucinate Tree", "/docs/routines/hallucinate-tree"),
                makePage(
                    "Generate Automation Timeline",
                    "/docs/routines/generate-automation-timeline",
                ),
                makePage(
                    "Generate Automation Challenges",
                    "/docs/routines/generate-automation-challenges",
                ),
                makePage(
                    "Automation Adoption",
                    "/docs/routines/automation-adoption",
                ),
                makePage(
                    "Current Implementations",
                    "/docs/routines/current-implementations",
                ),
                makePage("Return Analysis", "/docs/routines/return-analysis"),
                makePage("Future Technology", "/docs/routines/future-technology"),
                makePage(
                    "Specifications Industrial",
                    "/docs/routines/specifications-industrial",
                ),
                makePage("Docs Translator", "/docs/routines/docs-translator"),
                makePage("Expand Node", "/docs/routines/expand-node"),
                makePage("Extract Steps", "/docs/routines/extract-steps"),
                makePage("Merge Duplicate Facts", "/docs/routines/merge-duplicate-facts"),
                makePage("Prompt", "/docs/routines/prompt"),
                makePage("Reconstructor", "/docs/routines/reconstructor"),
                makePage("Search Queries", "/docs/routines/search-queries"),
                makePage("Summary", "/docs/routines/summary"),
                makePage("Utils", "/docs/routines/utils"),
                makePage("Basic English", "/docs/routines/basic-english"),
                makePage(
                    "Simplified Technical English",
                    "/docs/routines/simplified-technical-english",
                ),
            ]),

            makeSection("Standards", "developer-standards", [
                makePage(
                    "Automation Status Taxonomy",
                    "/docs/standards/automation-status",
                ),
            ]),
        ]),
    ];
}

function normalizeDocPath(path) {
    let normalized = path.split("?")[0].split("#")[0];

    normalized = normalized.replace(/\.html$/, "");
    normalized = normalized.replace(/\/index$/, "");

    if (normalized.length > 1) {
        normalized = normalized.replace(/\/$/, "");
    }

    return normalized;
}

/**
 * Checks if the given item or any of its descendants match the current path.
 * @param {object} item - The current navigation tree item.
 * @param {string} currentPath - The current page's path.
 * @returns {boolean} - True if the item or a descendant is the current page.
 */
function isCurrentOrAncestor(item, currentPath) {
    // Normalize paths for comparison (handle .html, /index, and trailing slashes)
    const normalizedItemPath = normalizeDocPath(item.path);
    const normalizedCurrentPath = normalizeDocPath(currentPath);

    if (normalizedItemPath === normalizedCurrentPath) {
        return true;
    }

    if (item.children) {
        return item.children.some((child) => isCurrentOrAncestor(child, currentPath));
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
    const ul = document.createElement("ul");
    if (isSubmenu) {
        ul.classList.add("docs-submenu");
    } else {
        ul.classList.add("docs-nav-list");
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        const a = document.createElement("a");

        // Set up the link
        if (item.type === "section") {
            // Section headers are not clickable but expand/collapse
            a.href = "javascript:void(0)";
            a.setAttribute("role", "button");
            a.setAttribute("aria-expanded", "false");
            li.classList.add("docs-section");
        } else {
            // Regular page links
            a.href = item.path;
            li.classList.add("docs-page");
        }

        a.textContent = item.title;

        // Handle sections with children
        if (item.children && item.children.length > 0) {
            li.classList.add("has-children");

            // Add expand/collapse functionality for sections
            a.addEventListener("click", (e) => {
                e.preventDefault();
                const isOpen = li.classList.toggle("open");
                a.setAttribute("aria-expanded", isOpen.toString());

                // Smooth animation for the submenu
                const submenu = li.querySelector(".docs-submenu");
                if (submenu) {
                    if (isOpen) {
                        submenu.style.maxHeight = submenu.scrollHeight + "px";
                    } else {
                        submenu.style.maxHeight = "0";
                    }
                }
            });
        }

        // Check if current or ancestor
        const isCurrent =
            isCurrentOrAncestor(item, currentPath) && item.type === "page";
        const isAncestor =
            !isCurrent &&
            item.children &&
            item.children.some((child) => isCurrentOrAncestor(child, currentPath));

        // Add active states
        if (isCurrent) {
            a.classList.add("active");
            li.classList.add("current-page");
        }

        if (isAncestor) {
            li.classList.add("open", "active-section");
            a.classList.add("active-ancestor");
            a.setAttribute("aria-expanded", "true");
        }

        // Create the list item structure
        li.appendChild(a);

        // Add children if they exist
        if (item.children && item.children.length > 0) {
            const childrenUl = buildList(item.children, currentPath, true);
            childrenUl.classList.add("docs-submenu");

            // Set initial state for submenu
            if (isAncestor) {
                // Use setTimeout to ensure DOM is rendered and scrollHeight is accurate
                setTimeout(() => {
                    childrenUl.style.maxHeight = childrenUl.scrollHeight + "px";
                }, 0);
            } else {
                childrenUl.style.maxHeight = "0";
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
        console.error(
            `Documentation sidebar container not found: ${containerSelector}`,
        );
        return;
    }

    // Generate the docs structure dynamically
    docsTree = generateDocsStructure();

    // Clear existing content
    container.innerHTML = "";

    // Create the aside wrapper with improved structure
    const aside = document.createElement("aside");
    aside.classList.add("sidebar");

    // Create the nav element
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Documentation navigation");
    nav.classList.add("docs-nav");

    // Add the 'Documentation' header with modern styling
    const header = document.createElement("h3");
    header.textContent = "Documentation";
    header.classList.add("docs-nav-header");
    nav.appendChild(header);

    // Build the navigation list
    const currentPath = window.location.pathname;
    const rootUl = buildList(docsTree, currentPath);
    nav.appendChild(rootUl);

    // Append nav to aside, and aside to container
    aside.appendChild(nav);
    container.appendChild(aside);

    // Add smooth scroll behavior for internal navigation
    nav.addEventListener("click", (e) => {
        if (
            e.target.tagName === "A" &&
            e.target.href &&
            !e.target.href.includes("javascript:")
        ) {
            // Add a subtle loading state for better UX
            e.target.style.opacity = "0.7";
            setTimeout(() => {
                e.target.style.opacity = "1";
            }, 150);
        }
    });
}
