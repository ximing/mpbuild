// 生成AppJSON.js 文件，方便业务方 查看代码里面使用 app.tabs 的值
const path = require('path');
const Asset = require('../asset');

module.exports = class AppJSON {
    constructor(options) {
        this.appEntry = '';
        this.options = {
            output: 'app.json',
            ...options,
        };
    }

    apply(mpb) {
        mpb.hooks.afterCompile.tapPromise('AppJSON', async () => {
            // 模拟一个文件出来
            const { appEntry } = mpb;
            let pages = [];
            const subPackages = [];
            appEntry.router.forEach((router) => {
                if (router.root) {
                    const subPack = {
                        root: router.root,
                        pages: Object.keys(router.pages),
                    };
                    subPackages.push(subPack);
                } else {
                    pages = Object.keys(router.pages);
                }
            });
            let appOutput = { ...appEntry, pages, subPackages };
            delete appOutput.router;
            appOutput = mpb.hooks.beforeOutputAppJSON.call(appOutput);
            const strAppEntry = JSON.stringify(appOutput);
            if (this.appEntry !== strAppEntry) {
                this.appEntry = strAppEntry;
                const asset = new Asset(
                    path.join(mpb.src, this.options.output),
                    path.join(mpb.dest, this.options.output),
                    { virtual_file: true }
                );
                asset.contents = strAppEntry;
                asset.mtime = Date.now();
                await mpb.assetManager.addAsset(asset);
            }
            return Promise.resolve();
        });
    }
};
