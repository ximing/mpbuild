/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const fs = require('fs');
const { assetType } = require('../consts');
const resolve = require('../resolve');
const { rewriteOutput } = require('../util');
const { rewriteNpm } = require('../util');

const NPM_PATH_NAME = 'node_modules';

module.exports = class HandleJSONComponentDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        const keys = Object.keys(mpb.config.alias || {});
        const alias = { keys, aliasMap: mpb.config.alias };
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (/\.config\.js$/.test(asset.path) && asset.contents) {
                const code = require(asset.path);
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

                                filePath = resolve(
                                    src,
                                    asset,
                                    mpb.exts.json,
                                    mpb.src,
                                    mpb.config.alias
                                );
                                // if (src[0] === '/') {
                                //     filePath = path.resolve(mpb.src, `.${src}`);
                                // } else if (src[0] === '.') {
                                //     filePath = path.resolve(asset.dir, src);
                                // } else {
                                //     filePath = path.resolve(asset.dir, `./${src}`);
                                //
                                //     if (!fs.existsSync(`${filePath}.json`)) {
                                //         filePath = resolve.sync(src, { basedir: mpb.cwd });
                                //         filePath = filePath.replace(path.parse(filePath).ext, '');
                                //     }
                                // }
                                const { outputPath } = mpb.hooks.rewriteOutputPath.call({
                                    filePath,
                                    asset,
                                    depType: 'json',
                                });
                                if (!this.mainPkgPathMap[outputPath]) {
                                    const root = asset.getMeta('root');
                                    const filePathRes = path.parse(filePath);
                                    const outputPathRes = path.parse(outputPath);
                                    const componentPath = path
                                        .join(outputPathRes.dir, outputPathRes.name)
                                        .replace('.json', '');
                                    mpb.scan.addAssetByEXT(
                                        path.join(filePathRes.dir, filePathRes.name),
                                        componentPath,
                                        assetType.component,
                                        undefined,
                                        root,
                                        asset.filePath
                                    );
                                    const compPath = componentPath.replace(mpb.dest, '');
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
