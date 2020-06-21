/**
 * Created by ximing on 2019-03-15.
 */
const postcss = require('postcss');
const path = require('path');
const fs = require('fs');
const resolve = require('resolve');
const { rewriteNpm } = require('../util');

module.exports = class HandleWXSSDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleWXSSDep', async (asset) => {
            // if (/\.wxss$/.test(asset.name)) {
            if (mpb.extensions.style.includes(asset.ext) && asset.contents) {
                const deps = [];
                const distDeps = [];
                try {
                    const root = postcss.parse(asset.contents);
                    root.walkAtRules('import', (rule) => {
                        const libPath = rule.params.replace(/'|"/g, '');
                        deps.push(libPath);
                    });
                    try {
                        await Promise.all(
                            deps.map((src) => {
                                // let filePath = '';
                                // if (src[0] === '/') {
                                //     filePath = path.resolve(mpb.src, `.${src}`);
                                // } else if (src[0] === '.') {
                                //     filePath = path.resolve(asset.dir, src);
                                // } else {
                                //     filePath = path.resolve(asset.dir, `./${src}`);
                                //
                                //     if (!fs.existsSync(filePath)) {
                                //         filePath = resolve.sync(src, {
                                //             basedir: mpb.cwd,
                                //             extensions: ['.wxss']
                                //         });
                                //     }
                                // }
                                const { imported: lib } = mpb.hooks.beforeResolve.call({
                                    imported: src,
                                    asset,
                                    resolveType: 'style'
                                });
                                const { imported: filePath } = mpb.hooks.resolve.call({
                                    imported: lib,
                                    asset,
                                    resolveType: 'style'
                                });
                                const root = asset.getMeta('root');
                                let outputPath = this.mainPkgPathMap[filePath];
                                if (!outputPath) {
                                    if (filePath.includes('node_modules')) {
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
                                }
                                distDeps.push(outputPath);
                                return mpb.assetManager.addAsset(filePath, outputPath, {
                                    root,
                                    source: asset.filePath
                                });
                            })
                        );
                        let index = 0;
                        root.walkAtRules('import', (rule) => {
                            const libPath = rule.params.replace(/'|"/g, '');
                            const { importedDest: filePath } = mpb.hooks.reWriteImported.call({
                                importedSrc: libPath,
                                importedDest: distDeps[index],
                                asset,
                                resolveType: 'style'
                            });
                            rule.params = JSON.stringify(filePath);
                            index++;
                        });
                        asset.contents = root.toString();
                    } catch (e) {
                        console.error(e);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            return asset;
        });
    }
};
