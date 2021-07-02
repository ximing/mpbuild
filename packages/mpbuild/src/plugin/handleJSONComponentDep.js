/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');

const { assetType } = require('../consts');

function requireFromString(src, filename) {
    var Module = module.constructor;
    var m = new Module();
    m._compile(src, filename);
    return m.exports;
}

module.exports = class HandleJSONComponentDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (/\.config\.js$/.test(asset.path) && asset.contents) {
                // const code = require(asset.path);
                const code = requireFromString(asset.contents, asset.path);
                if (code.usingComponents) {
                    asset.contents = JSON.stringify(code);
                    asset.outputFilePath = asset.outputFilePath.replace('.config.js', '.json');
                }
            }
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

                                const res = mpb.hooks.resolve.call({
                                    lib: src,
                                    resolveLib: '',
                                    asset,
                                    resolveType: 'json',
                                    exts: mpb.exts.json,
                                });
                                filePath = res.resolveLib;

                                let { outputPath } = mpb.hooks.rewriteOutputPath.call({
                                    filePath,
                                    asset,
                                    depType: 'json',
                                });
                                if (outputPath.endsWith('.config.js')) {
                                    outputPath = outputPath.replace('.config.js', '.json');
                                }
                                if (filePath.endsWith('.config.js')) {
                                    filePath = filePath.replace('.config.js', '.json');
                                }
                                if (!this.mainPkgPathMap[outputPath]) {
                                    const root = asset.getMeta('root');
                                    const filePathRes = path.parse(filePath);
                                    const outputPathRes = path.parse(outputPath);
                                    const componentPath = path
                                        .join(outputPathRes.dir, outputPathRes.name)
                                        .replace('.json', '')
                                        .replace(`.${mpb.platform}`, '');
                                    mpb.scan.addAssetByEXT(
                                        path
                                            .join(filePathRes.dir, filePathRes.name)
                                            .replace(`.${mpb.platform}`, ''),
                                        componentPath,
                                        assetType.component,
                                        undefined,
                                        root,
                                        asset.filePath
                                    );
                                    let compPath = componentPath.replace(mpb.dest, '');
                                    if (
                                        mpb.config.output.component &&
                                        mpb.config.output.component.relative
                                    ) {
                                        compPath = path.relative(
                                            path.parse(asset.outputFilePath).dir,
                                            componentPath
                                        );
                                    }
                                    if (!root) {
                                        this.mainPkgPathMap[filePath] = compPath;
                                    }
                                    componets[componentName] = compPath;
                                } else {
                                    componets[componentName] = outputPath;
                                }
                                asset.contents = JSON.stringify(code);
                            })
                        );
                    }
                }
            }
            return asset;
        });
    }
};
