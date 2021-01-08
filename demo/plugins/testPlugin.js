class TestPlugin {
    apply(mpb) {
        mpb.hooks.addAsset.tapPromise('LoaderManager', async (asset) => {
            // console.log('ss', asset.filePath, mpb.appEntry);
            return asset;
        });
    }
}

module.exports = TestPlugin;
