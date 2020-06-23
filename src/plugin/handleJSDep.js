/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const babylon = require('@babel/parser');
const t = require('@babel/types');
const babelTraverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const template = require('@babel/template').default;
const fs = require('fs');
const { rewriteNpm, getMatcher } = require('../util');

module.exports = class HandleJSDep {
    constructor() {
        this.name = 'HandleJSDep';
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        this.mpb = mpb;
        const manifestMatcher = getMatcher(mpb.extensions.manifest);
        const esMatcher = getMatcher(mpb.extensions.es);
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSDep', async (asset) => {
            const deps = [];
            try {
                if (
                    esMatcher.test(asset.path) &&
                    !manifestMatcher.test(asset.path) &&
                    asset.contents
                ) {
                    // if (/\.(js|jsx|wxs|ts|tsx)$/.test(asset.outputFilePath) && asset.contents) {
                    const code = asset.contents;
                    const ast = babylon.parse(code, { sourceType: 'module' });
                    babelTraverse(ast, {
                        Expression: {
                            enter: (astPath) => {
                                const { node, parent } = astPath;
                                if (
                                    node.type === 'CallExpression' &&
                                    node.callee.name === 'require'
                                ) {
                                    if (
                                        node.arguments &&
                                        node.arguments.length === 1 &&
                                        t.isStringLiteral(node.arguments[0])
                                    ) {
                                        const { imported: lib } = mpb.hooks.beforeResolve.call({
                                            imported: node.arguments[0].value,
                                            asset,
                                            resolveType: 'es',
                                        }) || { lib: node.arguments[0].value };
                                        // console.log('--->', lib, node.arguments[0].value,asset.path);
                                        const { imported: libPath } = mpb.hooks.resolve.call({
                                            imported: lib,
                                            asset,
                                            resolveType: 'es',
                                        });
                                        const root = asset.getMeta('root');
                                        const isNPM = libPath.includes('node_modules');
                                        let libOutputPath = this.mainPkgPathMap[libPath];
                                        if (!libOutputPath) {
                                            if (isNPM) {
                                                libOutputPath = rewriteNpm(libPath, root, mpb.dest);
                                            } else {
                                                libOutputPath = path.join(
                                                    mpb.dest,
                                                    `./${root || ''}`,
                                                    path.relative(mpb.src, libPath)
                                                );
                                            }

                                            if (!root) {
                                                this.mainPkgPathMap[libPath] = libOutputPath;
                                            }
                                        }

                                        // TODO How to handle renamed files more gracefully
                                        if (
                                            libOutputPath.endsWith('.ts') ||
                                            libOutputPath.endsWith('.jsx') ||
                                            libOutputPath.endsWith('.tsx')
                                        ) {
                                            const [
                                                libOutputPathPrefix,
                                                ext,
                                            ] = mpb.helper.splitExtension(libOutputPath);
                                            libOutputPath = `${libOutputPathPrefix}.${
                                                ext === 'wxs' ? ext : 'js'
                                            }`;
                                        }
                                        // JSON 被直接替换
                                        if (libOutputPath.endsWith('.json')) {
                                            // const [libOutputPathPrefix] = mpb.helper.splitExtension(
                                            //     libOutputPath
                                            // );
                                            // libOutputPath = `${libOutputPathPrefix}.js`;
                                            parent.right = template.ast(
                                                `(${fs.readFileSync(libPath, 'utf-8')})`
                                            );
                                        } else {
                                            const {
                                                importedDest: destPath,
                                            } = mpb.hooks.reWriteImported.call({
                                                importedSrc: libPath,
                                                importedDest: libOutputPath,
                                                asset,
                                                resolveType: 'es',
                                            });
                                            node.arguments[0].value = destPath;
                                            // node.arguments[0].value = path.relative(
                                            //     path.parse(asset.outputFilePath).dir,
                                            //     libOutputPath
                                            // );
                                            // if (node.arguments[0].value[0] !== '.') {
                                            //     node.arguments[0].value = `./${node.arguments[0].value}`;
                                            // }
                                            deps.push({
                                                libPath,
                                                libOutputPath,
                                            });
                                        }
                                    }
                                }
                            },
                        },
                    });
                    const [outputPrefix, ext] = mpb.helper.splitExtension(asset.outputFilePath);
                    asset.outputFilePath = `${outputPrefix}.${ext === 'wxs' ? ext : 'js'}`;
                    asset.contents = generate(ast, {
                        quotes: 'single',
                        retainLines: true,
                    }).code;
                }
            } catch (e) {
                console.error('[handleJSDep parse error]', e, asset.path);
            }
            if (deps.length) {
                try {
                    // console.log('before', asset.path);
                    for (let i = 0, l = deps.length; i < l; i++) {
                        const { libPath, libOutputPath } = deps[i];
                        const root = asset.getMeta('root');
                        await mpb.assetManager.addAsset(libPath, libOutputPath, {
                            root,
                            source: asset.filePath,
                        });
                    }
                    // await Promise.all(
                    //     deps.map((dep) => {
                    //         const { libPath, libOutputPath } = dep;
                    //         const root = asset.getMeta('root');
                    //         return mpb.assetManager.addAsset(libPath, libOutputPath, {
                    //             root,
                    //             source: asset.filePath
                    //         });
                    //     })
                    // );
                    // console.log('after deps', asset.path);
                } catch (e) {
                    console.error('[handleJSDep]', e);
                }
            }
            return asset;
        });
    }
};
