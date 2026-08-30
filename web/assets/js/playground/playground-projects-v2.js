// UAW Playground v2 - folder-backed project persistence
(function () {
    'use strict';

    const DB_NAME = 'uaw-playground-v2';
    const DB_VERSION = 3;
    const REGISTRY_STORE = 'project-registry';
    const LEGACY_PROJECT_STORE = 'projects';
    const LEGACY_ASSET_STORE = 'assets';
    const WORKSPEC_FILE = 'project.workspec.json';
    const SCRIPT_FILE = 'project.workspec.js';
    const UAW_DIRECTORY = '.uaw';
    const PROJECT_META_FILE = 'project.json';
    const LAST_VALID_FILE = 'last-valid.workspec.json';
    const CHECKPOINT_DIRECTORY = 'checkpoints';
    const ASSET_DIRECTORY = 'assets';
    const ASSET_META_FILE = 'assets.json';
    const AUTOSAVE_DELAY = 700;
    const LEGACY_DOCUMENT_KEY = 'uaw-json-editor-content';
    const LEGACY_PROJECTS_KEY = 'uaw-v2-projects';
    const LEGACY_SHARE_PREFIX = 'uaw-save-code-v1:';

    const blankWorkSpec = () => JSON.stringify({
        simulation: {
            schema_version: '2.1',
            meta: { title: 'Untitled process', description: 'Describe what this process should accomplish.', domain: 'General' },
            world: { objects: [], layout: { locations: [] }, digital_locations: [], displays: [] },
            process: { tasks: [] }
        }
    }, null, 2);

    const blankScript = () => `// WorkSpec 2.1 Script
// Add behaviour here using the API provided by the WorkSpec runtime.
`;

    const createId = () => window.crypto?.randomUUID?.()
        || `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));
    const isAbortError = (error) => error?.name === 'AbortError';

    class ProjectStore {
        constructor() {
            this.db = null;
            this.memoryRegistry = new Map();
            this.editor = null;
            this.scriptEditor = null;
            this.currentProject = null;
            this.saveTimer = null;
            this.isOpeningProject = false;
            this.writeChain = Promise.resolve();
            this.legacyProjects = [];
            this.ready = this.openDatabase();
        }

        openDatabase() {
            return new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('IndexedDB is unavailable. Folder projects cannot be remembered between sessions.');
                    resolve(null);
                    return;
                }
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(REGISTRY_STORE)) {
                        db.createObjectStore(REGISTRY_STORE, { keyPath: 'id' });
                    }
                    // Old stores stay in place until each record is safely migrated.
                };
                request.onsuccess = () => { this.db = request.result; resolve(this.db); };
                request.onerror = () => { console.warn('Unable to open project registry:', request.error); resolve(null); };
            });
        }

        async registryGetAll() {
            await this.ready;
            if (!this.db) return Array.from(this.memoryRegistry.values());
            return new Promise((resolve, reject) => {
                const request = this.db.transaction(REGISTRY_STORE, 'readonly').objectStore(REGISTRY_STORE).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }

        async registryGet(id) {
            if (!id) return null;
            await this.ready;
            if (!this.db) return this.memoryRegistry.get(id) || null;
            return new Promise((resolve, reject) => {
                const request = this.db.transaction(REGISTRY_STORE, 'readonly').objectStore(REGISTRY_STORE).get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        }

        async registryPut(project) {
            // This is the complete browser record. Project content never enters IndexedDB.
            const record = { id: project.id, name: project.name, directoryHandle: project.directoryHandle };
            await this.ready;
            if (!this.db) { this.memoryRegistry.set(record.id, record); return record; }
            await new Promise((resolve, reject) => {
                const request = this.db.transaction(REGISTRY_STORE, 'readwrite').objectStore(REGISTRY_STORE).put(record);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
            return record;
        }

        async registryDelete(id) {
            await this.ready;
            if (!this.db) { this.memoryRegistry.delete(id); return; }
            await new Promise((resolve, reject) => {
                const request = this.db.transaction(REGISTRY_STORE, 'readwrite').objectStore(REGISTRY_STORE).delete(id);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
        }

        async chooseProjectDirectory(pickerId = 'uaw-project-folder') {
            if (typeof window.showDirectoryPicker !== 'function') {
                throw new Error('Folder-backed projects require Chrome, Edge, or another browser with the File System Access API.');
            }
            return window.showDirectoryPicker({ id: pickerId, mode: 'readwrite', startIn: 'documents' });
        }

        projectDirectoryName(name) {
            const sanitized = String(name || 'Untitled project')
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
                .replace(/[. ]+$/g, '')
                .trim()
                .slice(0, 80);
            return sanitized || 'Untitled project';
        }

        async directoryEntryExists(parentHandle, name) {
            try {
                await parentHandle.getDirectoryHandle(name);
                return true;
            } catch (error) {
                if (error?.name !== 'NotFoundError') return true;
            }
            try {
                await parentHandle.getFileHandle(name);
                return true;
            } catch (error) {
                if (error?.name === 'NotFoundError') return false;
                throw error;
            }
        }

        async createDedicatedProjectDirectory(parentHandle, projectName) {
            const baseName = this.projectDirectoryName(projectName);
            let candidate = baseName;
            let suffix = 2;
            while (await this.directoryEntryExists(parentHandle, candidate)) {
                candidate = `${baseName} (${suffix})`;
                suffix += 1;
            }
            return parentHandle.getDirectoryHandle(candidate, { create: true });
        }

        async ensurePermission(directoryHandle, request = false) {
            if (!directoryHandle) return false;
            const options = { mode: 'readwrite' };
            if (typeof directoryHandle.queryPermission !== 'function') return true;
            if (await directoryHandle.queryPermission(options) === 'granted') return true;
            if (!request || typeof directoryHandle.requestPermission !== 'function') return false;
            return (await directoryHandle.requestPermission(options)) === 'granted';
        }

        getUawDirectory(directoryHandle, create = false) {
            return directoryHandle.getDirectoryHandle(UAW_DIRECTORY, { create });
        }

        async readText(directoryHandle, name, optional = false) {
            try {
                const file = await (await directoryHandle.getFileHandle(name)).getFile();
                return file.text();
            } catch (error) {
                if (optional && error?.name === 'NotFoundError') return null;
                throw error;
            }
        }

        async readJson(directoryHandle, name, fallback = null) {
            const text = await this.readText(directoryHandle, name, true);
            if (text === null) return fallback;
            try { return JSON.parse(text); }
            catch (error) { throw new Error(`${name} contains invalid JSON: ${error.message}`); }
        }

        async writeText(directoryHandle, name, contents) {
            const writable = await (await directoryHandle.getFileHandle(name, { create: true })).createWritable();
            try { await writable.write(contents); await writable.close(); }
            catch (error) { await writable.abort?.(); throw error; }
        }

        async readProjectFromDirectory(directoryHandle, registry = {}) {
            const uawDirectory = await this.getUawDirectory(directoryHandle).catch((error) => {
                if (error?.name === 'NotFoundError') return null;
                throw error;
            });
            const metadata = uawDirectory ? await this.readJson(uawDirectory, PROJECT_META_FILE, {}) : {};
            const workSpecDraft = await this.readText(directoryHandle, WORKSPEC_FILE, true);
            if (workSpecDraft === null) throw new Error(`The folder does not contain ${WORKSPEC_FILE}.`);
            const scriptDraft = await this.readText(directoryHandle, SCRIPT_FILE, true);
            const lastValidWorkSpec = uawDirectory ? await this.readText(uawDirectory, LAST_VALID_FILE, true) || '' : '';
            const checkpoints = [];
            const checkpointMetadata = Array.isArray(metadata.checkpoints) ? metadata.checkpoints : [];
            if (uawDirectory && checkpointMetadata.length) {
                const directory = await uawDirectory.getDirectoryHandle(CHECKPOINT_DIRECTORY).catch((error) => {
                    if (error?.name === 'NotFoundError') return null;
                    throw error;
                });
                for (const item of checkpointMetadata) {
                    const workSpec = directory ? await this.readText(directory, `${item.id}.workspec.json`, true) : null;
                    const script = directory ? await this.readText(directory, `${item.id}.workspec.js`, true) : null;
                    if (workSpec !== null) checkpoints.push({ ...item, workSpec, ...(script === null ? {} : { script }) });
                }
            }
            return {
                id: metadata.id || registry.id || createId(),
                name: metadata.name || registry.name || directoryHandle.name || 'Untitled project',
                description: metadata.description || '',
                createdAt: metadata.createdAt || new Date().toISOString(),
                updatedAt: metadata.updatedAt || new Date().toISOString(),
                archived: Boolean(metadata.archived),
                agentThreadId: metadata.agentThreadId || null,
                settings: metadata.settings || {},
                checkpoints,
                workSpecDraft,
                scriptDraft: scriptDraft === null ? blankScript() : scriptDraft,
                lastValidWorkSpec,
                directoryHandle
            };
        }

        projectMetadata(project) {
            return {
                formatVersion: 1,
                id: project.id,
                name: project.name,
                description: project.description || '',
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                archived: Boolean(project.archived),
                agentThreadId: project.agentThreadId || null,
                settings: project.settings || {},
                checkpoints: (project.checkpoints || []).map(({ id, label, createdAt }) => ({ id, label, createdAt }))
            };
        }

        async writeProject(project) {
            if (!project.directoryHandle) throw new Error('This project has no local folder.');
            if (!await this.ensurePermission(project.directoryHandle, true)) throw new Error(`Access to “${project.directoryHandle.name}” was not granted.`);
            const uawDirectory = await this.getUawDirectory(project.directoryHandle, true);
            await this.writeText(project.directoryHandle, WORKSPEC_FILE, project.workSpecDraft || '');
            await this.writeText(project.directoryHandle, SCRIPT_FILE, project.scriptDraft ?? blankScript());
            if (project.lastValidWorkSpec) await this.writeText(uawDirectory, LAST_VALID_FILE, project.lastValidWorkSpec);
            await this.writeText(uawDirectory, PROJECT_META_FILE, JSON.stringify(this.projectMetadata(project), null, 2));
            await this.registryPut(project);
            return project;
        }

        async list(options = {}) {
            const projects = await Promise.all((await this.registryGetAll()).map(async (record) => {
                if (!await this.ensurePermission(record.directoryHandle)) {
                    return { ...record, updatedAt: null, archived: false, accessRequired: true };
                }
                try { return await this.readProjectFromDirectory(record.directoryHandle, record); }
                catch (error) { return { ...record, updatedAt: null, archived: false, unavailable: true, error: error.message }; }
            }));
            return projects
                .filter((project) => options.includeArchived || !project.archived)
                .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        }

        async get(id, options = {}) {
            if (this.currentProject?.id === id) return this.currentProject;
            const registry = await this.registryGet(id);
            if (!registry) return null;
            if (!await this.ensurePermission(registry.directoryHandle, Boolean(options.requestPermission))) return { ...registry, accessRequired: true };
            return this.readProjectFromDirectory(registry.directoryHandle, registry);
        }

        // Forgetting a project only needs its browser registry record. Do not
        // read the folder here: its files may have been moved or edited outside
        // the playground, and forgetting must still be possible in that case.
        async getRegistryRecord(id) {
            return this.registryGet(id);
        }

        async put(project) {
            const now = new Date().toISOString();
            const record = {
                ...project,
                id: project.id || createId(),
                name: project.name || project.directoryHandle?.name || 'Untitled project',
                description: project.description || '',
                createdAt: project.createdAt || now,
                updatedAt: now,
                archived: Boolean(project.archived),
                workSpecDraft: project.workSpecDraft || '',
                scriptDraft: project.scriptDraft ?? blankScript(),
                lastValidWorkSpec: project.lastValidWorkSpec || '',
                checkpoints: Array.isArray(project.checkpoints) ? project.checkpoints.slice(-20) : [],
                agentThreadId: project.agentThreadId || null,
                settings: project.settings || {}
            };
            await this.writeProject(record);
            emit('uaw:projects-changed', { project: record });
            return record;
        }

        async create(name = 'Untitled project', initialWorkSpec = '', parentDirectoryHandle = null, initialScript = null) {
            let parentHandle = parentDirectoryHandle;
            try { parentHandle = parentHandle || await this.chooseProjectDirectory('uaw-new-project'); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            const projectName = String(name || '').trim() || 'Untitled project';
            const handle = await this.createDedicatedProjectDirectory(parentHandle, projectName);
            const now = new Date().toISOString();
            const project = {
                id: createId(), name: projectName,
                description: '', createdAt: now, updatedAt: now, archived: false,
                workSpecDraft: initialWorkSpec || blankWorkSpec(),
                scriptDraft: initialScript ?? blankScript(),
                lastValidWorkSpec: this.isValidWorkSpec(initialWorkSpec) ? initialWorkSpec : '',
                checkpoints: [], agentThreadId: null, settings: {}, directoryHandle: handle
            };
            await this.writeProject(project);
            emit('uaw:projects-changed', { project });
            await this.open(project.id, { requestPermission: true });
            return project;
        }

        async createFromTemplate(name, workSpec, directoryHandle = null, script = null) {
            let handle = directoryHandle;
            try { handle = handle || await this.chooseProjectDirectory('uaw-template-project'); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            await this.saveCurrent();
            const project = await this.create(name || handle.name, workSpec, handle, script);
            if (project) emit('uaw:project-created-from-template', { project });
            return project;
        }

        async createBlank(name = 'Untitled project') {
            let parentHandle;
            try { parentHandle = await this.chooseProjectDirectory('uaw-new-project'); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            await this.saveCurrent();
            return this.create(String(name || '').trim() || 'Untitled project', blankWorkSpec(), parentHandle);
        }

        async openFolder() {
            let directoryHandle;
            try { directoryHandle = await this.chooseProjectDirectory('uaw-open-project'); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            const project = await this.readProjectFromDirectory(directoryHandle);
            await this.registryPut(project);
            emit('uaw:projects-changed', { project });
            return this.open(project.id, { requestPermission: true });
        }

        async duplicate(id) {
            let handle;
            try { handle = await this.chooseProjectDirectory('uaw-duplicate-project'); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            const source = await this.get(id, { requestPermission: true });
            if (!source || source.accessRequired) return null;
            const duplicate = await this.create(`${source.name} copy`, source.workSpecDraft || source.lastValidWorkSpec, handle);
            if (!duplicate) return null;
            duplicate.scriptDraft = source.scriptDraft ?? blankScript();
            this.currentProject = await this.put(duplicate);
            if (this.scriptEditor) this.scriptEditor.setValue(this.currentProject.scriptDraft);
            return this.currentProject;
        }

        async archive(id, archived = true) {
            const project = await this.get(id, { requestPermission: true });
            if (!project || project.accessRequired) return null;
            project.archived = archived;
            const saved = await this.put(project);
            if (archived && this.currentProject?.id === id) this.currentProject = null;
            return saved;
        }

        async delete(id) {
            if (!id) return false;
            await this.registryDelete(id);
            if (this.currentProject?.id === id) this.currentProject = null;
            emit('uaw:projects-changed', { deletedProjectId: id });
            return true;
        }

        mimeExtension(mimeType = '') {
            return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'application/pdf': 'pdf' })[mimeType] || 'bin';
        }

        dataUrlToBlob(data) {
            if (data instanceof Blob) return data;
            const match = String(data || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
            if (!match) return new Blob([data || ''], { type: 'application/octet-stream' });
            const bytes = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
            const buffer = new Uint8Array(bytes.length);
            for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
            return new Blob([buffer], { type: match[1] || 'application/octet-stream' });
        }

        blobToDataUrl(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        }

        async readAssetMetadata(project = this.currentProject) {
            if (!project?.directoryHandle) return [];
            const metadata = await this.readJson(await this.getUawDirectory(project.directoryHandle, true), ASSET_META_FILE, []);
            return Array.isArray(metadata) ? metadata : [];
        }

        async listAssetMetadata(projectId = this.currentProject?.id) {
            const project = projectId === this.currentProject?.id ? this.currentProject : await this.get(projectId);
            if (!project || project.accessRequired || !await this.ensurePermission(project.directoryHandle)) return [];
            return (await this.readAssetMetadata(project)).map(item => ({ ...item, projectId: project.id }));
        }

        async readAsset(assetId, projectId = this.currentProject?.id) {
            const project = projectId === this.currentProject?.id ? this.currentProject : await this.get(projectId);
            if (!project || project.accessRequired || !await this.ensurePermission(project.directoryHandle)) return null;
            const item = (await this.readAssetMetadata(project)).find(candidate => candidate.id === assetId);
            if (!item) return null;
            try {
                const directory = await project.directoryHandle.getDirectoryHandle(ASSET_DIRECTORY);
                const file = await (await directory.getFileHandle(item.fileName)).getFile();
                return { ...item, projectId: project.id, file };
            } catch (error) {
                if (error?.name === 'NotFoundError') return null;
                throw error;
            }
        }

        async writeAssetMetadata(metadata, project = this.currentProject) {
            await this.writeText(await this.getUawDirectory(project.directoryHandle, true), ASSET_META_FILE, JSON.stringify(metadata, null, 2));
        }

        async putAsset(asset) {
            const project = this.currentProject;
            if (!project || !asset.id || !asset.data || !await this.ensurePermission(project.directoryHandle, true)) return null;
            const assetDirectory = await project.directoryHandle.getDirectoryHandle(ASSET_DIRECTORY, { create: true });
            const metadata = (await this.readAssetMetadata(project)).filter((item) => item.id !== asset.id);
            const blob = this.dataUrlToBlob(asset.data);
            const fileName = `${String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.${this.mimeExtension(asset.mimeType || blob.type)}`;
            const writable = await (await assetDirectory.getFileHandle(fileName, { create: true })).createWritable();
            await writable.write(blob); await writable.close();
            const record = { id: asset.id, name: asset.name || fileName, fileName, mimeType: asset.mimeType || blob.type || 'application/octet-stream', updatedAt: new Date().toISOString() };
            metadata.push(record);
            await this.writeAssetMetadata(metadata, project);
            emit('uaw:assets-changed', { asset: { ...record, data: asset.data } });
            return { ...record, data: asset.data, projectId: project.id };
        }

        async listAssets(projectId = this.currentProject?.id) {
            const assets = [];
            for (const item of await this.listAssetMetadata(projectId)) {
                const record = await this.readAsset(item.id, projectId);
                if (record) assets.push({ ...item, data: await this.blobToDataUrl(record.file) });
            }
            return assets;
        }

        async removeAsset(assetId, projectId = this.currentProject?.id) {
            const project = projectId === this.currentProject?.id ? this.currentProject : await this.get(projectId, { requestPermission: true });
            if (!project || project.accessRequired) return false;
            const metadata = await this.readAssetMetadata(project);
            const asset = metadata.find((item) => item.id === assetId);
            if (asset) {
                const directory = await project.directoryHandle.getDirectoryHandle(ASSET_DIRECTORY, { create: true });
                await directory.removeEntry(asset.fileName).catch((error) => { if (error?.name !== 'NotFoundError') throw error; });
            }
            await this.writeAssetMetadata(metadata.filter((item) => item.id !== assetId), project);
            emit('uaw:assets-changed', { removedAssetId: assetId });
            return true;
        }

        isValidWorkSpec(value) {
            if (!value?.trim()) return false;
            try {
                const parsed = JSON.parse(value);
                return window.WorkSpecValidator?.validate ? Boolean(window.WorkSpecValidator.validate(parsed)?.ok) : true;
            } catch (_error) { return false; }
        }

        async createCheckpoint(label = 'Checkpoint') {
            if (!this.currentProject || !this.editor) return null;
            await this.saveCurrent();
            const checkpoint = {
                id: createId(),
                label,
                createdAt: new Date().toISOString(),
                workSpec: this.editor.getValue(),
                script: this.scriptEditor?.getValue?.() ?? this.currentProject.scriptDraft ?? blankScript()
            };
            const directory = await (await this.getUawDirectory(this.currentProject.directoryHandle, true)).getDirectoryHandle(CHECKPOINT_DIRECTORY, { create: true });
            await this.writeText(directory, `${checkpoint.id}.workspec.json`, checkpoint.workSpec);
            await this.writeText(directory, `${checkpoint.id}.workspec.js`, checkpoint.script);
            this.currentProject.checkpoints = [...(this.currentProject.checkpoints || []), checkpoint].slice(-20);
            this.currentProject = await this.put(this.currentProject);
            emit('uaw:checkpoint-created', { checkpoint });
            return checkpoint;
        }

        async restoreCheckpoint(checkpointId) {
            const checkpoint = this.currentProject?.checkpoints?.find((item) => item.id === checkpointId);
            if (!checkpoint || !this.editor) return false;
            await this.createCheckpoint('Before checkpoint restore');
            this.editor.setValue(checkpoint.workSpec);
            if (this.scriptEditor && typeof checkpoint.script === 'string') this.scriptEditor.setValue(checkpoint.script);
            return true;
        }

        async rename(id, name) {
            const project = await this.get(id, { requestPermission: true });
            if (!project || project.accessRequired) return null;
            project.name = String(name || '').trim() || project.directoryHandle.name || 'Untitled project';
            const saved = await this.put(project);
            if (this.currentProject?.id === id) { this.currentProject = saved; emit('uaw:project-opened', { project: saved }); }
            return saved;
        }

        async open(id, options = {}) {
            await this.saveCurrent();
            const project = await this.get(id, { requestPermission: Boolean(options.requestPermission) });
            if (!project || project.accessRequired) { emit('uaw:project-access-required', { project }); return null; }
            this.currentProject = project;
            if (this.editor) {
                this.isOpeningProject = true;
                const content = project.workSpecDraft || project.lastValidWorkSpec;
                if (content && this.editor.getValue() !== content) this.editor.setValue(content);
                const script = project.scriptDraft ?? blankScript();
                if (this.scriptEditor && this.scriptEditor.getValue() !== script) this.scriptEditor.setValue(script);
                queueMicrotask(() => { this.isOpeningProject = false; });
            }
            emit('uaw:project-opened', { project });
            return project;
        }

        scheduleSave() {
            if (this.isOpeningProject || !this.currentProject || !this.editor) return;
            emit('uaw:project-saving', { project: this.currentProject });
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                this.saveCurrent().catch((error) => emit('uaw:project-save-error', { project: this.currentProject, error }));
            }, AUTOSAVE_DELAY);
        }

        async saveCurrent() {
            if (!this.currentProject || !this.editor) return null;
            const save = async () => {
                const content = this.editor.getValue();
                this.currentProject.workSpecDraft = content;
                this.currentProject.scriptDraft = this.scriptEditor?.getValue?.() ?? this.currentProject.scriptDraft ?? blankScript();
                if (this.isValidWorkSpec(content)) this.currentProject.lastValidWorkSpec = content;
                this.currentProject = await this.put(this.currentProject);
                emit('uaw:project-saved', { project: this.currentProject });
                return this.currentProject;
            };
            this.writeChain = this.writeChain.then(save, save);
            return this.writeChain;
        }

        async readLegacyStore(storeName) {
            await this.ready;
            if (!this.db?.objectStoreNames.contains(storeName)) return [];
            return new Promise((resolve, reject) => {
                const request = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }

        legacyLocalStorageProjects() {
            const results = [];
            try {
                const legacySettings = {};
                const legacyCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
                const legacyValidator = localStorage.getItem('uaw-metrics-validator-custom');
                if (legacyCatalog || legacyValidator) legacySettings.customMetrics = { catalog: legacyCatalog || null, validator: legacyValidator || null };
                try {
                    const customObjectTypes = JSON.parse(localStorage.getItem('uaw-custom-object-types') || '[]');
                    if (Array.isArray(customObjectTypes) && customObjectTypes.length) legacySettings.customObjectTypes = customObjectTypes;
                } catch (_error) { /* Leave malformed legacy settings untouched. */ }
                const projects = JSON.parse(localStorage.getItem(LEGACY_PROJECTS_KEY) || '[]');
                if (Array.isArray(projects)) results.push(...projects.map((project) => ({ ...project, settings: { ...legacySettings, ...(project.settings || {}) }, legacySource: 'local-project' })));
                const draft = localStorage.getItem(LEGACY_DOCUMENT_KEY);
                if (draft) results.push({ id: 'legacy-editor-draft', name: 'Recovered editor draft', workSpecDraft: draft, settings: legacySettings, legacySource: 'editor-draft' });
                for (let index = 0; index < localStorage.length; index += 1) {
                    const key = localStorage.key(index);
                    if (!key?.startsWith(LEGACY_SHARE_PREFIX)) continue;
                    try {
                        const record = JSON.parse(localStorage.getItem(key));
                        if (record?.payload) results.push({ id: `legacy-share-${key.slice(LEGACY_SHARE_PREFIX.length)}`, name: 'Recovered browser snapshot', workSpecDraft: JSON.stringify(record.payload, null, 2), settings: legacySettings, legacySource: 'browser-snapshot', legacyKey: key });
                    } catch (_error) { /* Preserve malformed data for manual recovery. */ }
                }
            } catch (error) { console.warn('Unable to inspect legacy project data:', error); }
            return results;
        }

        async discoverLegacyProjects() {
            const registeredIds = new Set((await this.registryGetAll()).map((project) => project.id));
            const indexed = (await this.readLegacyStore(LEGACY_PROJECT_STORE))
                .filter((project) => project?.workSpecDraft || project?.lastValidWorkSpec)
                .map((project) => ({ ...project, legacySource: 'indexed-project' }));
            const seen = new Set();
            this.legacyProjects = [...indexed, ...this.legacyLocalStorageProjects()].filter((project) => {
                if (registeredIds.has(project.id)) return false;
                const fingerprint = `${project.id || ''}:${project.workSpecDraft || project.lastValidWorkSpec || ''}`;
                if (seen.has(fingerprint)) return false;
                seen.add(fingerprint); return true;
            });
            if (this.legacyProjects.length) emit('uaw:legacy-projects-found', { projects: this.legacyProjects.slice() });
            return this.legacyProjects;
        }

        getLegacyProjects() { return this.legacyProjects.slice(); }

        async deleteLegacyRecord(legacy) {
            if (legacy.legacySource === 'indexed-project' && this.db) {
                const stores = [LEGACY_PROJECT_STORE];
                if (this.db.objectStoreNames.contains(LEGACY_ASSET_STORE)) stores.push(LEGACY_ASSET_STORE);
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(stores, 'readwrite');
                    transaction.objectStore(LEGACY_PROJECT_STORE).delete(legacy.id);
                    if (stores.includes(LEGACY_ASSET_STORE)) {
                        const request = transaction.objectStore(LEGACY_ASSET_STORE).index('projectId').openCursor(IDBKeyRange.only(legacy.id));
                        request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
                    }
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(transaction.error);
                });
            }
            if (legacy.legacySource === 'local-project') {
                localStorage.removeItem(`uaw-v2-assets:${legacy.id}`);
                try {
                    const projects = JSON.parse(localStorage.getItem(LEGACY_PROJECTS_KEY) || '[]');
                    if (Array.isArray(projects)) {
                        const remainingProjects = projects.filter((project) => project?.id !== legacy.id);
                        if (remainingProjects.length) localStorage.setItem(LEGACY_PROJECTS_KEY, JSON.stringify(remainingProjects));
                        else localStorage.removeItem(LEGACY_PROJECTS_KEY);
                    }
                } catch (_error) { /* Preserve malformed legacy data for manual recovery. */ }
            }
            if (legacy.legacySource === 'editor-draft') localStorage.removeItem(LEGACY_DOCUMENT_KEY);
            if (legacy.legacySource === 'browser-snapshot' && legacy.legacyKey) localStorage.removeItem(legacy.legacyKey);
            if (!this.legacyProjects.some((item) => item !== legacy)) {
                localStorage.removeItem('uaw-metrics-catalog-custom');
                localStorage.removeItem('uaw-metrics-validator-custom');
                localStorage.removeItem('uaw-custom-object-types');
            }
        }

        async deleteLegacyProject(legacyId) {
            const legacy = this.legacyProjects.find((item) => item.id === legacyId);
            if (!legacy) return false;
            await this.deleteLegacyRecord(legacy);
            this.legacyProjects = this.legacyProjects.filter((item) => item !== legacy);
            emit('uaw:legacy-project-deleted', { project: legacy, remaining: this.legacyProjects.length });
            return true;
        }

        async migrateLegacyProject(legacyId) {
            const legacy = this.legacyProjects.find((item) => item.id === legacyId);
            if (!legacy) return null;
            let directoryHandle;
            try { directoryHandle = await this.chooseProjectDirectory(`uaw-migrate-${String(legacy.id).slice(0, 20)}`); }
            catch (error) { if (isAbortError(error)) return null; throw error; }
            const project = await this.create(legacy.name || directoryHandle.name, legacy.workSpecDraft || legacy.lastValidWorkSpec || blankWorkSpec(), directoryHandle);
            if (!project) return null;
            const generatedId = project.id;
            project.id = legacy.id || generatedId;
            if (project.id !== generatedId) await this.registryDelete(generatedId);
            Object.assign(project, {
                description: legacy.description || '', createdAt: legacy.createdAt || project.createdAt,
                checkpoints: Array.isArray(legacy.checkpoints) ? legacy.checkpoints : [],
                agentThreadId: legacy.agentThreadId || null, settings: legacy.settings || {}
            });
            this.currentProject = await this.put(project);
            let legacyAssets = [];
            if (legacy.legacySource === 'indexed-project') legacyAssets = (await this.readLegacyStore(LEGACY_ASSET_STORE)).filter((asset) => asset.projectId === legacy.id);
            if (legacy.legacySource === 'local-project') {
                try { legacyAssets = JSON.parse(localStorage.getItem(`uaw-v2-assets:${legacy.id}`) || '[]'); } catch (_error) { legacyAssets = []; }
            }
            for (const asset of legacyAssets) await this.putAsset(asset);
            const checkpointDirectory = await (await this.getUawDirectory(directoryHandle, true)).getDirectoryHandle(CHECKPOINT_DIRECTORY, { create: true });
            for (const checkpoint of this.currentProject.checkpoints || []) {
                if (checkpoint.id && checkpoint.workSpec) await this.writeText(checkpointDirectory, `${checkpoint.id}.workspec.json`, checkpoint.workSpec);
                if (checkpoint.id && typeof checkpoint.script === 'string') await this.writeText(checkpointDirectory, `${checkpoint.id}.workspec.js`, checkpoint.script);
            }
            await this.put(this.currentProject);
            await this.deleteLegacyRecord(legacy);
            this.legacyProjects = this.legacyProjects.filter((item) => item !== legacy);
            emit('uaw:legacy-project-migrated', { project, remaining: this.legacyProjects.length });
            emit('uaw:projects-changed', { project });
            return project;
        }

        async attachEditor(editor) {
            if (!editor || this.editor === editor) return;
            this.editor = editor;
            editor.onDidChangeModelContent(() => this.scheduleSave());
            await this.discoverLegacyProjects();
            const registry = await this.registryGetAll();
            for (const project of registry) {
                if (await this.ensurePermission(project.directoryHandle)) { await this.open(project.id); return; }
            }
            emit('uaw:project-selection-required', { projects: registry });
        }

        attachScriptEditor(editor) {
            if (!editor || this.scriptEditor === editor) return;
            this.scriptEditor = editor;
            editor.onDidChangeModelContent(() => {
                emit('uaw:script-changed', { script: editor.getValue(), project: this.currentProject });
                this.scheduleSave();
            });
            const script = this.currentProject?.scriptDraft ?? blankScript();
            if (editor.getValue() !== script) editor.setValue(script);
            emit('uaw:script-ready', { script, project: this.currentProject });
        }

        getCurrent() { return this.currentProject; }
    }

    const store = new ProjectStore();
    window.UAWProjectStore = store;
    window.addEventListener('uaw:editor-ready', (event) => store.attachEditor(event.detail?.editor || window.monacoEditor || window.editor));
    window.addEventListener('uaw:script-editor-ready', (event) => store.attachScriptEditor(event.detail?.editor || window.workSpecScriptEditor));
    window.addEventListener('DOMContentLoaded', () => {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            const candidate = window.monacoEditor || window.editor;
            if (candidate?.onDidChangeModelContent) { clearInterval(timer); store.attachEditor(candidate); }
            else if (attempts > 100) clearInterval(timer);
        }, 100);
    });
})();
