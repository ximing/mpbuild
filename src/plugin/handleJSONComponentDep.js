/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');

module.exports = class HandleJSONComponentDep {
    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            const key = asset.getMeta('mbp-scan-json-dep');
            if (key) {
                const code = JSON.parse(asset.contents);
                const componets = code[key];
                if (componets) {
                    // TODO 这里需要支持 alias
                    await Promise.all(
                        Object.keys(componets).map((componentName) => {
                            let filePath = '',
                                src = componets[componentName];
                            if (src[0] === '/') {
                                filePath = path.resolve(mpb.src, `.${src}`);
                            } else if (src[0] === '.') {
                                filePath = path.resolve(asset.dir, src);
                            } else {
                                filePath = path.resolve(asset.dir, `./${src}`);
                            }
                            mpb.scan.addAssetByEXT(
                                filePath.replace(mpb.src, ''),
                                path.resolve(mpb.dest, path.relative(mpb.src, filePath))
                            );
                        })
                    );
                }
            }
            return asset;
        });
    }
};
