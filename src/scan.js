/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const perf = require('execution-time')();
const log = require('./log');
const { formatBuildTime } = require('./util');
const AppJSON = require('./plugin/appJSON');
const { assetType } = require('./consts');

module.exports = class ScanDep {
    constructor(mpb) {
        this.mpb = mpb;
        this.exts = this.mpb.config.resolve.extensions;
        if (!this.exts) {
            throw new Error('exts required');
        }
        this.modules = {};
        this.mpb.jsxPagesMap = {};
        this.mpb.pagesMap = {};
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
            this.exts.map(async (ext) => {
                // @TODO 这里的ext 应该和js寻址 .webchat.js 这种分开
                const meta = { type, root, source };
                if (ext === '.json') {
                    meta['mbp-scan-json-dep'] = 'usingComponents';
                }
                const filePath = this.mpb.helper.getFilePath(base, `${prefixPath}${ext}`);
                if (type === assetType.page) {
                    if (['.jsx', '.tsx'].includes(ext)) {
                        this.mpb.jsxPagesMap[filePath] = filePath;
                    }
                    this.mpb.pagesMap[filePath] = filePath;
                }
                // console.log('__++')
                const res = await this.mpb.assetManager.addAsset(
                    filePath,
                    `${prefixOutputPath}${ext}`,
                    meta
                );
                // console.log('--->', prefixPath);
                return res;
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
        this.mpb.appEntry = require(this.mpb.entryPath);
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
                    pages
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
                        pages
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
        console.log('--------_>app');
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
