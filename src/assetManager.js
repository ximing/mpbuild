/**
 * Created by ximing on 2019-03-15.
 */
const chalk = require('chalk');
const fse = require('fs-extra');
const notifier = require('node-notifier');

const Asset = require('./asset');
const log = require('./log');

module.exports = class AssetManager {
    constructor(mpb) {
        this.mpb = mpb;
        this.map = {};
        this.mpb.hooks.addAsset.tapPromise('LoaderManager', (asset) => {
            return Promise.resolve(asset);
        });
    }

    getAsset(path) {
        return this.map[path];
    }

    setAsset(asset) {
        this.map[asset.path] = asset;
        return asset;
    }

    removeAsset(asset) {
        if (asset) delete this.mpb[asset.path];
    }

    // 尝试添加新的资源文件
    addAsset(path, outputPath, meta) {
        let asset;
        if (path instanceof Asset) {
            asset = path;
        } else {
            asset = new Asset(path, outputPath, meta);
        }
        if (asset.exists()) {
            if (this.getAsset(asset.path) && !this.getAsset(asset.path).beChanged(asset)) {
                // 终止接下来处理asset的流程
                // console.log(chalk.yellow('[addAsset] 文件没有更改'), asset.path);
                return asset;
            }
            // 更新asset
            this.setAsset(asset);
            return this.mpb.hooks.addAsset.promise(asset).then(
                (asset) => {
                    if (asset.shouldOutput) {
                        return this.mpb.hooks.beforeEmitFile.promise(asset).then(
                            () => {
                                this.emitFile(asset);
                                return asset;
                            },
                            (err) => {
                                if (this.mpb.isWatch) {
                                    notifier.notify({
                                        title: 'beforeEmitFile hooks error',
                                        message: '输出文件失败，具体错误请查看命令行'
                                    });
                                    console.log(
                                        chalk.red('[beforeEmitFile hooks error]'),
                                        asset.path
                                    );
                                    console.error(err);
                                } else {
                                    console.error(err);
                                    process.exit(1);
                                }
                                // throw err;
                            }
                        );
                    }
                    // 如果不输出，就删除之前的构建文件，这样小程序工具上直观能体现出来有代码有问题了
                    return fse
                        .remove(asset.outputFilePat)
                        .then((_) => asset)
                        .catch((_) => asset);
                },
                (err) => {
                    console.log('asset', asset.path);
                    console.error(err);
                    // throw err;
                }
            );
        }
        // console.log(`[assetManager] not found: ${path}`);
        return Promise.resolve();
        // throw new Error(`not found${path}`);
    }

    emitFile(asset) {
        asset.render(this.mpb).catch((err) => {
            console.error(err);
        });
    }

    delAsset(asset) {
        // TODO 这里就是单纯去除文件本身，文件所依赖的，和被依赖的有可能悬空，也需要被清除
        this.removeAsset();
        asset.exists();
    }

    getWatchFiles() {
        return Object.keys(this.map).filter((path) => path !== this.mpb.entryPath);
    }
};
