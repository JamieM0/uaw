const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const document = {
    addEventListener() {},
    body: { classList: { add() {} }, dataset: {} }
};
const windowValue = {
    addEventListener() {},
    dispatchEvent() {},
    AssetManager: { normalizeId: value => String(value || '').replace(/^asset:/, '') }
};
windowValue.window = windowValue;

const context = vm.createContext({
    window: windowValue,
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    console,
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {}
});
const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'playground', 'playground-shell-v2.js'), 'utf8');
vm.runInContext(source, context);

const assets = Array.from({ length: 10_000 }, (_, index) => ({
    id: `asset_${index}`,
    name: `Asset ${index}`,
    mimeType: 'image/png',
    data: `payload-that-must-not-be-rendered-${index}`
}));
const view = {
    html: '',
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
const shell = windowValue.UAWPlaygroundShell;
shell.workspace = 'assets';
shell.shell = { querySelector: selector => selector === '#uaw-assets-view' ? view : null };
shell.projectStore = { listAssetMetadata: async () => assets };
shell.readStateVisualDocument = () => ({ simulation: { state_libraries: {} } });

(async () => {
    await shell.renderAssets();
    assert.equal((view.html.match(/data-asset-id=/g) || []).length, 60, 'the initial asset grid must remain bounded');
    assert.match(view.html, /60 of 10000 shown/, 'large libraries must expose incremental loading');
    assert.doesNotMatch(view.html, /payload-that-must-not-be-rendered/, 'asset bytes must never enter asset workspace markup');
    assert.doesNotMatch(view.html, /data-state-asset-id=/, 'the hidden picker must not eagerly render its asset list');
    console.log('✓ asset workspace bounds 10,000 metadata records to 60 byte-free cards');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
