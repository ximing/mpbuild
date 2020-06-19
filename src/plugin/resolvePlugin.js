const path = require('path');

module.exports = class ResolvePlugin {
    apply(mpb) {
        const extensionsKey = Object.keys(mpb.extensions);
        mpb.hooks.resolve.tap('ResolvePlugin', ({ imported, asset }) => {
            if (imported.includes(mpb.root)) {
                return { imported, asset };
            }
            let resolve;
            extensionsKey.forEach((key) => {
                if (mpb.extensions[key].includes(asset.ext)) {
                    resolve = mpb.resolve[key];
                }
            });
            if (resolve) {
                if (imported[0] === '/') {
                    return { imported: path.join(mpb.src, imported), asset };
                }
                const res = resolve(imported, asset.dir);
                return { imported: res, asset };
            }
            throw new Error(`不识别的文件格式: ${asset.path}`);
        });
    }
};
