// Smart Actions Markdown - Rendering with library fallback
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    function createLibraryRenderer() {
        if (typeof window !== 'undefined' && typeof window.markdownit === 'function') {
            const md = window.markdownit({
                html: false,
                linkify: true,
                breaks: true,
                typographer: true
            });

            const originalValidateLink = md.validateLink.bind(md);
            md.validateLink = function(url) {
                const normalized = String(url || '').trim().toLowerCase();
                if (!normalized) {
                    return false;
                }
                if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) {
                    return false;
                }
                return originalValidateLink(url);
            };

            return input => md.render(String(input ?? ''));
        }
        return null;
    }

    function ensureSanitizer() {
        if (typeof sanitizeHTML !== 'function') {
            throw new Error('sanitizeHTML utility is required for SmartActionsMarkdown.');
        }
    }

    function renderFallbackMarkdown(content) {
        ensureSanitizer();
        if (content === null || content === undefined) {
            return '';
        }

        const text = String(content).replace(/\r\n/g, '\n');

        // Handle fenced code blocks first
        const codeBlockPattern = /```([\s\S]*?)```/g;
        let transformed = text.replace(codeBlockPattern, (match, code) => {
            return `__FENCED_CODE_BLOCK__${btoa(unescape(encodeURIComponent(code)))}__FENCED_CODE_BLOCK__`;
        });

        // Escape HTML entities for safety
        transformed = sanitizeHTML(transformed);

        // Restore fenced code blocks as <pre><code>
        transformed = transformed.replace(/__FENCED_CODE_BLOCK__(.*?)__FENCED_CODE_BLOCK__/g, (match, encoded) => {
            try {
                const decoded = decodeURIComponent(escape(atob(encoded)));
                return `<pre><code>${sanitizeHTML(decoded)}</code></pre>`;
            } catch (error) {
                return `<pre><code>${encoded}</code></pre>`;
            }
        });

        // Headings
        transformed = transformed
            .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
            .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
            .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Blockquotes
        transformed = transformed.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

        // Bold & italics
        transformed = transformed
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>');

        // Inline code
        transformed = transformed.replace(/`([^`]+?)`/g, '<code>$1</code>');

        // Tables (GitHub-style)
        transformed = transformed.replace(/(^|\n)(\|.+\|\n\|[-:|\s]+\|\n([\s\S]+?)(?=\n\n|$))/g, (match, prefix, tableBlock) => {
            const rows = tableBlock.trim().split('\n');
            if (rows.length < 2) {
                return match;
            }
            const headerCells = rows[0].split('|').slice(1, -1).map(cell => cell.trim());
            const bodyRows = rows.slice(2).map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));

            const headerHtml = headerCells.map(cell => `<th>${cell}</th>`).join('');
            const bodyHtml = bodyRows.map(cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
            return `${prefix}<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
        });

        // Unordered and ordered lists
        transformed = transformed.replace(/(^|\n)(\s*)([-*+]\s.+)(?=\n[^\s]|$)/g, (match) => {
            const lines = match.trim().split('\n');
            const items = lines.map(line => {
                const clean = line.replace(/^[-*+]\s+/, '');
                return `<li>${clean}</li>`;
            }).join('');
            return `\n<ul>${items}</ul>`;
        });

        transformed = transformed.replace(/(^|\n)(\s*)(\d+\.\s.+)(?=\n[^\s]|$)/g, (match) => {
            const lines = match.trim().split('\n');
            const items = lines.map(line => {
                const clean = line.replace(/^\d+\.\s+/, '');
                return `<li>${clean}</li>`;
            }).join('');
            return `\n<ol>${items}</ol>`;
        });

        // Paragraphs and line breaks
        const blocks = transformed
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {
                if (/^(<h\d|<ul>|<ol>|<pre>|<blockquote>|<table>)/.test(block)) {
                    return block;
                }
                return `<p>${block.replace(/\n/g, '<br>')}</p>`;
            });

        return blocks.join('\n');
    }

    const libraryRenderer = createLibraryRenderer();

    function renderMarkdown(content) {
        if (libraryRenderer) {
            try {
                return libraryRenderer(content);
            } catch (error) {
                console.warn('SmartActions: Markdown library render failed, using fallback.', error);
            }
        }
        return renderFallbackMarkdown(content);
    }

    window.SmartActionsMarkdown = {
        renderMarkdown
    };
})();
