// Playground Migration - WorkSpec v1.0 → v2.0 helper UI
// Universal Automation Wiki - Simulation Playground

(function() {
    'use strict';

    function getPrimaryEditor() {
        return window.monacoEditor || window.editor || null;
    }

    function parseEditorJson(editorInstance) {
        const raw = editorInstance.getValue();
        const cleaned = (typeof stripJsonComments === 'function') ? stripJsonComments(raw) : raw;
        return { raw, parsed: JSON.parse(cleaned) };
    }

    function closeDropdownMenus() {
        document.querySelectorAll('.dropdown-content').forEach((menu) => {
            menu.style.display = 'none';
        });
    }

    function showMigrationDiff(oldContent, newContent) {
        if (typeof window.SmartActionsDiff !== 'function') {
            alert('Diff preview is unavailable (SmartActionsDiff not loaded).');
            return;
        }

        const diff = new window.SmartActionsDiff();
        diff.show(
            oldContent,
            newContent,
            (approvedContent) => {
                try {
                    const editorInstance = getPrimaryEditor();
                    if (!editorInstance || typeof editorInstance.setValue !== 'function') {
                        alert('Editor not available to apply migration.');
                        return;
                    }
                    editorInstance.setValue(approvedContent);
                    if (typeof validateJSON === 'function') {
                        validateJSON();
                    }
                } catch (error) {
                    console.error('Migration apply failed:', error);
                    alert(`Migration apply failed: ${error.message || error}`);
                }
            },
            () => {
                // User declined migration
            }
        );
    }

    function handleMigrateClick(e) {
        e.preventDefault();
        closeDropdownMenus();

        if (!window.WorkSpecMigration || typeof window.WorkSpecMigration.migrate !== 'function') {
            alert('Migration tool not available (WorkSpecMigration not loaded).');
            return;
        }

        const editorInstance = getPrimaryEditor();
        if (!editorInstance || typeof editorInstance.getValue !== 'function') {
            alert('Editor not ready yet.');
            return;
        }

        let raw;
        let parsed;
        try {
            const result = parseEditorJson(editorInstance);
            raw = result.raw;
            parsed = result.parsed;
        } catch (error) {
            alert('Invalid JSON. Fix JSON errors before migrating.');
            return;
        }

        const sim = parsed?.simulation;
        if (sim?.schema_version === '2.0' && sim?.world && sim?.process) {
            alert('This document already looks like WorkSpec v2.0.');
            return;
        }

        let migrated;
        try {
            migrated = window.WorkSpecMigration.migrate(parsed, {
                addSchema: true,
                defaultCurrency: 'USD',
                defaultLocale: 'en-US',
                defaultTimezone: 'UTC'
            });
        } catch (error) {
            console.error('Migration failed:', error);
            alert(`Migration failed: ${error.message || error}`);
            return;
        }

        const newContent = JSON.stringify(migrated, null, 2);
        showMigrationDiff(raw, newContent);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const migrateBtn = document.getElementById('migrate-workspec-btn');
        if (!migrateBtn) return;

        migrateBtn.addEventListener('click', handleMigrateClick);
    });
})();

