const chalk = require('chalk');
const { assetType } = require('../consts');

module.exports = class ResolveOutputJsPack {
    apply(mpb) {
        mpb.hooks.resolveOutputJsPack.tap(
            'resolveOutputJsPack',
            ({ libOutputPath, root, asset } = {}) =>
                mpb.jsPackageManager.resolveJs({
                    libOutputPath,
                    root,
                    asset,
                })
        );
        mpb.hooks.beforeEmitFile.tapPromise('resolveOutputJsPack', async (asset) => {
            if (/\.js$/.test(asset.outputFilePath)) {
                const root = asset.getMeta('root');
                const type = asset.getMeta('type');
                if (!asset.getMeta('noNum')) {
                    asset.setMeta(
                        'outputFileNum',
                        mpb.jsPackageManager.resolveJs({
                            libOutputPath: asset.outputFilePath,
                            root,
                            asset,
                        }).outputFileNum
                    );
                }
                await mpb.jsPackageManager.renderGlobal();
                if (!asset.getMeta('bundle')) {
                    await mpb.jsPackageManager.addChange(root, asset);
                }
                if ([assetType.app, assetType.page, assetType.component].indexOf(type) !== -1) {
                    asset.packContents = asset.contents;
                    // 渲染normal的
                    // root, moduleId, needRequireBundle
                    // root写死
                    // moduleId需要生成
                    // needRequireBundle assetType.app || 子包的assetType.page
                    // 判断是否需要重新output
                    asset.contents = await mpb.jsPackageManager.renderNormal({
                        asset,
                        root,
                        moduleId: asset.getMeta('outputFileNum'),
                        needRequireBundle:
                            type === assetType.app ||
                            type === assetType.page ||
                            type === assetType.component,
                    });
                } else if (!asset.getMeta('bundle')) {
                    asset.packContents = asset.contents;
                    asset.contents = null;
                }
            }
        });
        mpb.hooks.afterCompile.tapPromise('resolveOutputJsPack', async () => {
            const { changePackages, mainPkgPathMap, subPkgPathMap } = mpb.jsPackageManager;
            await new Promise((resolve) => setTimeout(resolve, 1000));
            while (changePackages.length) {
                const root = changePackages.pop();
                await mpb.jsPackageManager.renderBundle({
                    root,
                    packageModule: !root ? mainPkgPathMap : subPkgPathMap.get(root),
                });
            }
        });
    }
};
