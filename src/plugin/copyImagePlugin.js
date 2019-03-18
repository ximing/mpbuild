/**
 * Created by ximing on 2019-03-18.
 */
const imagemin = require('imagemin');
const path = require('path');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');

module.exports = class CopyImagePlugin {
    constructor(options) {
        this.options = Object.assign(
            {},
            {
                srcFiles: {},
                output: ''
            },
            options
        );
        if (!this.options.output) {
            throw new Error('[CopyImagePlugin] output required');
        }
    }

    apply(mpb) {
        mpb.hooks.afterCompile.tapPromise('AppJSON', async () => {
            await Promise.all(
                Object.keys(this.options.srcFiles).map((srcFile) => {
                    return imagemin(
                        [srcFile],
                        path.join(
                            this.options.output,
                            path.dirname(this.options.srcFiles[srcFile])
                        ),
                        {
                            plugins: [
                                imageminJpegtran(),
                                imageminPngquant({
                                    quality: [0.6, 0.8]
                                })
                            ]
                        }
                    );
                })
            );
        });
    }
};
