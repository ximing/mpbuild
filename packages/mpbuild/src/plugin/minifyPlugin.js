/**
 * Created by ximing on 2019-03-18.
 */
// const UglifyJS = require('uglify-js');
// const jsonminify = require('jsonminify');
// const htmlmin = require('html-minifier');
const workerpool = require('workerpool');
const mm = require('micromatch');

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
    }

    apply(mpb) {
        if (mpb.optimization.minimize) {
            if (typeof mpb.optimization.minimize === 'object') {
                this.js = mpb.optimization.minimize.js;
                this.wxml = mpb.optimization.minimize.wxml;
                this.json = mpb.optimization.minimize.json;
                this.wxs = mpb.optimization.minimize.wxs;
            } else if (mpb.optimization.minimize === false) {
                this.js = false;
                this.wxml = false;
                this.json = false;
                this.wxs = false;
            }
            mpb.hooks.beforeEmitFile.tapPromise('MinifyPlugin', async (asset) => {
                if (asset.contents) {
                    if (/\.js$/.test(asset.outputFilePath) && this.js) {
                        // const result = UglifyJS.minify(asset.contents);
                        // if (result.error) console.error('[MinifyPlugin]', result.error);
                        // if (result.warnings) console.warn('[MinifyPlugin]', result.warnings);
                        // asset.contents = result.code;
                        asset.contents = await pool.exec(minifyJS, [asset.contents, this.js]);
                    } else if (
                        /\.json$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.json)
                    ) {
                        // asset.contents = jsonminify(asset.contents).toString();
                        asset.contents = await pool.exec(minifyJSON, [asset.contents]);
                    } else if (
                        /\.wxml$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.wxml)
                    ) {
                        // asset.contents = asset.contents = htmlmin.minify(asset.contents, {
                        //     removeComments: true,
                        //     keepClosingSlash: true,
                        //     collapseWhitespace: true,
                        //     caseSensitive: true
                        // });
                        asset.contents = await pool.exec(minifyWXML, [asset.contents]);
                    } else if (
                        /\.wxs$/.test(asset.outputFilePath) &&
                        sholdRunMiniFunc(asset, this.wxs)
                    ) {
                        asset.contents = await pool.exec(minifyWXS, [asset.contents]);
                    }
                }
                return Promise.resolve();
            });
            mpb.hooks.afterCompile.tapPromise('MinifyPlugin', async () => {
                if (!mpb.isWatch) {
                    clearPool();
                }
            });
        }
    }
};
