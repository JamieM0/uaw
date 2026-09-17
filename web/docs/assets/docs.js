(() => {
    const root = document.documentElement;
    const themeButton = document.querySelector('[data-theme-toggle]');
    const menuButton = document.querySelector('[data-menu-toggle]');
    const searchDialog = document.querySelector('[data-search-dialog]');
    const searchTriggers = document.querySelectorAll('[data-search-trigger]');
    const searchInput = document.querySelector('[data-search-input]');
    const searchResults = document.querySelector('[data-search-results]');

    let pages = [];
    const searchIndexReady = fetch('/docs/assets/search-index.json')
        .then((response) => {
            if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
            return response.json();
        })
        .then((records) => {
            pages = Array.isArray(records) ? records : [];
        })
        .catch(() => {
            pages = [];
        });

    function setTheme(theme) {
        root.dataset.theme = theme;
        localStorage.setItem('workspec-docs-theme', theme);
        if (themeButton) {
            const label = theme === 'dark' ? 'Use light theme' : 'Use dark theme';
            themeButton.setAttribute('aria-label', label);
            themeButton.setAttribute('title', label);
        }
        window.dispatchEvent(new CustomEvent('workspec:themechange', { detail: { theme } }));
    }

    const savedTheme = localStorage.getItem('workspec-docs-theme');
    const preferredTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(savedTheme || preferredTheme);

    themeButton?.addEventListener('click', () => {
        setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    menuButton?.addEventListener('click', () => {
        const open = document.body.classList.toggle('nav-open');
        menuButton.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (event) => {
        if (!document.body.classList.contains('nav-open')) return;
        if (event.target.closest('.sidebar') || event.target.closest('[data-menu-toggle]')) return;
        document.body.classList.remove('nav-open');
        menuButton?.setAttribute('aria-expanded', 'false');
    });

    document.querySelectorAll('.code-block').forEach((block) => {
        const button = block.querySelector('.copy-button');
        const code = block.querySelector('code');
        if (!button || !code) return;
        button.addEventListener('click', async () => {
            await navigator.clipboard.writeText(code.textContent);
            button.textContent = 'Copied';
            setTimeout(() => { button.textContent = 'Copy'; }, 1400);
        });
    });

    function renderSearch(query = '') {
        if (!searchResults) return;
        const normalized = query.trim().toLowerCase();
        const matches = pages.filter((page) => !normalized || `${page.title} ${page.description} ${page.section}`.toLowerCase().includes(normalized));
        searchResults.replaceChildren();
        if (!matches.length) {
            const empty = document.createElement('li');
            empty.className = 'search-empty';
            empty.textContent = pages.length ? 'No documentation page matches that search.' : 'Search is unavailable.';
            searchResults.append(empty);
            return;
        }
        matches.forEach((page) => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            const title = document.createElement('strong');
            const section = document.createElement('span');
            link.href = page.href;
            title.textContent = page.title;
            section.textContent = page.section;
            link.append(title, section);
            item.append(link);
            searchResults.append(item);
        });
    }

    async function openSearch() {
        if (!searchDialog) return;
        await searchIndexReady;
        renderSearch();
        searchDialog.showModal();
        requestAnimationFrame(() => searchInput?.focus());
    }

    searchTriggers.forEach((trigger) => trigger.addEventListener('click', openSearch));
    searchInput?.addEventListener('input', () => renderSearch(searchInput.value));
    searchDialog?.addEventListener('click', (event) => {
        if (event.target === searchDialog) searchDialog.close();
    });

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openSearch();
        }
        if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.target.matches('input, textarea')) {
            event.preventDefault();
            openSearch();
        }
    });

    const workNodes = [...document.querySelectorAll('[data-work-node]')];
    const workPanels = [...document.querySelectorAll('[data-work-panel]')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let workSwitchTimer;
    let workSettleTimer;
    let workAutoTimer;

    function applyWorkNode(node, moveFocus = false) {
        workNodes.forEach((candidate) => {
            const selected = candidate === node;
            candidate.setAttribute('aria-selected', String(selected));
            candidate.tabIndex = selected ? 0 : -1;
        });
        workPanels.forEach((panel) => {
            panel.hidden = panel.id !== node.getAttribute('aria-controls');
        });
        if (moveFocus) node.focus();
    }

    function selectWorkNode(node, moveFocus = false, animate = true) {
        clearTimeout(workSwitchTimer);
        clearTimeout(workSettleTimer);
        [...workNodes, ...workPanels].forEach((element) => {
            element.classList.remove('is-fading-in', 'is-fading-out');
        });
        const currentNode = workNodes.find((candidate) => candidate.getAttribute('aria-selected') === 'true');
        if (!currentNode || currentNode === node || reducedMotion.matches || !animate) {
            applyWorkNode(node, moveFocus);
            return;
        }

        const currentPanel = document.getElementById(currentNode.getAttribute('aria-controls'));
        const nextPanel = document.getElementById(node.getAttribute('aria-controls'));
        currentNode.classList.add('is-fading-out');
        currentPanel?.classList.add('is-fading-out');

        workSwitchTimer = setTimeout(() => {
            currentNode.classList.remove('is-fading-out');
            currentPanel?.classList.remove('is-fading-out');
            applyWorkNode(node, moveFocus);
            node.classList.add('is-fading-in');
            nextPanel?.classList.add('is-fading-in');
            workSettleTimer = setTimeout(() => {
                node.classList.remove('is-fading-in');
                nextPanel?.classList.remove('is-fading-in');
            }, 240);
        }, 140);
    }

    function restartWorkRotation() {
        clearInterval(workAutoTimer);
        if (workNodes.length < 2) return;
        workAutoTimer = setInterval(() => {
            if (document.hidden) return;
            const currentIndex = workNodes.findIndex((node) => node.getAttribute('aria-selected') === 'true');
            const nextIndex = currentIndex === workNodes.length - 1 ? 0 : currentIndex + 1;
            selectWorkNode(workNodes[nextIndex]);
        }, 7000);
    }

    workNodes.forEach((node, index) => {
        node.addEventListener('click', () => {
            selectWorkNode(node);
            restartWorkRotation();
        });
        node.addEventListener('keydown', (event) => {
            const lastIndex = workNodes.length - 1;
            let nextIndex;
            if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
            if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = lastIndex;
            if (nextIndex === undefined) return;
            event.preventDefault();
            selectWorkNode(workNodes[nextIndex], true);
            restartWorkRotation();
        });
    });

    restartWorkRotation();

    const headings = [...document.querySelectorAll('.article h2[id]')];
    const tocLinks = new Map([...document.querySelectorAll('.toc a')].map((link) => [link.hash.slice(1), link]));
    if (headings.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((entry) => entry.isIntersecting).at(-1);
            if (!visible) return;
            tocLinks.forEach((link) => link.classList.remove('is-active'));
            tocLinks.get(visible.target.id)?.classList.add('is-active');
        }, { rootMargin: '-20% 0px -68% 0px', threshold: 0 });
        headings.forEach((heading) => observer.observe(heading));
    }
})();
