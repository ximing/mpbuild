/**
 * Created by ximing on 2019-03-18.
 */
// const UglifyJS = require('uglify-js');
// const jsonminify = require('jsonminify');
// const htmlmin = require('html-minifier');
const workerpool = require('workerpool');

const pool = workerpool.pool();

function minifyJS(contents) {
    const UglifyJS = require('uglify-js');
    const result = UglifyJS.minify(contents);
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
        caseSensitive: true
    });
}

function minifyJSON(contents) {
    const jsonminify = require('jsonminify');
    return jsonminify(contents).toString();
}

module.exports = class MinifyPlugin {
    constructor() {
        this.js = true;
        this.wxml = true;
        this.json = true;
    }

    apply(mpb) {
        if (mpb.optimization.minimize) {
            if (typeof mpb.optimization.minimize === 'object') {
                this.js = mpb.optimization.minimize.js;
                this.wxml = mpb.optimization.minimize.wxml;
                this.json = mpb.optimization.minimize.json;
            } else if (mpb.optimization.minimize === false) {
                this.js = false;
                this.wxml = false;
                this.json = false;
            }
            mpb.hooks.beforeEmitFile.tapPromise('MinifyPlugin', async (asset) => {
                if (asset.contents) {
                    if (/\.js$/.test(asset.outputFilePath) && this.js) {
                        // const result = UglifyJS.minify(asset.contents);
                        // if (result.error) console.error('[MinifyPlugin]', result.error);
                        // if (result.warnings) console.warn('[MinifyPlugin]', result.warnings);
                        // asset.contents = result.code;
                        asset.contents = await pool.exec(minifyJS, [asset.contents]);
                    } else if (/\.json$/.test(asset.outputFilePath) && this.json) {
                        // asset.contents = jsonminify(asset.contents).toString();
                        asset.contents = await pool.exec(minifyJSON, [asset.contents]);
                    } else if (/\.wxml$/.test(asset.outputFilePath) && this.wxml) {
                        // asset.contents = asset.contents = htmlmin.minify(asset.contents, {
                        //     removeComments: true,
                        //     keepClosingSlash: true,
                        //     collapseWhitespace: true,
                        //     caseSensitive: true
                        // });
                        asset.contents = await pool.exec(minifyWXML, [asset.contents]);
                    }
                }
                return Promise.resolve();
            });
            mpb.hooks.afterCompile.tapPromise('MinifyPlugin', async () => {
                if (!mpb.isWatch) {
                    console.log(pool.stats());
                    pool.terminate(true);
                }
            });
        }
    }
};
