/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const babylon = require('@babel/parser');
const t = require('@babel/types');
const babelTraverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const template = require('@babel/template').default;
const bresolve = require('browser-resolve');
const resolve = require('resolve');
const fs = require('fs');

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
                                        if (lib[0] === '.') {
                                            try {
                                                libPath = resolve.sync(path.join(asset.dir, lib));
                                            } catch (e) {
                                                try {
                                                    libPath = resolve.sync(
                                                        path.join(asset.dir, `${lib}.ts`)
                                                    );
                                                } catch (e) {
                                                    libPath = resolve.sync(
                                                        path.join(asset.dir, `${lib}.tsx`)
                                                    );
                                                }
                                            }
                                        } else if (lib[0] === '/') {
                                            libPath = lib;
                                        } else {
                                            try {
                                                // 先找相对路径
                                                libPath = resolve.sync(path.join(asset.dir, lib));
                                            } catch (e) {
                                                // 尝试寻找当前项目node_modules文件夹下是否存在
                                                try {
                                                    libPath = bresolve.sync(lib, {
                                                        basedir: process.cwd()
                                                    });
                                                } catch (e) {
                                                } finally {
                                                    // 如果不存在就去从当前npm包位置开始向上查找
                                                    if (
                                                        !(
                                                            libPath &&
                                                            libPath.startsWith(process.cwd())
                                                        )
                                                    ) {
                                                        libPath = bresolve.sync(lib, {
                                                            basedir: asset.dir,
                                                            filename: asset.path
                                                        });
                                                    }
                                                }
                                            }
                                        }

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
                                            parent.right = template.ast(
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
                console.error('[handleJSDep parse error]', e, asset.path);
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
