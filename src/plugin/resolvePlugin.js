const path = require('path');
const fs = require('fs');

module.exports = class ResolvePlugin {
    apply(mpb) {
        // const extensionsKey = Object.keys(mpb.extensions);
        mpb.hooks.resolve.tap('ResolvePlugin', ({ imported, asset, resolveType }) => {
            if (imported.includes(mpb.root)) {
                return { imported, originImported: imported, asset, resolveType };
            }
            let type = resolveType;
            if (resolveType === 'manifest') {
                // 通过js 来判定是否是合法组件/页面
                type = 'es';
            }
            const resolve = mpb.resolve[type];
            // extensionsKey.forEach((key) => {
            //     if (mpb.extensions[key].includes(asset.ext)) {
            //         resolve = mpb.resolve[key];
            //     }
            // });
            if (resolve) {
                if (imported[0] === '/') {
                    let i = imported;
                    // TODO 如何更好的处理 / 这种绝对路径的逻辑
                    if (
                        !(
                            mpb.assetManager.getAssets(`${imported}.js`) ||
                            mpb.assetManager.getAssets(`${imported}.ts`) ||
                            mpb.assetManager.getAssets(`${imported}.tsx`) ||
                            mpb.assetManager.getAssets(`${imported}.json`) ||
                            fs.existsSync(`${imported}.js`) ||
                            fs.existsSync(`${imported}.ts`) ||
                            fs.existsSync(`${imported}.tsx`) ||
                            fs.existsSync(`${imported}.json`)
                        )
                    ) {
                        i = path.join(mpb.src, imported);
                    }
                    console.log('imported', imported, i);
                    return {
                        imported: i,
                        originImported: imported,
                        asset,
                        resolveType,
                    };
                }
                let res = resolve(imported, asset.dir);
                if (resolveType === 'manifest') {
                    const file = path.parse(res);
                    if (file.ext) {
                        res = `${file.dir}/${file.name}`;
                    }
                }
                return { imported: res, originImported: imported, asset, resolveType };
            }
            throw new Error(`不识别的文件格式: ${asset.path}`);
        });
    }
};
