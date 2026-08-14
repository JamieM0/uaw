// UAW Playground v2 - restrained Motion interaction layer
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const noopMotion = {
    workspaceChange() {},
    panelChange() {},
    panelToggle() {},
    listEnter() {},
    dialogEnter() {},
    saved() {},
    toastEnter() {},
    toastExit(element, complete) { complete?.(); },
    changeHighlight() {}
};

window.UAWMotion = noopMotion;

try {
    const { animate, stagger } = await import('https://cdn.jsdelivr.net/npm/motion@12.29.2/+esm');

    const canAnimate = () => !reduceMotion.matches;
    const safeAnimate = (target, keyframes, options) => {
        if (!canAnimate() || !target) return null;
        try {
            return animate(target, keyframes, options);
        } catch (_error) {
            return null;
        }
    };

    window.UAWMotion = {
        workspaceChange() {
            const stage = document.querySelector('.uaw-stage');
            safeAnimate(stage, { opacity: [0.72, 1], x: [4, 0] }, {
                duration: 0.19,
                ease: [0.2, 0.8, 0.2, 1]
            });
            const identity = document.querySelector('.uaw-commandbar__identity');
            safeAnimate(identity, { opacity: [0.45, 1], y: [-2, 0] }, {
                duration: 0.16,
                ease: [0, 0, 0.58, 1]
            });
        },

        panelChange(selector, open) {
            const panel = document.querySelector(selector);
            if (!panel) return;
            safeAnimate(panel, open
                ? { opacity: [0, 1], x: [selector.includes('inspector') ? 8 : -8, 0] }
                : { opacity: [1, 0] }, {
                duration: open ? 0.2 : 0.12,
                ease: open ? [0.2, 0.8, 0.2, 1] : [0.42, 0, 1, 1]
            });
        },

        panelToggle(selector, open) {
            this.panelChange(selector, open);
        },

        listEnter(selector) {
            const elements = document.querySelectorAll(selector);
            if (!elements.length) return;
            safeAnimate(elements, { opacity: [0, 1], y: [5, 0] }, {
                duration: 0.2,
                delay: stagger(0.025),
                ease: [0, 0, 0.58, 1]
            });
        },

        dialogEnter(selector) {
            const dialog = document.querySelector(selector);
            safeAnimate(dialog, { opacity: [0, 1], y: [-7, 0], scale: [0.992, 1] }, {
                duration: 0.18,
                ease: [0.2, 0.8, 0.2, 1]
            });
        },

        saved(element) {
            safeAnimate(element, { opacity: [0.55, 1], x: [-2, 0] }, {
                duration: 0.18,
                ease: [0, 0, 0.58, 1]
            });
        },

        toastEnter(element) {
            safeAnimate(element, { opacity: [0, 1], x: [12, 0] }, {
                duration: 0.2,
                ease: [0.2, 0.8, 0.2, 1]
            });
        },

        toastExit(element, complete) {
            const controls = safeAnimate(element, { opacity: [1, 0], x: [0, 8] }, {
                duration: 0.12,
                ease: [0.42, 0, 1, 1]
            });
            if (controls?.then) controls.then(complete);
            else setTimeout(complete, 130);
        },

        changeHighlight(target) {
            safeAnimate(target, { backgroundColor: ['rgba(18,108,168,.16)', 'rgba(18,108,168,0)'] }, {
                duration: 0.7,
                ease: [0, 0, 0.58, 1]
            });
        }
    };

    const setupMotionObservers = () => {
        document.addEventListener('pointerdown', (event) => {
            const button = event.target.closest('button:not(:disabled), .uaw-project-card__open');
            if (!button || button.closest('.monaco-editor')) return;
            safeAnimate(button, { scale: [1, 0.985] }, { duration: 0.08, ease: [0, 0, 0.58, 1] });
        });

        document.addEventListener('pointerup', (event) => {
            const button = event.target.closest('button:not(:disabled), .uaw-project-card__open');
            if (!button || button.closest('.monaco-editor')) return;
            safeAnimate(button, { scale: 1 }, { duration: 0.1, ease: [0, 0, 0.58, 1] });
        });

        window.addEventListener('uaw:canvas-changed', () => {
            const content = document.querySelector('.simulation-panel .tab-content.active');
            safeAnimate(content, { opacity: [0.65, 1] }, { duration: 0.16, ease: [0, 0, 0.58, 1] });
        });

        const validationRoot = document.getElementById('validation-results-grouped');
        if (validationRoot) {
            const observer = new MutationObserver((records) => {
                records.forEach((record) => {
                    record.addedNodes.forEach((node) => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return;
                        safeAnimate(node, { opacity: [0, 1], y: [3, 0] }, {
                            duration: 0.16,
                            ease: [0, 0, 0.58, 1]
                        });
                    });
                });
            });
            observer.observe(validationRoot, { childList: true, subtree: true });
        }

        document.addEventListener('dragstart', (event) => {
            const draggable = event.target.closest('.task-block, .location-rect, .digital-location-rect, .display-element-rect');
            if (draggable) safeAnimate(draggable, { opacity: 0.84, scale: 1.01 }, { duration: 0.1 });
        });

        document.addEventListener('dragend', (event) => {
            const draggable = event.target.closest('.task-block, .location-rect, .digital-location-rect, .display-element-rect');
            if (draggable) safeAnimate(draggable, { opacity: 1, scale: 1 }, {
                duration: 0.18,
                type: 'spring',
                stiffness: 520,
                damping: 38
            });
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMotionObservers, { once: true });
    } else {
        setupMotionObservers();
    }

    window.dispatchEvent(new CustomEvent('uaw:motion-ready'));
} catch (error) {
    console.warn('Motion could not be loaded; the Playground will use instant state changes.', error);
}
