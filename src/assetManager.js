/**
 * Created by ximing on 2019-03-15.
 */
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
                // console.log('文件没有更改');
                return asset;
            }
            // 更新asset
            this.setAsset(asset);
            return this.mpb.hooks.addAsset.promise(asset).then(
                (asset) =>
                    this.mpb.hooks.beforeEmitFile.promise(asset).then(
                        () => {
                            this.emitFile(asset);
                            return asset;
                        },
                        (err) => {
                            console.error(err);
                            // throw err;
                        }
                    ),
                (err) => {
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
        asset.render().catch((err) => {
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
