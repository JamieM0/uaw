// Custom Emoji Picker for Universal Automation Wiki
// Workplace-focused emoji picker with advanced alias system

class EmojiPicker {
    constructor(options = {}) {
        this.options = {
            theme: 'uaw',
            position: 'auto',
            searchPlaceholder: 'Search workplace emojis...',
            showSearch: true,
            showCategories: true,
            maxRecentEmojis: 24,
            autoOpen: false,
            ...options
        };
        
        this.container = null;
        this.activeInput = null;
        this.isVisible = false;
        this.workplaceEmojis = null;
        this.emojiAliases = null;
        this.recentEmojis = this.loadRecentEmojis();
        this.currentCategory = 'frequent';
        this.searchQuery = '';
        
        // Bind methods to maintain context
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleEmojiClick = this.handleEmojiClick.bind(this);
        this.handleCategoryClick = this.handleCategoryClick.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
    }
    
    async initialize() {
        console.log('EmojiPicker: Initializing...');
        
        try {
            // Load emoji data and aliases
            await Promise.all([
                this.loadWorkplaceEmojis(),
                this.loadEmojiAliases()
            ]);
            
            // Create the picker UI
            this.createPickerUI();
            
            // Add global event listeners
            document.addEventListener('click', this.handleDocumentClick);
            document.addEventListener('keydown', this.handleKeydown);
            
            console.log('EmojiPicker: Initialized successfully');
            return true;
        } catch (error) {
            console.error('EmojiPicker: Initialization failed', error);
            return false;
        }
    }
    
    async loadWorkplaceEmojis() {
        const response = await fetch('/assets/static/workplace-emojis.json');
        if (!response.ok) {
            throw new Error(`Failed to load workplace emojis: ${response.statusText}`);
        }
        this.workplaceEmojis = await response.json();
    }
    
    async loadEmojiAliases() {
        const response = await fetch('/assets/static/emoji-aliases.json');
        if (!response.ok) {
            throw new Error(`Failed to load emoji aliases: ${response.statusText}`);
        }
        this.emojiAliases = await response.json();
    }
    
    createPickerUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = 'emoji-picker';
        this.container.innerHTML = `
            <div class="emoji-picker-header">
                ${this.options.showSearch ? `
                    <div class="emoji-search-container">
                        <input type="text" class="emoji-search" placeholder="${this.options.searchPlaceholder}" />
                        <div class="emoji-search-icon">🔍</div>
                    </div>
                ` : ''}
                ${this.options.showCategories ? `
                    <div class="emoji-categories">
                        ${this.renderCategoryTabs()}
                    </div>
                ` : ''}
            </div>
            <div class="emoji-picker-body">
                <div class="emoji-grid" id="emoji-grid">
                    ${this.renderEmojiGrid()}
                </div>
            </div>
        `;
        
        // Add to document body (hidden initially)
        this.container.style.display = 'none';
        document.body.appendChild(this.container);
        
