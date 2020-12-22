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

const resolve = require('../resolve');

module.exports = class HandleJSDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        mpb.hooks.beforeEmitFile.tapPromise('HandleJSDep', async (asset) => {
            const deps = [];
            try {
                if (/\.(js|wxs)$/.test(asset.outputFilePath) && asset.contents) {
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
                                        const lib = node.arguments[0].value;
                                        let libPath;
                                        const resolveRes = mpb.hooks.resolveJS.call({ lib, asset });
                                        if (!resolveRes) {
                                            return;
                                        }
                                        libPath = resolve(
                                            resolveRes.lib,
                                            asset,
                                            mpb.exts.js,
                                            mpb.src,
                                            mpb.config.alias
                                        );
                                        const root = asset.getMeta('root');
                                        const isNPM = libPath.includes('node_modules');
                                        let libOutputPath = this.mainPkgPathMap[libPath];
                                        if (!libOutputPath) {
                                            if (isNPM) {
                                                libOutputPath = path.join(
                                                    mpb.dest,
                                                    `./${root || ''}`,
                                                    path
                                                        .relative(mpb.cwd, libPath)
                                                        .replace(
                                                            /node_modules/g,
                                                            mpb.config.output.npm
                                                        )
                                                );
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
                                            const [libOutputPathPrefix] = mpb.helper.splitExtension(
                                                libOutputPath
                                            );
                                            libOutputPath = `${libOutputPathPrefix}.js`;
                                        }
                                        // JSON 被直接替换
                                        if (libOutputPath.endsWith('.json')) {
                                            // const [libOutputPathPrefix] = mpb.helper.splitExtension(
                                            //     libOutputPath
                                            // );
                                            // libOutputPath = `${libOutputPathPrefix}.js`;
                                            parent.init = template.ast(
                                                `(${fs.readFileSync(libPath, 'utf-8')})`
                                            );
                                        } else {
                                            node.arguments[0].value = path.relative(
                                                path.parse(asset.outputFilePath).dir,
                                                libOutputPath
                                            );
                                            if (node.arguments[0].value[0] !== '.') {
                                                node.arguments[0].value = `./${node.arguments[0].value}`;
                                            }
                                            deps.push({
                                                libPath,
                                                libOutputPath
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    });
                    asset.contents = generate(ast, {
                        quotes: 'single',
                        retainLines: true
                    }).code;
                }
            } catch (e) {
                console.error('[handleJSDep parse error]', e, asset.path, asset.outputFilePath);
            }
            if (deps.length) {
                try {
                    await Promise.all(
                        deps.map((dep) => {
                            const { libPath, libOutputPath } = dep;
                            const root = asset.getMeta('root');
                            return mpb.assetManager.addAsset(libPath, libOutputPath, {
                                root,
                                source: asset.filePath
                            });
                        })
                    );
                } catch (e) {
                    console.error('[handleJSDep]', e);
                }
            }
            return asset;
        });
    }
};
