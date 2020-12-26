/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const chalk = require('chalk');
const perf = require('execution-time')();
const log = require('./log');
const { formatBuildTime } = require('./util');
const AppJSON = require('./plugin/appJSON');
const { assetType } = require('./consts');
const resolve = require('./resolve');

module.exports = class ScanDep {
    constructor(mpb) {
        this.mpb = mpb;
        this.modules = {};
    }

    addAssetByEXT(
        prefixPath,
        prefixOutputPath,
        type = assetType.page,
        base = this.mpb.config.src,
        root = '',
        source = ''
    ) {
        return Promise.all(
            Object.keys(this.mpb.exts).map((key) => {
                const ext = this.mpb.exts[key];
                const meta = { type, root, source };
                if (key === 'json') {
                    meta['mbp-scan-json-dep'] = 'usingComponents';
                }
                try {
                    const path = resolve(
                        prefixPath,
                        { dir: base, filename: base },
                        ext,
                        this.mpb.src,
                        this.mpb.config.alias,
                        true
                    );
                    // 这里认为 页面必须要有一个js文件，其他可以忽略
                    if (key === 'js' && !path) {
                        console.log(
                            chalk.red('[scan addAssetByEXT error]'),
                            '页面类型文件',
                            key,
                            '页面路径',
                            prefixPath,
                            'root: ',
                            root
                        );
                        return Promise.reject('没找到对应文件');
                    }
                    if (!path) {
                        return Promise.resolve(null);
                    }
                    return this.mpb.assetManager.addAsset(path, `${prefixOutputPath}.${key}`, meta);
                } catch (err) {
                    if (key !== 'js') {
                        return Promise.resolve(null);
                    }
                    return Promise.reject(err);
                }
            })
        );
    }

    async pages() {
        await this.findEntry();
        const { router } = this.mpb.appEntry;
        for (let i = 0, l = router.length; i < l; i++) {
            let { root, pages } = router[i];
            if (!root) {
                root = '';
            }
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(
                Object.keys(pages).map((pageRouter) =>
                    this.addAssetByEXT(
                        pages[pageRouter],
                        path.join(this.mpb.dest, root, pageRouter),
                        undefined,
                        undefined,
                        root
                    )
                )
            );
        }
    }

    async findEntry() {
        this.mpb.entryPath = path.resolve(process.cwd(), this.mpb.config.entry);
        // eslint-disable-next-line
        this.mpb.appEntry = this.mpb.hooks.resolveAppEntryJS.call(require(this.mpb.entryPath));
        if (!this.mpb.appEntry.router) {
            this.mpb.appEntry.router = [];
            // 处理 标准app.json
            if (this.mpb.appEntry.pages) {
                const pages = {};
                this.mpb.appEntry.pages.forEach((page) => {
                    pages[page] = `/${page}`;
                });
                this.mpb.appEntry.router.push({
                    root: '',
                    pages,
                });
                delete this.mpb.appEntry.pages;
            }
            if (this.mpb.appEntry.subPackages) {
                this.mpb.appEntry.subPackages.forEach((subPack) => {
                    const pages = {};
                    subPack.pages.forEach((page) => {
                        pages[page] = `/${path.join(subPack.root, page)}`;
                    });
                    this.mpb.appEntry.router.push({
                        root: subPack.root,
                        pages,
                    });
                });
                delete this.mpb.appEntry.subPackages;
            }
        } else {
            this.mpb.mountPlugin(new AppJSON());
        }
        await this.mpb.hooks.afterGenerateEntry.promise(this.mpb);
    }

    async init() {
        perf.start('init');
        // find App
        await this.addAssetByEXT('app', path.join(this.mpb.dest, 'app'), assetType.app);
        // find Pages
        await this.pages();
        log.info(`完成编译,耗时:${formatBuildTime(perf.stop('init').time)}`);
    }

    async watch() {
        await this.init();
        this.mpb.watchFileSystem.watch();
    }

    async run() {
        await this.mpb.hooks.beforeCompile.promise(this.mpb);
        await this.init();
        await this.mpb.hooks.afterCompile.promise(this.mpb);
    }
};