        // Add event listeners
        this.addEventListeners();
    }
    
    renderCategoryTabs() {
        const categories = this.workplaceEmojis.categories;
        let html = '';
        
        // Add recent emojis tab if we have any
        if (this.recentEmojis.length > 0) {
            html += `<button class="emoji-category-tab ${this.currentCategory === 'recent' ? 'active' : ''}" data-category="recent" title="Recently Used">⏰</button>`;
        }
        
        // Add category tabs
        Object.keys(categories).forEach(categoryKey => {
            const category = categories[categoryKey];
            const isActive = this.currentCategory === categoryKey ? 'active' : '';
            html += `<button class="emoji-category-tab ${isActive}" data-category="${categoryKey}" title="${category.name}">${category.icon}</button>`;
        });
        
        return html;
    }
    
    renderEmojiGrid() {
        if (this.searchQuery) {
            return this.renderSearchResults();
        }
        
        if (this.currentCategory === 'recent') {
            return this.renderRecentEmojis();
        }
        
        const category = this.workplaceEmojis.categories[this.currentCategory];
        if (!category) return '';
        
        let html = `<div class="emoji-category-title">${category.name}</div>`;
        html += '<div class="emoji-items">';
        
        category.emojis.forEach(emoji => {
            const aliases = this.emojiAliases.aliases[emoji] || [];
            const title = aliases.length > 0 ? `${emoji} - ${aliases.slice(0, 3).join(', ')}` : emoji;
            html += `<button class="emoji-item" data-emoji="${emoji}" title="${title}">${emoji}</button>`;
        });
        
        html += '</div>';
        return html;
    }
    
    renderSearchResults() {
        const results = this.searchEmojis(this.searchQuery);
        
        if (results.length === 0) {
            return '<div class="emoji-no-results">No emojis found</div>';
        }
        
        let html = `<div class="emoji-category-title">Search Results (${results.length})</div>`;
        html += '<div class="emoji-items">';
        
        results.forEach(result => {
            const title = `${result.emoji} - ${result.matchedAliases.join(', ')}`;
            html += `<button class="emoji-item" data-emoji="${result.emoji}" title="${title}">${result.emoji}</button>`;
        });
        
        html += '</div>';
        return html;
    }
    
    renderRecentEmojis() {
        if (this.recentEmojis.length === 0) {
            return '<div class="emoji-no-results">No recent emojis</div>';
        }
        
        let html = '<div class="emoji-category-title">Recently Used</div>';
        html += '<div class="emoji-items">';
        
        this.recentEmojis.forEach(emoji => {
            const aliases = this.emojiAliases.aliases[emoji] || [];
            const title = aliases.length > 0 ? `${emoji} - ${aliases.slice(0, 3).join(', ')}` : emoji;
            html += `<button class="emoji-item" data-emoji="${emoji}" title="${title}">${emoji}</button>`;
        });
        
        html += '</div>';
        return html;
    }
    
    searchEmojis(query) {
        const searchTerm = query.toLowerCase().trim();
        if (!searchTerm) return [];
        
        const results = [];
        const aliases = this.emojiAliases.aliases;
        
        // Search through all emojis and their aliases
        Object.keys(aliases).forEach(emoji => {
            const emojiAliases = aliases[emoji];
            const matchedAliases = emojiAliases.filter(alias => 
                alias.toLowerCase().includes(searchTerm)
            );
            
            if (matchedAliases.length > 0) {
                results.push({
                    emoji,
                    matchedAliases,
                    relevance: this.calculateRelevance(searchTerm, matchedAliases)
                });
            }
        });
        
        // Sort by relevance (exact matches first, then partial matches)
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    calculateRelevance(searchTerm, matchedAliases) {
        let relevance = 0;
        
        matchedAliases.forEach(alias => {
            if (alias.toLowerCase() === searchTerm) {
                relevance += 100; // Exact match
            } else if (alias.toLowerCase().startsWith(searchTerm)) {
                relevance += 50; // Starts with search term
            } else if (alias.toLowerCase().includes(searchTerm)) {
                relevance += 10; // Contains search term
            }
        });
        
        return relevance;
    }
    
    addEventListeners() {
        // Search input
        const searchInput = this.container.querySelector('.emoji-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hide();
                }
            });
        }
        
        // Category tabs
        this.container.querySelectorAll('.emoji-category-tab').forEach(tab => {
            tab.addEventListener('click', this.handleCategoryClick);
        });
        
        // Emoji items (delegated event listener)
        const emojiGrid = this.container.querySelector('#emoji-grid');
        if (emojiGrid) {
            emojiGrid.addEventListener('click', this.handleEmojiClick);
        }
    }
    
    handleSearch(e) {
        this.searchQuery = e.target.value;
        this.updateEmojiGrid();
        
        // Clear category selection when searching
        if (this.searchQuery) {
            this.container.querySelectorAll('.emoji-category-tab').forEach(tab => {
                tab.classList.remove('active');
            });
        }
    }
    
    handleCategoryClick(e) {
        e.preventDefault();
        const category = e.target.dataset.category;
        if (category) {
            this.setCategory(category);
        }
    }
    
    handleEmojiClick(e) {
        if (e.target.classList.contains('emoji-item')) {
            const emoji = e.target.dataset.emoji;
            if (emoji) {
                this.selectEmoji(emoji);
            }
        }
    }
    
    setCategory(category) {
        this.currentCategory = category;
        this.searchQuery = '';
        
        // Clear search input
        const searchInput = this.container.querySelector('.emoji-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Update active tab
        this.container.querySelectorAll('.emoji-category-tab').forEach(tab => {
            if (tab.dataset.category === category) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        this.updateEmojiGrid();
    }
    
    updateEmojiGrid() {
        const emojiGrid = this.container.querySelector('#emoji-grid');
        if (emojiGrid) {
            emojiGrid.innerHTML = this.renderEmojiGrid();
        }
    }
    
    selectEmoji(emoji) {
        // Handle Monaco editor insertion
        if (this.monacoEditor && this.monacoPosition) {
            this.monacoEditor.executeEdits('insert-emoji', [{
                range: {
                    startLineNumber: this.monacoPosition.lineNumber,
                    startColumn: this.monacoPosition.column,
                    endLineNumber: this.monacoPosition.lineNumber,
                    endColumn: this.monacoPosition.column
                },
                text: emoji
            }]);
            
            // Move cursor after inserted emoji
            const newPosition = {
                lineNumber: this.monacoPosition.lineNumber,
                column: this.monacoPosition.column + emoji.length
            };
            this.monacoEditor.setPosition(newPosition);
            this.monacoEditor.focus();
            
            console.log('EmojiPicker: Inserted emoji into Monaco editor:', emoji);
        } else if (this.activeInput) {
            // Insert emoji into the active input
            if (this.activeInput.tagName.toLowerCase() === 'input' || 
                this.activeInput.tagName.toLowerCase() === 'textarea') {
                this.activeInput.value = emoji;
                this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Trigger custom event
            this.activeInput.dispatchEvent(new CustomEvent('emoji-selected', {
                detail: { emoji, picker: this }
            }));
        }
        
        // Add to recent emojis
        this.addToRecentEmojis(emoji);
        
        // Hide picker after selection
        this.hide();
    }
    
    addToRecentEmojis(emoji) {
        // Remove emoji if it already exists
        const index = this.recentEmojis.indexOf(emoji);
        if (index > -1) {
            this.recentEmojis.splice(index, 1);
        }
        
        // Add to beginning
        this.recentEmojis.unshift(emoji);
        
        // Limit to max recent emojis
        if (this.recentEmojis.length > this.options.maxRecentEmojis) {
            this.recentEmojis = this.recentEmojis.slice(0, this.options.maxRecentEmojis);
        }
        
        // Save to localStorage
        this.saveRecentEmojis();
        
        // Update recent category tab visibility
        this.updateCategoryTabs();
    }
    
    updateCategoryTabs() {
        const categoriesContainer = this.container.querySelector('.emoji-categories');
        if (categoriesContainer) {
            categoriesContainer.innerHTML = this.renderCategoryTabs();
            
            // Re-add event listeners for new tabs
            this.container.querySelectorAll('.emoji-category-tab').forEach(tab => {
                tab.addEventListener('click', this.handleCategoryClick);
            });
        }
    }
    
    loadRecentEmojis() {
        try {
            const stored = localStorage.getItem('uaw-emoji-picker-recent');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('EmojiPicker: Failed to load recent emojis from localStorage', error);
            return [];
        }
    }
    
    saveRecentEmojis() {
        try {
            localStorage.setItem('uaw-emoji-picker-recent', JSON.stringify(this.recentEmojis));
        } catch (error) {
            console.warn('EmojiPicker: Failed to save recent emojis to localStorage', error);
        }
    }
    
    // Public API methods
    
    attachToInput(inputElement, options = {}) {
        if (!inputElement) return;
        
        const config = { autoOpen: this.options.autoOpen, ...options };
        
        // Add focus event listener
        if (config.autoOpen) {
            inputElement.addEventListener('focus', (e) => {
                this.show(e.target);
            });
        }
        
        // Add click event listener for manual opening
        inputElement.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey || !config.autoOpen) {
                this.show(e.target);
            }
        });
        
        // Mark input as emoji-enabled
        inputElement.classList.add('emoji-picker-enabled');
        
        console.log('EmojiPicker: Attached to input element', inputElement);
    }
    
    attachToMonaco(monacoEditor) {
        if (!monacoEditor) return;
        
        // Store reference to Monaco editor
        this.monacoEditor = monacoEditor;
        
        // Add context menu action for Monaco
        monacoEditor.addAction({
            id: 'insert-emoji',
            label: 'Insert Emoji',
            contextMenuGroupId: 'modification',
            run: (editor) => {
                // Get cursor position
                const position = editor.getPosition();
                this.monacoPosition = position;
                
                // Show picker positioned near cursor
                this.showForMonaco(editor, position);
            }
        });
        
        console.log('EmojiPicker: Attached to Monaco editor');
    }
    
    showForMonaco(editor, position) {
        this.activeInput = null; // Clear regular input
        this.monacoEditor = editor;
        this.monacoPosition = position;
        
        if (!this.container) {
            console.warn('EmojiPicker: Not initialized');
            return;
        }
        
        // Position picker near Monaco cursor
        this.positionPickerForMonaco(editor, position);
        
        // Show the picker
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // Focus search input
        const searchInput = this.container.querySelector('.emoji-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
        
        console.log('EmojiPicker: Shown for Monaco editor');
    }
    
    positionPickerForMonaco(editor, position) {
        if (!editor || !position || !this.container) return;
        
        // Get Monaco editor container position
        const editorContainer = editor.getDomNode();
        const editorRect = editorContainer.getBoundingClientRect();
        
        // Calculate approximate cursor position
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        const fontSize = editor.getOption(monaco.editor.EditorOption.fontSize);
        
        // Approximate cursor position (this is simplified)
        const cursorX = editorRect.left + (position.column - 1) * (fontSize * 0.6);
        const cursorY = editorRect.top + (position.lineNumber - 1) * lineHeight;
        
        const pickerHeight = 400;
        const pickerWidth = 320;
        
        let top = cursorY + lineHeight + window.scrollY + 5;
        let left = cursorX + window.scrollX;
        
        // Adjust if picker would go off screen
        if (top + pickerHeight > window.innerHeight + window.scrollY) {
            top = cursorY + window.scrollY - pickerHeight - 5;
        }
        
        if (left + pickerWidth > window.innerWidth + window.scrollX) {
            left = window.innerWidth + window.scrollX - pickerWidth - 10;
        }
        
        // Ensure picker stays within editor bounds horizontally
        if (left < editorRect.left) {
            left = editorRect.left + 10;
        }
        
        this.container.style.position = 'absolute';
        this.container.style.top = `${top}px`;
        this.container.style.left = `${left}px`;
        this.container.style.zIndex = '10000';
    }
    
    show(inputElement = null, customCallback = null) {
        this.activeInput = inputElement;
        this.onEmojiSelect = customCallback;
        
        if (!this.container) {
            console.warn('EmojiPicker: Not initialized');
            return;
        }
        
        // Position the picker
        this.positionPicker(inputElement);
        
        // Show the picker
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // Focus search input if available
        const searchInput = this.container.querySelector('.emoji-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
        
        console.log('EmojiPicker: Shown');
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.isVisible = false;
        this.activeInput = null;
        this.onEmojiSelect = null;
        
        // Clear Monaco editor references
        this.monacoEditor = null;
        this.monacoPosition = null;
        
        console.log('EmojiPicker: Hidden');
    }
    
    positionPicker(inputElement) {
        if (!inputElement || !this.container) return;
        
        const rect = inputElement.getBoundingClientRect();
        const pickerHeight = 300; // Approximate picker height
        const pickerWidth = 320; // Approximate picker width
        
        let top = rect.bottom + window.scrollY + 5;
        let left = rect.left + window.scrollX;
        
        // Adjust if picker would go off screen
        if (top + pickerHeight > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - pickerHeight - 5;
        }
        
        if (left + pickerWidth > window.innerWidth + window.scrollX) {
            left = window.innerWidth + window.scrollX - pickerWidth - 10;
        }
        
        this.container.style.position = 'absolute';
        this.container.style.top = `${top}px`;
        this.container.style.left = `${left}px`;
        this.container.style.zIndex = '10000';
    }
    
    handleDocumentClick(e) {
        if (this.isVisible && this.container && !this.container.contains(e.target)) {
            // Don't hide if clicking on the input that opened the picker
            if (this.activeInput && this.activeInput.contains(e.target)) {
                return;
            }
            this.hide();
        }
    }
    
    handleKeydown(e) {
        // Global keyboard shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === '.') {
            e.preventDefault();
            
            // Check if Monaco editor is focused
            const focusedElement = document.activeElement;
            
            // Check if we're in Monaco editor
            if (this.isInMonacoEditor(focusedElement)) {
                // Get current Monaco editor instance and position
                if (window.editor) {
                    const position = window.editor.getPosition();
                    this.showForMonaco(window.editor, position);
                }
            } else if (focusedElement && 
                (focusedElement.tagName.toLowerCase() === 'input' || 
                 focusedElement.tagName.toLowerCase() === 'textarea')) {
                this.show(focusedElement);
            }
        }
        
        // Hide picker on Escape
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    }
    
    isInMonacoEditor(element) {
        // Check if the focused element is within a Monaco editor
        if (!element) return false;
        
        // Monaco editor elements typically have specific classes or are within monaco-editor containers
        let current = element;
        while (current && current !== document.body) {
            if (current.classList && (
                current.classList.contains('monaco-editor') ||
                current.classList.contains('monaco-editor-background') ||
                current.classList.contains('view-lines') ||
                current.getAttribute('data-mode-id') // Monaco editor attribute
            )) {
                return true;
            }
            current = current.parentElement;
        }
        
        return false;
    }
    
    // Method to attach picker to dynamically created fields
    attachToDynamicFields(containerElement = document) {
        if (!this.workplaceEmojis) {
            console.warn('EmojiPicker: Not initialized, cannot attach to dynamic fields');
            return;
        }
        
        // Find all unattached emoji fields
        const emojiFields = containerElement.querySelectorAll('.object-emoji, input[maxlength="2"]');
        let attachedCount = 0;
        
        emojiFields.forEach(field => {
            // Skip if already has emoji picker class
            if (field.classList.contains('emoji-picker-enabled')) {
                return;
            }
            
            this.attachToInput(field, { autoOpen: true });
            attachedCount++;
        });
        
        if (attachedCount > 0) {
            console.log(`EmojiPicker: Attached to ${attachedCount} dynamic emoji fields`);
        }
    }
    
    destroy() {
        // Remove event listeners
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleKeydown);
        
        // Remove picker from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log('EmojiPicker: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmojiPicker;
}