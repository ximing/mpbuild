/**
 * Created by ximing on 2019-03-18.
 */
const UglifyJS = require('uglify-js');
const jsonminify = require('jsonminify');
const htmlmin = require('html-minifier');

module.exports = class MinifyPlugin {
    apply(mpb) {
        if (mpb.optimization.minimize) {
            mpb.hooks.beforeEmitFile.tapPromise('MinifyPlugin', async (asset) => {
                if (asset.contents) {
                    if (/\.js$/.test(asset.outputFilePath)) {
                        const result = UglifyJS.minify(asset.contents);
                        if (result.error) console.error('[MinifyPlugin]', result.error);
                        if (result.warnings) console.warn('[MinifyPlugin]', result.warnings);
                        asset.contents = result.code;
                    } else if (/\.json$/.test(asset.outputFilePath)) {
                        asset.contents = jsonminify(asset.contents).toString();
                    } else if (/\.wxml$/.test(asset.outputFilePath)) {
                        asset.contents = asset.contents = htmlmin.minify(asset.contents, {
                            removeComments: true,
                            keepClosingSlash: true,
                            collapseWhitespace: true,
                            caseSensitive: true
                        });
                    }
                }
                return Promise.resolve();
            });
        }
    }
};
