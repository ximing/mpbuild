/**
 * Created by ximing on 2019-03-15.
 */
const postcss = require('postcss');
const path = require('path');

module.exports = class HandleWXSSDep {

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleWXSSDep', async (asset) => {
            if (/\.wxss$/.test(asset.name)) {
                const deps = [];
                const distDeps = [];
                try {
                    const root = postcss.parse(asset.contents);
                    root.walkAtRules('import', (rule) => {
                        const libPath = rule.params.replace(/'|"/g, '');
                        deps.push(libPath);
                    });
                    try {
                        await Promise.all(
                            deps.map((src) => {
                                const res = mpb.hooks.resolve.call({
                                    lib: src,
                                    resolveLib: '',
                                    asset,
                                    resolveType: 'wxss',
                                    exts: mpb.exts.wxss,
                                });
                                const filePath = res.resolveLib;

                                const root = asset.getMeta('root');
                                const { outputPath } = mpb.hooks.rewriteOutputPath.call({
                                    filePath,
                                    asset,
                                    depType: 'wxss',
                                });
                                distDeps.push(outputPath);
                                return mpb.assetManager.addAsset(filePath, outputPath, {
                                    root,
                                    source: asset.filePath,
                                });
                            })
                        );
                        let index = 0;
                        root.walkAtRules('import', (rule) => {
                            rule.params = JSON.stringify(
                                path.relative(path.dirname(asset.outputFilePath), distDeps[index])
                            );
                            index++;
                        });
                        asset.contents = root.toString();
                    } catch (e) {
                        console.error(e);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            return asset;
        });
    }
};
