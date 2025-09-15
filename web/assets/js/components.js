document.addEventListener("DOMContentLoaded", function () {
  // Define the persona data that the header selector will use.
  // This needs to be available when the header is injected.
  const PERSONAS_DATA_FOR_HEADER = {
    hobbyist: "Hobbyist",
    researcher: "Researcher",
    investor: "Investor",
    educator: "Educator",
    field_expert: "Field Expert",
  };

  // Define the header content directly in the script to avoid network request delay
  const headerHTML = `
        <header class="site-header">
            <div class="container header-container">
                <div class="logo">
                    <a href="/">
                        <img src="/assets/images/logo-primary-stacked.png" alt="Universal Automation Wiki Logo" class="logo-desktop">
                        <img src="/assets/images/logo-abbrev-stacked.png" alt="Universal Automation Wiki Logo" class="logo-mobile">
                    </a>
                </div>
                <nav class="main-nav">
                    <ul>
                        <li><a href="/playground.html">Playground</a></li>
                        <li><a href="/#categories">Examples</a></li>
                        <li><a href="/docs">Documentation</a></li>
                        <li><a href="/about.html">About</a></li>
                        <li><a href="https://github.com/JamieM0/uaw" target="_blank">GitHub</a></li>
                    </ul>
                </nav>
                <div class="header-persona-selector">
                    <label for="persona-selector-header">View as:</label>
                    <select id="persona-selector-header" name="persona-header">
                        <!-- Options will be populated by main.js -->
                    </select>
                </div>
                <button class="mobile-menu-toggle" aria-label="Toggle menu" aria-expanded="false">
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
                        <img src="/assets/images/logo-primary-stacked.png" alt="Universal Automation Wiki Logo">
                    </div>
                    <div class="footer-links">
                        <div class="footer-links-column">
                            <h4>Platform</h4>
                            <ul>
                                <li><a href="/about.html">About</a></li>
                                <li><a href="/playground.html">Simulation Playground</a></li>
                            </ul>
                        </div>
                        <div class="footer-links-column">
                            <h4>Resources</h4>
                            <ul>
                                <li><a href="https://github.com/JamieM0/uaw" target="_blank">GitHub</a></li>
                                <li><a href="/docs">Documentation</a></li>
                            </ul>
                        </div>
                        <div class="footer-links-column">
                            <h4>Connect</h4>
                            <ul>
                                <li><a href="https://x.com/automation_wiki">Twitter</a></li>
                                <li><a href="mailto:contact@universalautomation.wiki">Email</a></li>
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
  const headerPlaceholder = document.querySelector("#header-placeholder");
  if (headerPlaceholder) {
    headerPlaceholder.innerHTML = headerHTML;

    // Create and append the persona data script tag
    // This was previously done when header.html was fetched,
    // now it needs to be done here after headerHTML is injected.
    if (document.getElementById("core-personas-data")) {
      console.warn(
        "components.js: #core-personas-data script tag already exists. Skipping creation.",
      );
    } else {
      const personasDataScript = document.createElement("script");
      personasDataScript.id = "core-personas-data";
      personasDataScript.type = "application/json";
      personasDataScript.textContent = JSON.stringify(PERSONAS_DATA_FOR_HEADER);
      document.body.appendChild(personasDataScript);
      console.log(
        "components.js: #core-personas-data script tag created and appended.",
      );
    }

    initializeHeaderFunctionality(); // Initializes mobile menu, etc.

    // Dispatch a custom event indicating the header and its data are loaded
    const event = new CustomEvent("headerloaded", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    console.log('components.js: "headerloaded" event dispatched.');
  }

  const footerPlaceholder = document.querySelector("#footer-placeholder");
  if (footerPlaceholder) {
    footerPlaceholder.innerHTML = footerHTML;
  }
});

// Re-initialize header functionality after dynamically loading the header
function initializeHeaderFunctionality() {
  // Mobile menu toggle
  const menuToggle = document.querySelector(".mobile-menu-toggle");
  const mainNav = document.querySelector(".main-nav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", function () {
      mainNav.classList.toggle("active");

      // Update aria-expanded attribute for accessibility
      const isExpanded = mainNav.classList.contains("active");
      menuToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener("click", function (event) {
    if (
      mainNav &&
      mainNav.classList.contains("active") &&
      !event.target.closest(".main-nav") &&
      !event.target.closest(".mobile-menu-toggle")
    ) {
      mainNav.classList.remove("active");
      if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}
