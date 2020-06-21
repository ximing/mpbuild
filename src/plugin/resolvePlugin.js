const path = require('path');

module.exports = class ResolvePlugin {
    apply(mpb) {
        // const extensionsKey = Object.keys(mpb.extensions);
        mpb.hooks.resolve.tap('ResolvePlugin', ({ imported, asset, resolveType }) => {
            if (imported.includes(mpb.root)) {
                return { imported, asset, resolveType };
            }
            const resolve = mpb.resolve[resolveType];
            // extensionsKey.forEach((key) => {
            //     if (mpb.extensions[key].includes(asset.ext)) {
            //         resolve = mpb.resolve[key];
            //     }
            // });
            if (resolve) {
                if (imported[0] === '/') {
                    return { imported: path.join(mpb.src, imported), asset, resolveType };
                }
                const res = resolve(imported, asset.dir);
                return { imported: res, asset, resolveType };
            }
            throw new Error(`不识别的文件格式: ${asset.path}`);
        });
    }
};
