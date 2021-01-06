const chokidar = require('chokidar');
const path = require('path');
const _ = require('lodash');

module.exports = class WatchEntry {
    constructor() {
        this.rebuild = _.throttle(this.rebuild, 500);
    }

    apply(mpb) {
        this.mpb = mpb;
        mpb.hooks.afterCompile.tapPromise('WatchEntry', async () => {
            if (mpb.isWatch) {
                let oldRouter = mpb.appEntry.router;
                let pagesMap = {};
                oldRouter.forEach((route) => {
                    Object.values(route.pages).forEach((page) => {
                        pagesMap[path.dirname(path.join(mpb.src, page))] = 1;
                    });
                });
                chokidar.watch(mpb.entryPath).on('change', async () => {
                    console.log('入口文件更改，差量编译');
                    this.rebuild();
                    pagesMap = {};
                    oldRouter = mpb.appEntry.router;
                    oldRouter.forEach((route) => {
                        Object.values(route.pages).forEach((page) => {
                            pagesMap[path.dirname(path.join(mpb.src, page))] = 1;
                        });
                    });
                });

                chokidar
                    .watch(`${mpb.src}/**/*`, {
                        ignoreInitial: true,
                    })
                    .on('add', async (p) => {
                        if (pagesMap[path.dirname(p)]) {
                            console.log('添加新的页面相关文件，差量编译');
                            this.rebuild();
                        }
                    });
            }
        });
    }

    async rebuild() {
        delete require.cache[this.mpb.entryPath];
        await this.mpb.scan.findEntry();
        await this.mpb.scan.pages();
        console.log('差量编译完成');
    }
};
