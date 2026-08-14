// UAW Playground v2 - local project persistence and document transactions
(function () {
    'use strict';

    const DB_NAME = 'uaw-playground-v2';
    const DB_VERSION = 1;
    const PROJECT_STORE = 'projects';
    const CURRENT_PROJECT_KEY = 'uaw-v2-current-project';
    const LEGACY_DOCUMENT_KEY = 'uaw-json-editor-content';
    const AUTOSAVE_DELAY = 700;

    const blankWorkSpec = () => JSON.stringify({
        simulation: {
            schema_version: '2.0',
            meta: {
                title: 'Untitled process',
                description: 'Describe what this process should accomplish.',
                domain: 'General'
            },
            config: {
                time_unit: 'minutes',
                start_time: '08:00',
                end_time: '18:00',
                timezone: 'UTC',
                currency: 'USD',
                locale: 'en-US'
            },
            world: { objects: [], layout: { locations: [] }, digital_locations: [], displays: [] },
            process: { tasks: [] }
        }
    }, null, 2);

    const createId = () => {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const emit = (name, detail = {}) => {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    };

    class ProjectStore {
        constructor() {
            this.db = null;
            this.editor = null;
            this.currentProject = null;
            this.saveTimer = null;
            this.isOpeningProject = false;
            this.ready = this.openDatabase();
        }

        openDatabase() {
            return new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('IndexedDB is unavailable; project storage will use localStorage.');
                    resolve(null);
                    return;
                }

                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(PROJECT_STORE)) {
                        const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
                        store.createIndex('updatedAt', 'updatedAt');
                        store.createIndex('archived', 'archived');
                    }
                };
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve(this.db);
                };
                request.onerror = () => {
                    console.warn('Unable to open project database:', request.error);
                    resolve(null);
                };
            });
        }

        async withStore(mode, callback) {
            await this.ready;
            if (!this.db) return null;

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(PROJECT_STORE, mode);
                const store = transaction.objectStore(PROJECT_STORE);
                let result;
                try {
                    result = callback(store);
                } catch (error) {
                    reject(error);
                    return;
                }
                transaction.oncomplete = () => resolve(result);
                transaction.onerror = () => reject(transaction.error);
            });
        }

        fallbackReadAll() {
            try {
                return JSON.parse(localStorage.getItem('uaw-v2-projects') || '[]');
            } catch (_error) {
                return [];
            }
        }

        fallbackWriteAll(projects) {
            localStorage.setItem('uaw-v2-projects', JSON.stringify(projects));
        }

        async list(options = {}) {
            await this.ready;
            let projects;
            if (!this.db) {
                projects = this.fallbackReadAll();
            } else {
                projects = await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(PROJECT_STORE, 'readonly');
                    const request = transaction.objectStore(PROJECT_STORE).getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error);
                });
            }

            return projects
                .filter((project) => options.includeArchived || !project.archived)
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }

        async get(id) {
            if (!id) return null;
            await this.ready;
            if (!this.db) {
                return this.fallbackReadAll().find((project) => project.id === id) || null;
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(PROJECT_STORE, 'readonly');
                const request = transaction.objectStore(PROJECT_STORE).get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        }

        async put(project) {
            const now = new Date().toISOString();
            const record = {
                id: project.id || createId(),
                name: project.name || 'Untitled project',
                description: project.description || '',
                createdAt: project.createdAt || now,
                updatedAt: now,
                archived: Boolean(project.archived),
                workSpecDraft: project.workSpecDraft || '',
                lastValidWorkSpec: project.lastValidWorkSpec || '',
                checkpoints: Array.isArray(project.checkpoints) ? project.checkpoints.slice(-20) : [],
                agentThreadId: project.agentThreadId || null,
                settings: project.settings || {}
            };

            await this.ready;
            if (!this.db) {
                const projects = this.fallbackReadAll();
                const existingIndex = projects.findIndex((item) => item.id === record.id);
                if (existingIndex >= 0) projects[existingIndex] = record;
                else projects.push(record);
                this.fallbackWriteAll(projects);
            } else {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(PROJECT_STORE, 'readwrite');
                    const request = transaction.objectStore(PROJECT_STORE).put(record);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            emit('uaw:projects-changed', { project: record });
            return record;
        }

        async create(name = 'Untitled project', initialWorkSpec = '') {
            const record = await this.put({
                name,
                workSpecDraft: initialWorkSpec,
                lastValidWorkSpec: this.isValidWorkSpec(initialWorkSpec) ? initialWorkSpec : ''
            });
            await this.open(record.id);
            return record;
        }

        async createFromTemplate(name, workSpec) {
            await this.saveCurrent();
            const record = await this.create(name || 'Untitled template project', workSpec);
            emit('uaw:project-created-from-template', { project: record });
            return record;
        }

        async createBlank() {
            await this.saveCurrent();
            return this.create('Untitled project', blankWorkSpec());
        }

        async duplicate(id) {
            const source = await this.get(id);
            if (!source) return null;
            return this.create(`${source.name} copy`, source.workSpecDraft || source.lastValidWorkSpec);
        }

        async archive(id, archived = true) {
            const project = await this.get(id);
            if (!project) return null;
            project.archived = archived;
            const saved = await this.put(project);
            if (archived && this.currentProject?.id === id) {
                const next = (await this.list()).find((candidate) => candidate.id !== id);
                if (next) await this.open(next.id);
                else await this.createBlank();
            }
            return saved;
        }

        isValidWorkSpec(value) {
            if (!value || !value.trim()) return false;
            try {
                const parsed = JSON.parse(value);
                if (!window.WorkSpecValidator?.validate) return true;
                return Boolean(window.WorkSpecValidator.validate(parsed)?.ok);
            } catch (_error) {
                return false;
            }
        }

        async createCheckpoint(label = 'Checkpoint') {
            if (!this.currentProject || !this.editor) return null;
            const content = this.editor.getValue();
            const checkpoint = {
                id: createId(),
                label,
                createdAt: new Date().toISOString(),
                workSpec: content
            };
            this.currentProject.checkpoints = [
                ...(this.currentProject.checkpoints || []),
                checkpoint
            ].slice(-20);
            this.currentProject = await this.put(this.currentProject);
            emit('uaw:checkpoint-created', { checkpoint });
            return checkpoint;
        }

        async restoreCheckpoint(checkpointId) {
            const checkpoint = this.currentProject?.checkpoints?.find((item) => item.id === checkpointId);
            if (!checkpoint || !this.editor) return false;
            await this.createCheckpoint('Before checkpoint restore');
            this.editor.setValue(checkpoint.workSpec);
            return true;
        }

        async rename(id, name) {
            const project = await this.get(id);
            if (!project) return null;
            project.name = String(name || '').trim() || 'Untitled project';
            const saved = await this.put(project);
            if (this.currentProject?.id === id) {
                this.currentProject = saved;
                emit('uaw:project-opened', { project: saved });
            }
            return saved;
        }

        async open(id) {
            const project = await this.get(id);
            if (!project) return null;

            this.currentProject = project;
            localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
            if (this.editor) {
                this.isOpeningProject = true;
                const content = project.workSpecDraft || project.lastValidWorkSpec;
                if (content && this.editor.getValue() !== content) {
                    this.editor.setValue(content);
                }
                queueMicrotask(() => {
                    this.isOpeningProject = false;
                });
            }
            emit('uaw:project-opened', { project });
            return project;
        }

        scheduleSave() {
            if (this.isOpeningProject || !this.currentProject || !this.editor) return;
            emit('uaw:project-saving', { project: this.currentProject });
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveCurrent(), AUTOSAVE_DELAY);
        }

        async saveCurrent() {
            if (!this.currentProject || !this.editor) return null;
            const content = this.editor.getValue();
            this.currentProject.workSpecDraft = content;
            if (this.isValidWorkSpec(content)) {
                this.currentProject.lastValidWorkSpec = content;
            }
            this.currentProject = await this.put(this.currentProject);
            emit('uaw:project-saved', { project: this.currentProject });
            return this.currentProject;
        }

        async attachEditor(editor) {
            if (!editor || this.editor === editor) return;
            this.editor = editor;
            editor.onDidChangeModelContent(() => this.scheduleSave());

            const currentId = localStorage.getItem(CURRENT_PROJECT_KEY);
            const existing = currentId ? await this.get(currentId) : null;
            if (existing) {
                await this.open(existing.id);
                return;
            }

            const legacy = localStorage.getItem(LEGACY_DOCUMENT_KEY) || editor.getValue();
            const migrated = await this.create('My first project', legacy);
            emit('uaw:project-migrated', { project: migrated });
        }

        getCurrent() {
            return this.currentProject;
        }
    }

    const store = new ProjectStore();
    window.UAWProjectStore = store;

    window.addEventListener('uaw:editor-ready', (event) => {
        store.attachEditor(event.detail?.editor || window.monacoEditor || window.editor);
    });

    // Defensive fallback for older editor initialization paths.
    window.addEventListener('DOMContentLoaded', () => {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            const candidate = window.monacoEditor || window.editor;
            if (candidate?.onDidChangeModelContent) {
                clearInterval(timer);
                store.attachEditor(candidate);
            } else if (attempts > 100) {
                clearInterval(timer);
            }
        }, 100);
    });
})();
