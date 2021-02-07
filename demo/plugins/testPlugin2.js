class TestPlugin {
    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('test2', async (asset) => {
            const { path, outputFilePath, shouldOutput } = asset;
            console.log(path, outputFilePath, shouldOutput);
        });
    }
}

module.exports = TestPlugin;
