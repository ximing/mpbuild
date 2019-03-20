/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');

module.exports = class HandleJSONComponentDep {
    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (/\.json$/.test(asset.outputFilePath) && asset.contents) {
                const code = JSON.parse(asset.contents);
                if (code.usingComponents) {
                    const componets = code.usingComponents;
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
            }
            return asset;
        });
    }
};
