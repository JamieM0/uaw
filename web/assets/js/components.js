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
            <div class="container header-inner">
                <a href="/" class="logo-link">
                    <img src="/assets/images/logo-primary-inline.svg" alt="Universal Automation Wiki" class="logo-desktop">
                    <img src="/assets/images/logo-abbrev-inline.svg" alt="UAW" class="logo-mobile" style="display:none">
                </a>
                <ul class="nav-links" id="navLinks">
                    <li><a href="/about.html">About</a></li>
                    <li><a href="/docs/">Documentation</a></li>
                    <li><a href="https://github.com/JamieM0/uaw" target="_blank" rel="noopener">GitHub</a></li>
                </ul>
                <div class="nav-actions">
                    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
                        <span class="theme-icon">&#9789;</span>
                    </button>
                    <a href="/playground.html" class="btn btn-primary">Playground</a>
                    <button class="mobile-toggle" id="mobileToggle" aria-label="Toggle menu" aria-expanded="false">
                        <span></span><span></span><span></span>
                    </button>
                </div>
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
  // Theme toggle
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const icon = themeToggle.querySelector(".theme-icon");
    const html = document.documentElement;

    // Apply saved preference
    const saved = localStorage.getItem("uaw-theme");
    if (saved) {
      html.setAttribute("data-theme", saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.setAttribute("data-theme", "dark");
    }

    function updateIcon() {
      const isDark = html.getAttribute("data-theme") === "dark";
      if (icon) icon.textContent = isDark ? "\u2600" : "\u263D";
    }
    updateIcon();

    themeToggle.addEventListener("click", function () {
      const current = html.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("uaw-theme", next);
      updateIcon();
    });
  }

  // Mobile menu toggle
  const mobileToggle = document.getElementById("mobileToggle");
  const navLinks = document.getElementById("navLinks");

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener("click", function () {
      const expanded = mobileToggle.getAttribute("aria-expanded") === "true";
      mobileToggle.setAttribute("aria-expanded", String(!expanded));
      navLinks.classList.toggle("open");
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener("click", function (event) {
    if (
      navLinks &&
      navLinks.classList.contains("open") &&
      !event.target.closest(".nav-links") &&
      !event.target.closest(".mobile-toggle")
    ) {
      navLinks.classList.remove("open");
      if (mobileToggle) {
        mobileToggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}
