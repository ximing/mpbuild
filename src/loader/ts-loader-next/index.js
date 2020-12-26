/**
 * Created by ximing on 2019-03-27.
 */
const gulp = require('gulp');
const ts = require('gulp-typescript');
const through = require('through2');
const plumber = require('gulp-plumber');
const { default: PQueue } = require('p-queue');

const queue = new PQueue({ concurrency: 1 });

// const tsCompileQStream = require('./gulp-typescript-compile-queue');

module.exports = function (opts = {}) {
    const tsProject = ts.createProject('tsconfig.json');
    return async function (asset) {
        // Solution to "Error: gulp-typescript: A project cannot be used in two compilations * at the same time. Create multiple projects with createProject instead."  https://gist.github.com/smac89/49f3b076cd987e0875ba9bfb3fe81ef9 not work
        let errorCount = 0,
            file;
        asset.contents = await queue.add(
            () =>
                new Promise((res) => {
                    gulp.src(asset.path)
                        .pipe(
                            plumber({
                                errorHandler() {
                                    errorCount += 1;
                                    console.log('[ts-loader-error] file is: ', asset.path);
                                },
                            })
                        )
                        .pipe(tsProject())
                        .js.pipe(
                            through.obj((f, encoding, callback) => {
                                file = f;
                                callback(null, file);
                            })
                        )
                        .on('finish', () => {
                            if (errorCount) {
                                res(null);
                            } else {
                                res(file.contents.toString());
                            }
                        });
                })
        );
        const [outputPrefix] = this.helper.splitExtension(asset.outputFilePath);
        asset.outputFilePath = `${outputPrefix}.js`;
        if (errorCount) {
            this.breakLoaderPipeline(asset);
        }
        return asset;
    };
};
// let contents = await new Promise((res, rej) => {
//     let errorCount = 0,
//         file;
//     const tsResult = gulp
//         .src(asset.path)
//         .pipe(
//             plumber({
//                 errorHandler() {
//                     errorCount += 1;
//                     console.log('[ts-loader-error] file is: ', asset.path);
//                 }
//             })
//         )
//         .pipe(tsCompileQStream(tsProject));
//     tsResult.js
//         .pipe(
//             through.obj((f, encoding, callback) => {
//                 if (!f) {
//                     console.log(asset.path);
//                 }
//                 file = f;
//                 console.log('asset1', asset.path);
//                 callback(null, file);
//             })
//         )
//         .on('finish', () => {
//             if (errorCount) {
//                 console.log('()()()=>', asset.path);
//                 res(null);
//             } else {
//                 if (!file) {
//                     console.log('asset', asset.path);
//                     return res(null);
//                 }
//                 res(file.contents.toString());
//             }
//         });
// });
