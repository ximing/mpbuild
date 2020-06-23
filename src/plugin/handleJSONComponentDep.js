/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const fs = require('fs');
const resolve = require('resolve');
const { assetType } = require('../consts');
const { rewriteNpm } = require('../util');

const NPM_PATH_NAME = 'node_modules';

module.exports = class HandleJSONComponentDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        const matcher = new RegExp(
            `(${mpb.extensions.manifest.map((i) => i.replace('.', '\\.')).join('|')})$`
        );
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (matcher.test(asset.path) && asset.contents) {
                let code;
                if (/\.json$/.test(asset.outputFilePath)) {
                    code = JSON.parse(asset.contents);
                    if (code.usingComponents) {
                        const componets = code.usingComponents;
                        if (componets) {
                            // TODO 这里需要支持 alias
                            await Promise.all(
                                Object.keys(componets).map(async (componentName) => {
                                    const { imported: lib } = mpb.hooks.beforeResolve.call({
                                        imported: componets[componentName],
                                        asset,
                                        resolveType: 'manifest',
                                    });
                                    const { imported: filePath } = mpb.hooks.resolve.call({
                                        imported: lib,
                                        asset,
                                        resolveType: 'manifest',
                                    });
                                    const nmPathIndex = filePath.indexOf(NPM_PATH_NAME);
                                    const root = asset.getMeta('root');
                                    let outputPath = this.mainPkgPathMap[filePath];
                                    if (!outputPath) {
                                        if (~nmPathIndex) {
                                            outputPath = rewriteNpm(filePath, root, mpb.dest);
                                        } else {
                                            outputPath = path.resolve(
                                                mpb.dest,
                                                `./${root || ''}`,
                                                path.relative(mpb.src, filePath)
                                            );
                                        }
                                        if (!root) {
                                            this.mainPkgPathMap[filePath] = outputPath;
                                        }
                                        await mpb.scan.addAssetByEXT(
                                            filePath.replace(mpb.src, '.'),
                                            outputPath,
                                            assetType.component,
                                            undefined,
                                            root,
                                            asset.filePath
                                        );
                                    }
                                    const {
                                        importedDest: destPath,
                                    } = mpb.hooks.reWriteImported.call({
                                        importedSrc: filePath,
                                        importedDest: outputPath,
                                        asset,
                                        resolveType: 'manifest',
                                    });
                                    componets[componentName] = destPath;
                                    asset.contents = JSON.stringify(code);
                                })
                            );
                        }
                    }
                }
            }
            return asset;
        });
    }
};
