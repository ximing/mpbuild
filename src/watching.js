// class Watching {
//     constructor(mpb, watchOptions, handler) {
//         this.mpb = mpb;
//         this.startTime = null;
//         this.invalid = false;
//         this.handler = handler;
//         this.callbacks = [];
//         this.closed = false;
//         if (typeof watchOptions === 'number') {
//             this.watchOptions = {
//                 aggregateTimeout: watchOptions
//             };
//         } else if (watchOptions && typeof watchOptions === 'object') {
//             this.watchOptions = Object.assign({}, watchOptions);
//         } else {
//             this.watchOptions = {};
//         }
//         this.watchOptions.aggregateTimeout = this.watchOptions.aggregateTimeout || 200;
//         this.running = true;
//     }

//     _done(err, compilation) {
//         this.running = false;
//         if (this.invalid) return this._go();

//         const stats = compilation ? this._getStats(compilation) : null;
//         if (err) {
//             this.compiler.applyPlugins('failed', err);
//             this.handler(err, stats);
//             return;
//         }

//         this.compiler.applyPlugins('done', stats);
//         this.handler(null, stats);
//         if (!this.closed) {
//             this.watch(
//                 compilation.fileDependencies,
//                 compilation.contextDependencies,
//                 compilation.missingDependencies
//             );
//         }
//         this.callbacks.forEach((cb) => cb());
//         this.callbacks.length = 0;
//     }

//     watch(files, dirs, missing) {
//         this.pausedWatcher = null;
//         this.watcher = this.compiler.watchFileSystem.watch(
//             files,
//             dirs,
//             missing,
//             this.startTime,
//             this.watchOptions,
//             (
//                 err,
//                 filesModified,
//                 contextModified,
//                 missingModified,
//                 fileTimestamps,
//                 contextTimestamps
//             ) => {
//                 this.pausedWatcher = this.watcher;
//                 this.watcher = null;
//                 if (err) return this.handler(err);

//                 this.mpb.fileTimestamps = fileTimestamps;
//                 this.mpb.contextTimestamps = contextTimestamps;
//                 this.invalidate();
//             },
//             (fileName, changeTime) => {
//                 this.mpb.applyPlugins('invalid', fileName, changeTime);
//             }
//         );
//     }

//     invalidate(callback) {
//         if (callback) {
//             this.callbacks.push(callback);
//         }
//         if (this.watcher) {
//             this.pausedWatcher = this.watcher;
//             this.watcher.pause();
//             this.watcher = null;
//         }
//         if (this.running) {
//             this.invalid = true;
//             return false;
//         }
//     }

//     close(callback) {
//         if (callback === undefined) callback = function() {};

//         this.closed = true;
//         if (this.watcher) {
//             this.watcher.close();
//             this.watcher = null;
//         }
//         if (this.pausedWatcher) {
//             this.pausedWatcher.close();
//             this.pausedWatcher = null;
//         }
//         if (this.running) {
//             this.invalid = true;
//             this._done = () => {
//                 this.compiler.applyPlugins('watch-close');
//                 callback();
//             };
//         } else {
//             this.compiler.applyPlugins('watch-close');
//             callback();
//         }
//     }
// }

// module.exports = Watching;

const chokidar = require('chokidar');
const _ = require('lodash');
const log = require('./log');

module.exports = class Watching {
    constructor(mpb, handle = () => {}) {
        this.mpb = mpb;
        this.files = [];
        this.pending = false;
        this.pendingPaths = [];
        this.handle = handle;
    }

    watch(missing) {
        const files = this.mpb.assetManager.getWatchFiles();
        if (this.watcher) {
            const addPaths = _.difference(files, this.files);
            if (addPaths.length) {
                this.watcher.add(addPaths);
            }
            const removePaths = _.difference(this.files, files);
            if (removePaths.length) {
                this.watcher.unwatch(removePaths);
            }
        } else {
            this.watcher = chokidar.watch(files, {
                ignored: missing,
                persistent: true,
                ignoreInitial: true
            });
            log.info('开启watching');
            this.watcher.on('add', (/* path */) => {
                // 不监听文件夹, 所有没有add事件
                // this.handleWatch(path, 'add');
            });
            this.watcher.on('change', (path) => {
                this.handleWatch(path, 'change');
            });
            this.watcher.on('unlink', (path) => {
                this.handleWatch(path, 'unlink');
            });
            this.watcher.on('error', (error) => {
                console.error('[watching]', error);
            });
        }
        this.files = files;
    }

    async handleAsset(path, type) {
        console.log('[handleAsset]', path, type);
        const asset = this.mpb.assetManager.getAsset(path);
        if (asset) {
            if (type === 'change') {
                await this.mpb.assetManager.addAsset(path, asset.outputFilePath);
            } else if (type === 'unlink') {
                await this.mpb.assetManager.delAsset(asset);
            } else {
                console.error('不支持的watch类型:', type);
            }
        } else {
            console.warn('[watching] 这里不应该 在assetManager里面找不到对应的文件');
        }
        const ps = this.pendingPaths;
        if (ps.length) {
            this.pendingPaths = [];
            await Promise.all(ps.map(({ path, type }) => this.handleAsset(path, type)));
        }
    }

    async handleWatch(path, type) {
        if (!this.pending) {
            try {
                this.pending = true;
                await this.handleAsset(path, type);
            } catch (err) {
                console.error('watching', err);
            }
            this.pending = false;
            await this.handle();
        } else {
            this.pendingPaths.push({
                path,
                type
            });
        }
        this.watch();
    }

    watchEntry(entry) {
        this.watcher = chokidar.watch(entry, {
            persistent: true,
            ignoreInitial: true
        });
        this.watcher.on('add', () => {
            this.mpb.scan.init();
        });
        this.watcher.on('change', () => {
            this.mpb.scan.init();
        });
        this.watcher.on('unlink', (path) => {
            console.error('不能删除入口文件', path);
        });
        this.watcher.on('error', (error) => {
            console.error('[watching entry]', error);
        });
    }

    close() {
        this.watcher.close();
    }
};
