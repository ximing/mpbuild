/**
 * Created by ximing on 2019-03-18.
 */
// const UglifyJS = require('uglify-js');
// const jsonminify = require('jsonminify');
// const htmlmin = require('html-minifier');
const workerpool = require('workerpool');
const mm = require('micromatch');
const crypto = require('crypto');
const path = require('path');

const pool = workerpool.pool();

function clearPool() {
    const timmer = setInterval(() => {
        const poolStats = pool.stats();
        console.log(poolStats);
        if (poolStats.busyWorkers === 0) {
            pool.terminate(true);
            clearInterval(timmer);
        }
    }, 1000);
}

function minifyJS(contents, options) {
    const UglifyJS = require('uglify-js');
    if (options && options.output && options.output.comments) {
        const { comments } = options.output;
        if (comments !== 'all' && comments !== 'some' && typeof comments !== 'boolean') {
            options.output.comments = /javascript-obfuscator:disable|javascript-obfuscator:enable/;
        }
    }
    const result = UglifyJS.minify(contents, typeof options === 'undefined' ? undefined : options);
    if (result.error) {
        console.error('[MinifyPlugin]', result.error);
        throw result.error;
    }
    if (result.warnings) console.warn('[MinifyPlugin]', result.warnings);
    return result.code;
}

function minifyWXML(contents) {
    const htmlmin = require('html-minifier');
    return htmlmin.minify(contents, {
        removeComments: true,
        keepClosingSlash: true,
        collapseWhitespace: true,
        caseSensitive: true,
    });
}

function minifyWXS(contents) {
    const babylon = require('@babel/parser');
    const generate = require('@babel/generator').default;
    const code = contents;
    const ast = babylon.parse(code, { sourceType: 'module' });
    return generate(ast, {
        quotes: 'single',
        minified: true,
        comments: false,
        jsescOption: {
            minimal: true,
        },
    }).code;
}

function minifyJSON(contents) {
    const jsonminify = require('jsonminify');
    return jsonminify(contents).toString();
}

function sholdRunMiniFunc(asset, rule) {
    if (!rule) {
        return false;
    }
    if (typeof rule === 'boolean' && rule) {
        return true;
    }
    if (Object.prototype.toString.call(rule) === '[object Object]') {
        const { include, exclude } = rule || {};
        let sholdRunMini = true;
        if (Array.isArray(exclude)) {
            sholdRunMini = !mm.any(asset.path, exclude);
            if (!sholdRunMini && Array.isArray(include)) {
                sholdRunMini = mm.any(asset.path, include);
            }
        }
        return sholdRunMini;
    }
    return false;
}

module.exports = class MinifyPlugin {
    constructor() {
        this.js = true;
        this.wxml = true;
        this.json = true;
        this.wxs = true;
        this.pool = true;
        this.hashDigestLength = 4;
        this.usedIds = new Set();
        this.dirIdMap = new Map();
    }

    apply(mpb) {
        if (mpb.optimization.minimize) {
            if (typeof mpb.optimization.minimize === 'object') {
                this.js = mpb.optimization.minimize.js;
                this.wxml = mpb.optimization.minimize.wxml;
                this.json = mpb.optimization.minimize.json;
                this.wxs = mpb.optimization.minimize.wxs;
                this.path = mpb.optimization.minimize.path;
                this.pool =
                    mpb.optimization.minimize.pool == null ? true : mpb.optimization.minimize.pool;
            } else if (mpb.optimization.minimize === false) {
                this.js = false;
                this.wxml = false;
                this.json = false;
                this.wxs = false;
                this.path = false;
            }
            if (this.path) {
                mpb.hooks.rewriteOutputPath.tap('rewriteOutputPath', (opt) => {
                    const { asset, outputPath } = opt;
                    if (outputPath) {
                        if (typeof this.path === 'function') {
                            this.path(opt);
                        } else {
                            const { base, dir } = path.parse(outputPath);
                            const targetPath = dir.replace(mpb.dest, '');
                            if (!this.dirIdMap.get(targetPath)) {
                                const hashId = crypto
                                    .createHash('sha256')
                                    .update(targetPath)
                                    .digest('hex');
                                let len = this.hashDigestLength;
                                while (this.usedIds.has(hashId.substr(0, len))) len++;
                                const hashValue = hashId.substr(0, len);
                                this.usedIds.add(hashValue);
                                this.dirIdMap.set(targetPath, hashValue);
                            }
                            const root = asset.getMeta('root');
                            opt.outputPath = path.join(
                                mpb.dest,
                                `./${root || ''}`,
                                this.dirIdMap.get(targetPath),
                                base
                            );
                        }
                    }
                    return opt;
                });
            }
            mpb.hooks.beforeEmitFile.tapPromise('MinifyPlugin', async (asset) => {
                if (asset.contents) {
                    if (/\.js$/.test(asset.outputFilePath) && this.js) {
                        if (this.pool) {
                            asset.contents = await pool.exec(minifyJS, [asset.contents, this.js]);
                        } else {
                            asset.contents = await minifyJS(asset.contents, this.js);
                        }
                    } else if (
                        /\.json$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.json)
                    ) {
                        if (this.pool) {
                            asset.contents = await pool.exec(minifyJSON, [asset.contents]);
                        } else {
                            asset.contents = await minifyJSON(asset.contents);
                        }
                    } else if (
                        /\.wxml$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.wxml)
                    ) {
                        if (this.pool) {
                            asset.contents = await pool.exec(minifyWXML, [asset.contents]);
                        } else {
                            asset.contents = await minifyWXML(asset.contents);
                        }
                    } else if (
                        /\.wxs$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.wxs)
                    ) {
                        if (this.pool) {
                            asset.contents = await pool.exec(minifyWXS, [asset.contents]);
                        } else {
                            asset.contents = await minifyWXS(asset.contents);
                        }
                    }
                }
                return Promise.resolve();
            });
            mpb.hooks.afterCompile.tapPromise('MinifyPlugin', async () => {
                if (!mpb.isWatch) {
                    if (this.pool) {
                        clearPool();
                    }
                }
            });
        }
    }
};
