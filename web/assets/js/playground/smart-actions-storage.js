// Smart Actions Storage - LocalStorage helpers with in-memory cache
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    const STORAGE_KEY = 'uaw-smart-actions-config';
    const PREFS_KEY = 'uaw-smart-actions-prefs';

    let unlockedConfig = null;
    let unlockedPassword = null;

    function getStorage() {
        if (typeof window === 'undefined') {
            return null;
        }
        try {
            return window.localStorage;
        } catch (error) {
            console.warn('SmartActions: LocalStorage is not accessible.', error);
            return null;
        }
    }

    function isValidEncryptedPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        const requiredKeys = ['version', 'salt', 'iv', 'payload'];
        return requiredKeys.every(key => typeof payload[key] === 'string' && payload[key].length > 0);
    }

    function loadEncryptedConfig() {
        const storage = getStorage();
        if (!storage) {
            return null;
        }
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            if (!isValidEncryptedPayload(parsed)) {
                storage.removeItem(STORAGE_KEY);
                return null;
            }
            return parsed;
        } catch (error) {
            console.error('SmartActions: Stored configuration is corrupt. Resetting.', error);
            storage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    function saveEncryptedConfig(payload) {
        const storage = getStorage();
        if (!storage) {
            throw new Error('LocalStorage is unavailable. Cannot persist Smart Actions configuration.');
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    function loadPlainPreferences() {
        const storage = getStorage();
        if (!storage) {
            return null;
        }
        try {
            const raw = storage.getItem(PREFS_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return null;
            const { provider = '', model = '' } = data;
            return { provider, model };
        } catch (err) {
            console.warn('SmartActions: Failed to load plaintext preferences.', err);
            return null;
        }
    }

    function savePlainPreferences(prefs) {
        const storage = getStorage();
        if (!storage) {
            throw new Error('LocalStorage is unavailable. Cannot persist Smart Actions preferences.');
        }
        const minimal = {
            provider: prefs && typeof prefs.provider === 'string' ? prefs.provider : '',
            model: prefs && typeof prefs.model === 'string' ? prefs.model : ''
        };
        storage.setItem(PREFS_KEY, JSON.stringify(minimal));
    }

    function clearConfiguration() {
        const storage = getStorage();
        if (storage) {
            storage.removeItem(STORAGE_KEY);
        }
        unlockedConfig = null;
        unlockedPassword = null;
    }

    function setUnlockedConfiguration(config, password) {
        unlockedConfig = config ? { ...config } : null;
        unlockedPassword = password || null;
    }

    function getUnlockedConfiguration() {
        if (!unlockedConfig) {
            return null;
        }
        return { ...unlockedConfig };
    }

    function getUnlockedPassword() {
        return unlockedPassword;
    }

    function hasEncryptedConfig() {
        return Boolean(loadEncryptedConfig());
    }

    window.SmartActionsStorage = {
        loadEncryptedConfig,
        saveEncryptedConfig,
        loadPlainPreferences,
        savePlainPreferences,
        clearConfiguration,
        setUnlockedConfiguration,
        getUnlockedConfiguration,
        getUnlockedPassword,
        hasEncryptedConfig
    };
})();
