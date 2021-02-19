/**
 * Created by ximing on 2019-03-18.
 */
const path = require('path');
const imagemin = require('imagemin');
const imageminJpegtran = require('@yeanzhi/imagemin-jpegtran');
const imageminPngquant = require('@yeanzhi/imagemin-pngquant');

module.exports = class CopyImagePlugin {
    constructor(options) {
        this.options = {
            srcFiles: {},
            output: '',
            ...options,
        };
        if (!this.options.output) {
            throw new Error('[CopyImagePlugin] output required');
        }
    }

    apply(mpb) {
        mpb.hooks.afterCompile.tapPromise('AppJSON', async () => {
            // TODO 这里需要 看下 watch下怎么监听 images目录的更改
            if (!mpb.hasInit) {
                await Promise.all(
                    Object.keys(this.options.srcFiles).map((srcFile) =>
                        imagemin(
                            [srcFile],
                            path.join(
                                this.options.output,
                                path.dirname(this.options.srcFiles[srcFile])
                            ),
                            {
                                plugins: [
                                    imageminJpegtran(),
                                    imageminPngquant({
                                        quality: [0.6, 0.8],
                                    }),
                                ],
                            }
                        )
                    )
                );
            }
        });
    }
};
