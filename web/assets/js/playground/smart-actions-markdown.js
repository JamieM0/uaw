// Smart Actions Markdown - Full-featured markdown parser using marked.js
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    /**
     * Full-featured markdown parser using marked.js library
     * Supports all standard markdown features including tables, code blocks, lists, etc.
     */
    class SmartActionsMarkdown {
        constructor() {
            this.markedInstance = null;
            this.initializeMarked();
        }

        /**
         * Initialize marked.js with custom configuration
         */
        async initializeMarked() {
            try {
                // Load marked.js from CDN if not already loaded
                if (typeof marked === 'undefined') {
                    await this.loadMarkedLibrary();
                }

                // Configure marked with custom settings
                if (typeof marked !== 'undefined') {
                    this.markedInstance = marked;

                    // Configure marked options
                    marked.setOptions({
                        breaks: true, // Convert line breaks to <br>
                        gfm: true, // Enable GitHub Flavored Markdown
                        tables: true, // Enable table parsing
                        sanitize: false, // We'll sanitize separately for security
                        highlight: function(code, lang) {
                            // Basic syntax highlighting placeholder
                            if (lang) {
                                return `<code class="language-${lang}">${this.escapeHtml(code)}</code>`;
                            }
                            return `<code>${this.escapeHtml(code)}</code>`;
                        }.bind(this)
                    });

                    // Set up custom renderer for headings to use Rubik font
                    const renderer = new marked.Renderer();
                    renderer.heading = function(text, level) {
                        const id = text.toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-')
                            .replace(/^-|-$/g, '');

                        return `<h${level} id="${id}" class="markdown-heading">${text}</h${level}>`;
                    };

                    renderer.table = function(header, body) {
                        return `<table class="markdown-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
                    };

                    renderer.code = function(code, language, escaped) {
                        const lang = language || '';
                        const langClass = lang ? ` class="language-${lang}"` : '';
                        return `<pre class="markdown-code-block"><code${langClass}>${escaped ? code : this.escapeHtml(code)}</code></pre>`;
                    }.bind(this);

                    marked.use({ renderer });
                }
            } catch (error) {
                console.warn('SmartActionsMarkdown: Could not initialize marked.js, falling back to basic parser:', error);
                this.markedInstance = null;
            }
        }

        /**
         * Load marked.js library from CDN
         */
        async loadMarkedLibrary() {
            return new Promise((resolve, reject) => {
                if (typeof marked !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        /**
         * Parse markdown text to HTML
         * @param {string} text - Markdown text
         * @returns {string} - HTML output
         */
        parse(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }

            // Use marked.js if available
            if (this.markedInstance) {
                try {
                    const html = this.markedInstance.parse(text);
                    return this.sanitize(html);
                } catch (error) {
                    console.warn('SmartActionsMarkdown: marked.js parsing failed, falling back to basic parser:', error);
                }
            }

            // Fallback to basic parsing if marked.js fails or isn't available
            return this.parseBasic(text);
        }

        /**
         * Basic fallback parser for when marked.js isn't available
         */
        parseBasic(text) {
            let html = text;
            const lines = html.split('\n');
            const result = [];
            let inCodeBlock = false;
            let inTable = false;
            let tableRows = [];
            let codeBlockLines = [];
            let codeBlockLang = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Handle code blocks
                if (trimmed.startsWith('```')) {
                    if (!inCodeBlock) {
                        // Starting code block
                        inCodeBlock = true;
                        codeBlockLang = trimmed.substring(3).trim();
                        codeBlockLines = [];
                    } else {
                        // Ending code block
                        inCodeBlock = false;
                        const langClass = codeBlockLang ? ` class="language-${this.escapeHtml(codeBlockLang)}"` : '';
                        result.push(`<pre class="markdown-code-block"><code${langClass}>${this.escapeHtml(codeBlockLines.join('\n'))}</code></pre>`);
                        codeBlockLang = '';
                    }
                    continue;
                }

                if (inCodeBlock) {
                    codeBlockLines.push(line);
                    continue;
                }

                // Handle table detection and parsing
                if (trimmed.includes('|') && !inTable) {
                    // Potential table start
                    inTable = true;
                    tableRows = [line];
                    continue;
                } else if (inTable) {
                    if (trimmed.includes('|')) {
                        tableRows.push(line);
                        continue;
                    } else {
                        // End of table
                        inTable = false;
                        result.push(this.parseTable(tableRows));
                        tableRows = [];
                        // Process current line normally
                    }
                }

                // Skip empty lines that are not part of tables/code blocks
                if (!trimmed) {
                    result.push('');
                    continue;
                }

                // Process regular lines
                let processedLine = this.processInlineFormatting(trimmed);

                // Handle headings
                if (trimmed.match(/^#{1,6}\s+/)) {
                    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
                    if (match) {
                        const level = Math.min(match[1].length, 6);
                        const content = match[2].trim();
                        const id = content.toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-')
                            .replace(/^-|-$/g, '');
                        processedLine = `<h${level} id="${id}" class="markdown-heading">${content}</h${level}>`;
                    }
                } else if (trimmed.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)) {
                    // List items
                    const match = trimmed.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
                    processedLine = `<li>${this.processInlineFormatting(match[3])}</li>`;
                } else {
                    // Regular paragraphs
                    processedLine = `<p>${processedLine}</p>`;
                }

                result.push(processedLine);
            }

            // Handle any remaining table
            if (inTable && tableRows.length > 0) {
                result.push(this.parseTable(tableRows));
            }

            // Process list grouping
            let finalHtml = result.join('\n');
            finalHtml = finalHtml.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
                return `<ul>${match}</ul>`;
            });

            return this.sanitize(finalHtml);
        }

        /**
         * Parse table from array of lines
         */
        parseTable(tableRows) {
            if (tableRows.length < 2) return tableRows.join('\n');

            let html = '<table class="markdown-table">';
            let headerProcessed = false;

            for (let i = 0; i < tableRows.length; i++) {
                const row = tableRows[i].trim();

                // Skip separator rows (like |---|---|---|
                if (row.match(/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/)) {
                    continue;
                }

                const cells = row.split('|').slice(1, -1); // Remove empty first/last
                if (cells.length === 0) continue;

                if (!headerProcessed) {
                    html += '<thead><tr>';
                    cells.forEach(cell => {
                        html += `<th>${this.processInlineFormatting(cell.trim())}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                    headerProcessed = true;
                } else {
                    html += '<tr>';
                    cells.forEach(cell => {
                        html += `<td>${this.processInlineFormatting(cell.trim())}</td>`;
                    });
                    html += '</tr>';
                }
            }

            html += '</tbody></table>';
            return html;
        }

        /**
         * Process inline formatting (bold, italic, code, links)
         */
        processInlineFormatting(text) {
            let formatted = text;

            // Bold
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Italic
            formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
            // Inline code
            formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Links
            formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

            return formatted;
        }


        /**
         * Escape HTML characters
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Basic HTML sanitization
         */
        sanitize(html) {
            // Allow only safe tags
            const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code', 'pre',
                               'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'br'];

            // Simple sanitization - in production, use DOMPurify
            let sanitized = html;

            // Remove dangerous attributes and scripts
            sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
            sanitized = sanitized.replace(/javascript:/gi, '');

            return sanitized;
        }
    }

    // Export to global scope
    window.SmartActionsMarkdown = SmartActionsMarkdown;

})();