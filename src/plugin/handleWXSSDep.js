/**
 * Created by ximing on 2019-03-15.
 */
const postcss = require('postcss');
const path = require('path');

module.exports = class HandleWXSSDep {
    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleWXSSDep', async (asset) => {
            if (/\.wxss$/.test(asset.name)) {
                const deps = [];
                try {
                    const root = postcss.parse(asset.contents);
                    root.walkAtRules('import', (rule) => {
                        const libPath = rule.params.replace(/'|"/g, '');
                        deps.push(libPath);
                    });
                    try {
                        await Promise.all(
                            deps.map((src) => {
                                let filePath = '';
                                if (src[0] === '/') {
                                    filePath = path.resolve(mpb.src, `.${src}`);
                                } else if (src[0] === '.') {
                                    filePath = path.resolve(asset.dir, src);
                                } else {
                                    filePath = path.resolve(asset.dir, `./${src}`);
                                }
                                const root = asset.getMeta('root');
                                return mpb.assetManager.addAsset(
                                    filePath,
                                    path.resolve(mpb.dest, path.relative(mpb.src, filePath)),
                                    {
                                        root,
                                        source: asset.filePath
                                    }
                                );
                            })
                        );
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