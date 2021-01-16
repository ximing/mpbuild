/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const chalk = require('chalk');
const babylon = require('@babel/parser');
const t = require('@babel/types');
const babelTraverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const template = require('@babel/template').default;
const fs = require('fs');

module.exports = class HandleJSDep {
    constructor() {
        this.mainPkgPathMap = {};
    }

    apply(mpb) {
        const keys = Object.keys(mpb.config.alias || {});
        const alias = { keys, aliasMap: mpb.config.alias };
        this.exts = [...new Set(mpb.exts.js.concat(['.json', '.wxs']))];
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
                                        const resolveRes = mpb.hooks.resolveJS.call({ lib, asset });
                                        if (!resolveRes) {
                                            return;
                                        }
                                        const res = mpb.hooks.resolve.call({
                                            lib: resolveRes.lib,
                                            resolveLib: '',
                                            asset,
                                            resolveType: 'js',
                                            exts: this.exts,
                                        });
                                        const libPath = res.resolveLib;
                                        let {
                                            outputPath: libOutputPath,
                                            // eslint-disable-next-line prefer-const
                                            root,
                                        } = mpb.hooks.rewriteOutputPath.call({
                                            filePath: libPath,
                                            asset,
                                            depType: 'js',
                                        });
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
                                        }

                                        // TODO How to handle renamed files more gracefully
                                        if (libOutputPath.endsWith('.js')) {
                                            const {
                                                outputFileName,
                                                outputFileNum,
                                                name,
                                                noNum,
                                            } = mpb.hooks.resolveOutputJsPack.call({
                                                libOutputPath,
                                                root,
                                                asset,
                                            });
                                            node.arguments[0].value = outputFileName;
                                            node.callee.name = name;
                                            deps.push({
                                                libPath,
                                                libOutputPath,
                                                outputFileName,
                                                outputFileNum,
                                                noNum,
                                            });
                                        }
                                    }
                                }
                            },
                        },
                    });
                    asset.contents = generate(ast, {
                        quotes: 'single',
                        retainLines: true,
                    }).code;
                }
            } catch (e) {
                console.log(chalk.red('[handleJSDep parse error]'));
                console.log(chalk.red(asset.path, asset.outputFilePath));
                console.error(e);
            }
            if (deps.length) {
                try {
                    await Promise.all(
                        deps.map((dep) => {
                            const {
                                libPath,
                                libOutputPath,
                                outputFileName,
                                outputFileNum,
                                noNum,
                            } = dep;
                            const root = asset.getMeta('root');
                            return mpb.assetManager.addAsset(libPath, libOutputPath, {
                                root,
                                source: asset.filePath,
                                outputFileName,
                                outputFileNum,
                                noNum,
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
