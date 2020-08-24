/**
 * Created by ximing on 2019-03-18.
 */
const path = require('path');
const imagemin = require('imagemin');
const chokidar = require('chokidar');
const fs = require('fs-extra');
const imageminJpegtran = require('@yeanzhi/imagemin-jpegtran');
const imageminPngquant = require('@yeanzhi/imagemin-pngquant');

let inited = false;

const minImage = (srcFile, dest) => {
    imagemin([srcFile], dest, {
        plugins: [
            imageminJpegtran(),
            imageminPngquant({
                quality: [0.6, 0.8],
            }),
        ],
    });
};

module.exports = class CopyImagePlugin {
    constructor(options) {
        this.name = 'CopyImagePlugin';
        this.options = {
            
            srcFiles: {},
                output: '',
            ...options
        };
        if (!this.options.output) {
            throw new Error('[CopyImagePlugin] output required');
        }
    }

    replaceFilepath(filepath) {
        return filepath.replace(`${this.options.watchPath}/`, '');
    }

    apply(mpb) {
        console.log('Apply CopyImagePlugin');
        mpb.hooks.afterCompile.tapPromise('AppJSON', async () => {
            if (!mpb.hasInit) {
                await Promise.all(
                    Object.keys(this.options.srcFiles).map((srcFile) => {
                        return minImage(
                            srcFile,
                            path.join(
                                this.options.output,
                                path.dirname(this.options.srcFiles[srcFile])
                            )
                        );
                    })
                );
            }

            if (mpb.isWatch && !inited) {
                inited = true;
                const watcher = chokidar.watch(this.options.watchPath, {
                    ignoreInitial: true,
                    usePolling: true,
                    interval: 500,
                });

                watcher.on('add', async (filepath) => {
                    console.log(`[copy-image-plugin]: add ${filepath}`);
                    minImage(
                        filepath,
                        path.join(this.options.output, path.dirname(this.replaceFilepath(filepath)))
                    );
                });

                watcher.on('unlink', async (filepath) => {
                    console.log(`[copy-image-plugin]: delete ${filepath}`);
                    fs.removeSync(path.join(this.options.output, this.replaceFilepath(filepath)));
                });
            }
        });
    }
};
