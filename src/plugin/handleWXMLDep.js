/**
 * Created by ximing on 2019-03-15.
 */
const htmlparser = require('htmlparser2');
const path = require('path');

module.exports = class HandleWXMLDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleWXMLDep', async (asset) => {
            if (/\.wxml$/.test(asset.name)) {
                try {
                    const deps = [];
                    await new Promise((resolve, reject) => {
                        const parser = new htmlparser.Parser(
                            {
                                onopentag(name, attribs) {
                                    if (name === 'import' && attribs.src) {
                                        deps.push(attribs.src);
                                    } else if (name === 'include' && attribs.src) {
                                        deps.push(attribs.src);
                                    } else if (name === 'wxs' && attribs.src) {
                                        deps.push(attribs.src);
                                    }
                                },
                                onerror(error) {
                                    reject(error);
                                },
                                onend() {
                                    resolve();
                                }
                            },
                            { decodeEntities: true }
                        );
                        parser.write(asset.contents);
                        parser.end();
                    });
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
                            let outputPath = path.resolve(mpb.dest, path.relative(mpb.src, filePath));

                            if(filePath.includes('node_modules')) {
                                outputPath = this.mainPkgPathMap[filePath];
                                if(!outputPath) {
                                    outputPath = path.join(
                                        mpb.dest,
                                        `./${root}`,
                                        path
                                            .relative(mpb.cwd, filePath)
                                            .replace('node_modules', mpb.config.output.npm)
                                    );
                                    if(!root) {
                                        this.mainPkgPathMap[filePath] = outputPath;
                                    }
                                }
                            };

                            return mpb.assetManager.addAsset(
                                filePath,
                                outputPath,
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
            }
            return asset;
        });
    }
};