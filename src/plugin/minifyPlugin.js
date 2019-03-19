/**
 * Created by ximing on 2019-03-18.
 */
// const UglifyJS = require('uglify-js');
// const jsonminify = require('jsonminify');
// const htmlmin = require('html-minifier');
const workerpool = require('workerpool');

const pool = workerpool.pool();

function minify(contents, outputFilePath) {
    const UglifyJS = require('uglify-js');
    const jsonminify = require('jsonminify');
    const htmlmin = require('html-minifier');
    if (/\.js$/.test(outputFilePath)) {
        const result = UglifyJS.minify(contents);
        if (result.error) console.error('[MinifyPlugin]', result.error);
        if (result.warnings) console.warn('[MinifyPlugin]', result.warnings);
        return result.code;
    }
    if (/\.json$/.test(outputFilePath)) {
        return jsonminify(contents).toString();
    }
    if (/\.wxml$/.test(outputFilePath)) {
        return htmlmin.minify(contents, {
            removeComments: true,
            keepClosingSlash: true,
            collapseWhitespace: true,
            caseSensitive: true
        });
    }
}

module.exports = class MinifyPlugin {
    apply(mpb) {
        if (mpb.optimization.minimize) {
            mpb.hooks.beforeEmitFile.tapPromise('MinifyPlugin', async (asset) => {
                if (asset.contents) {
                    asset.contents = await pool.exec(minify, [
                        asset.contents,
                        asset.outputFilePath
                    ]);
                }
                return Promise.resolve();
            });
        }
    }
};
