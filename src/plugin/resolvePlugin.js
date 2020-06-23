const path = require('path');

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
                    return {
                        imported: path.join(mpb.src, imported),
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
