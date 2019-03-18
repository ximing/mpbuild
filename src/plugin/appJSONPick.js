// 生成AppJSON.js 文件，方便业务方 查看代码里面使用 app.tabs 的值
const path = require('path');
const _ = require('lodash');

_;
const Asset = require('../asset');

module.exports = class AppJSON {
    constructor(options) {
        this.appEntry = '';
        this.options = Object.assign(
            {},
            {
                output: 'appJson.js',
                picks: ['tabBar']
            },
            options
        );
    }

    apply(mpb) {
        mpb.hooks.afterCompile.tapPromise('AppJSON', async () => {
            // 模拟一个文件出来
            const { appEntry } = mpb;
            const outPutJSON = _.pick(appEntry, this.options.picks);
            const strAppEntry = `module.exports = ${JSON.stringify(outPutJSON)}`;
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
