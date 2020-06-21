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
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSONComponentDep', async (asset) => {
            // const key = asset.getMeta('mbp-scan-json-dep');
            // TODO 并不是所有JSON都要进行这个判定的，先通过usingComponents这个key来判定是否是依赖，但是有点硬核，后面想下有没有更好的办法，上面通过 meta的方式也不行，主要是在watch的时候如何对新的asset设置meta
            if (mpb.extensions.manifest.includes(asset.ext) && asset.contents) {
                // if (/\.json$/.test(asset.outputFilePath) && asset.contents) {
                const code = JSON.parse(asset.contents);
                if (code.usingComponents) {
                    const componets = code.usingComponents;
                    if (componets) {
                        // TODO 这里需要支持 alias
                        await Promise.all(
                            Object.keys(componets).map(async (componentName) => {
                                // let filePath = '',
                                //     src = componets[componentName];
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
                                const { imported: lib } = mpb.hooks.beforeResolve.call({
                                    imported: componets[componentName],
                                    asset,
                                    resolveType: 'manifest'
                                });
                                let { imported: filePath } = mpb.hooks.resolve.call({
                                    imported: lib,
                                    asset,
                                    resolveType: 'manifest'
                                });
                                const file = path.parse(filePath);
                                if (file.ext) {
                                    filePath = `${file.dir}/${file.name}`;
                                }
                                const nmPathIndex = filePath.indexOf(NPM_PATH_NAME);
                                const root = asset.getMeta('root');
                                let outputPath = this.mainPkgPathMap[filePath];
                                if (!outputPath) {
                                    if (~nmPathIndex) {
                                        // outputPath = path.join(
                                        //     mpb.dest,
                                        //     `./${root || ''}`,
                                        //     path
                                        //         .relative(mpb.cwd, filePath)
                                        //         .replace('node_modules', mpb.config.output.npm)
                                        // );
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
                                const { importedDest: destPath } = mpb.hooks.reWriteImported.call({
                                    importedSrc: filePath,
                                    importedDest: outputPath,
                                    asset,
                                    resolveType: 'manifest'
                                });
                                componets[componentName] = destPath;
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
