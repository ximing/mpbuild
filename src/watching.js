const chokidar = require('chokidar');
const _ = require('lodash');
const chalk = require('chalk');
const Watchpack = require('watchpack');

module.exports = class Watching {
    constructor(mpb, handle = () => {}) {
        this.mpb = mpb;
        this.files = [];
        this.pending = false;
        this.pendingPaths = [];
        this.handle = handle;
        this.watchTimer = Date.now();
        this.watcher = null;
    }

    watch() {
        const files = this.mpb.assetManager.getWatchFiles();
        if (this.watcher) {
            this.listenWatcherEvent();
            this.watcher.watch(files, [], this.watchTimer);
        } else {
            this.watcher = new Watchpack({
                aggregateTimeout: 1000,
                poll: true
            });
            this.listenWatcherEvent();
            this.watcher.watch(files, [], this.watchTimer);
        }
        this.files = files;
    }

    listenWatcherEvent() {
        this.watcher.on('aggregated', (changes, removals) => {
            this.watchTimer = Date.now();
            this.watcher && this.watcher.close();
            this.watcher = null;
            changes.forEach((filePath) => {
                this.handleWatch(filePath, 'change');
            });
            removals.forEach((filePath) => {
                this.handleWatch(filePath, 'unlink');
            });
        });
    }

    watch1(missing) {
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
                usePolling: true,
                ignoreInitial: true
                // awaitWriteFinish: {
                //     stabilityThreshold: 2000,
                //     pollInterval: 100
                // }
            });
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
        console.log(chalk.cyan('[watching-asset]'), path, type);
        const asset = this.mpb.assetManager.getAsset(path);
        if (asset) {
            if (type === 'change') {
                await this.mpb.assetManager.addAsset(path, asset.outputFilePath, asset.meta);
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
        this.watcher && this.watcher.close();
    }
};
