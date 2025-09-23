// Smart Actions Crypto - Encryption helpers for secure storage
// Universal Automation Wiki - Smart Actions Suite

(function() {
    'use strict';

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function getSubtleCrypto() {
        if (typeof window === 'undefined') {
            return null;
        }
        return (window.crypto && window.crypto.subtle) || null;
    }

    function toBase64(buffer) {
        if (!buffer) {
            return '';
        }
        const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
        let string = '';
        bytes.forEach(byte => {
            string += String.fromCharCode(byte);
        });
        return btoa(string);
    }

    function fromBase64(value) {
        if (!value) {
            return new Uint8Array();
        }
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async function deriveKey(password, salt) {
        const subtle = getSubtleCrypto();
        if (!subtle) {
            throw new Error('WebCrypto is not available in this environment.');
        }
        const keyMaterial = await subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 150000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptConfig(password, data) {
        if (!password) {
            throw new Error('Encryption password is required.');
        }
        const subtle = getSubtleCrypto();
        if (!subtle) {
            throw new Error('WebCrypto is unavailable, cannot encrypt configuration.');
        }

        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt);
        const encoded = encoder.encode(JSON.stringify(data));
        const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

        return {
            version: 1,
            salt: toBase64(salt),
            iv: toBase64(iv),
            payload: toBase64(encrypted)
        };
    }

    async function decryptConfig(password, encrypted) {
        if (!password) {
            throw new Error('Encryption password is required.');
        }
        const subtle = getSubtleCrypto();
        if (!subtle) {
            throw new Error('WebCrypto is unavailable, cannot decrypt configuration.');
        }
        if (!encrypted || !encrypted.payload) {
            throw new Error('Encrypted configuration is missing required fields.');
        }

        const salt = fromBase64(encrypted.salt);
        const iv = fromBase64(encrypted.iv);
        const cipherBytes = fromBase64(encrypted.payload);
        const key = await deriveKey(password, salt);

        try {
            const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
            const decoded = decoder.decode(decrypted);
            return JSON.parse(decoded);
        } catch (error) {
            throw new Error('Decryption failed. Check your password and try again.');
        }
    }

    function isCryptoSupported() {
        return Boolean(getSubtleCrypto());
    }

    window.SmartActionsCrypto = {
        encryptConfig,
        decryptConfig,
        isCryptoSupported
    };
})();
