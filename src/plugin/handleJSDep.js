/**
 * Created by ximing on 2019-03-15.
 */
const path = require('path');
const babylon = require('@babel/parser');
const t = require('@babel/types');
const babelTraverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const bresolve = require('browser-resolve');
const resolve = require('resolve');

module.exports = class HandleJSDep {
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
                                const { node } = astPath;
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
                                                libPath = resolve.sync(
                                                    path.join(asset.dir, `${lib}.ts`)
                                                );
                                            }
                                        } else if (lib[0] === '/') {
                                            libPath = lib;
                                        } else {
                                            try {
                                                libPath = resolve.sync(path.join(asset.dir, lib));
                                            } catch (e) {
                                                libPath = bresolve.sync(lib, {
                                                    basedir: mpb.src
                                                });
                                            }
                                        }
                                        // TODO 先不考虑一层一层往上的情况，项目级别的node_modules
                                        const isNPM = libPath.includes('node_modules');
                                        let libOutputPath;
                                        if (isNPM) {
                                            // npmPlugin.call(this, libFile, config, enc);
                                            libOutputPath = path.join(
                                                mpb.dest,
                                                path
                                                    .relative(mpb.cwd, libPath)
                                                    .replace('node_modules', mpb.config.output.npm)
                                            );
                                        } else {
                                            libOutputPath = path.join(
                                                mpb.dest,
                                                path.relative(mpb.src, libPath)
                                            );
                                        }
                                        // TODO How to handle renamed files more gracefully
                                        if (libOutputPath.endsWith('.ts')) {
                                            const [libOutputPathPrefix] = mpb.helper.splitExtension(
                                                libOutputPath
                                            );
                                            libOutputPath = `${libOutputPathPrefix}.js`;
                                        }
                                        node.arguments[0].value = path.relative(
                                            path.parse(asset.outputFilePath).dir,
                                            libOutputPath
                                        );
                                        if (node.arguments[0].value[0] !== '.') {
                                            node.arguments[0].value = `./${
                                                node.arguments[0].value
                                            }`;
                                        }
                                        deps.push({
                                            libPath,
                                            libOutputPath
                                        });
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
                            return mpb.assetManager.addAsset(libPath, libOutputPath);
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
