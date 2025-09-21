// Test script for AssetManager functionality
// Run this in the browser console on the playground page

function testAssetManager() {
    console.log('🧪 Testing AssetManager functionality...');

    // Check if AssetManager exists
    if (!window.AssetManager) {
        console.error('❌ AssetManager not found on window object');
        return false;
    }

    console.log('✅ AssetManager found');

    // Test UUID generation
    const uuid1 = window.AssetManager.generateUUID();
    const uuid2 = window.AssetManager.generateUUID();

    if (!uuid1 || !uuid2 || uuid1 === uuid2) {
        console.error('❌ UUID generation failed');
        return false;
    }

    console.log('✅ UUID generation works:', uuid1);

    // Test asset reference detection
    const testRef = 'asset:' + uuid1;
    const testUrl = 'https://example.com/image.png';

    if (!window.AssetManager.isAssetReference(testRef)) {
        console.error('❌ Asset reference detection failed');
        return false;
    }

    if (window.AssetManager.isAssetReference(testUrl)) {
        console.error('❌ Asset reference false positive');
        return false;
    }

    console.log('✅ Asset reference detection works');

    // Test asset storage and retrieval (if editor is available)
    if (window.editor) {
        try {
            const testData = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+';
            const assetRef = window.AssetManager.storeAsset(testData);

            if (!assetRef || !assetRef.startsWith('asset:')) {
                console.error('❌ Asset storage failed');
                return false;
            }

            console.log('✅ Asset storage works:', assetRef);

            const retrievedData = window.AssetManager.getAsset(assetRef);
            if (retrievedData !== testData) {
                console.error('❌ Asset retrieval failed');
                return false;
            }

            console.log('✅ Asset retrieval works');

            // Test asset resolution
            const resolved = window.AssetManager.resolveAsset(assetRef);
            if (resolved !== testData) {
                console.error('❌ Asset resolution failed');
                return false;
            }

            console.log('✅ Asset resolution works');

        } catch (e) {
            console.error('❌ Asset management test failed:', e);
            return false;
        }
    } else {
        console.warn('⚠️ Editor not available, skipping storage tests');
    }

    console.log('🎉 All AssetManager tests passed!');
    return true;
}

// Auto-run test if this script is loaded
if (typeof window !== 'undefined') {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(testAssetManager, 1000); // Wait for modules to load
        });
    } else {
        setTimeout(testAssetManager, 1000);
    }
}