// HTML Sanitizer Utility - Prevents XSS vulnerabilities
// Universal Automation Wiki - Security Utilities

/**
 * Sanitizes HTML content by escaping dangerous characters
 * @param {string} unsafe - The unsafe HTML string to sanitize
 * @returns {string} - The sanitized HTML string
 */
function sanitizeHTML(unsafe) {
    // Accept numbers and other primitive values by coercing to string.
    // Preserve previous behavior for null/undefined by returning an empty string.
    if (unsafe === null || unsafe === undefined) {
        return '';
    }

    // Coerce to string so numeric values (like utilization percentages) are preserved
    // and then escape dangerous characters.
    const safeStr = String(unsafe);

    return safeStr
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes a text string for safe display in HTML context
 * Alias for sanitizeHTML for clarity
 * @param {string} text - The text to sanitize
 * @returns {string} - The sanitized text
 */
function sanitizeText(text) {
    // Alias for sanitizeHTML; keep semantics identical (coerce primitives to string)
    return sanitizeHTML(text);
}

/**
 * Creates a safe HTML string by sanitizing dynamic content while preserving static HTML structure
 * @param {string} template - HTML template with ${} placeholders
 * @param {object} values - Object with values to substitute
 * @returns {string} - Safe HTML with sanitized values
 */
function createSafeHTML(template, values) {
    let safeHTML = template;

    for (const [key, value] of Object.entries(values)) {
        const placeholder = `\${${key}}`;
        const sanitizedValue = sanitizeHTML(value);
        safeHTML = safeHTML.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizedValue);
    }

    return safeHTML;
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.sanitizeHTML = sanitizeHTML;
    window.sanitizeText = sanitizeText;
    window.createSafeHTML = createSafeHTML;
}