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
        this.exts.es = this.exts.es.filter((item) => item !== 'json');
        this.modules = {};
        this.mpb.jsxPagesMap = {};
        this.mpb.pagesMap = {};
        this.entryMap = new Map();
    }

    async addAssetByEXT(
        prefixPath,
        prefixOutputPath,
        type = assetType.page,
        base = this.mpb.config.src,
        root = '',
        source = ''
    ) {
        console.log('prefixPath', prefixPath);
        const pagePath = this.mpb.resolve.es(prefixPath, base);
        const meta = { type, root, source };
        const { asset: esAsset } = await this.mpb.hooks.resolveEntry.promise({
            base,
            prefixPath,
            prefixOutputPath,
            pagePath,
            type,
            entryType: 'es',
            meta,
        });
        await this.mpb.assetManager.addAsset(esAsset);
        const { asset: styleAsset } = await this.mpb.hooks.resolveEntry.promise({
            base,
            prefixPath,
            prefixOutputPath,
            pagePath,
            type,
            entryType: 'style',
            meta,
        });
        await this.mpb.assetManager.addAsset(styleAsset);
        // console.log(styleAsset)
        const { asset: tplAsset } = await this.mpb.hooks.resolveEntry.promise({
            base,
            prefixPath,
            prefixOutputPath,
            pagePath,
            type,
            entryType: 'tpl',
            meta,
        });
        await this.mpb.assetManager.addAsset(tplAsset);
        const { asset: manifestAsset } = await this.mpb.hooks.resolveEntry.promise({
            base,
            prefixPath,
            prefixOutputPath,
            pagePath,
            type,
            entryType: 'manifest',
            meta: { type, root, source, 'mbp-scan-json-dep': 'usingComponents' },
        });
        await this.mpb.assetManager.addAsset(manifestAsset);
        if (type === assetType.page || type === assetType.app) {
            const { name, dir } = path.parse(pagePath);
            this.entryMap.set(path.join(dir, name), pagePath);
            try {
                await this.mpb.hooks.afterBuildPointEntry.promise({
                    entryPath: pagePath,
                    endpoind: pagePath,
                    assetType: type,
                });
            } catch (e) {
                console.error(e);
            }
        }
    }

    async pages() {
        await this.findEntry();
        const { router } = this.mpb.appEntry;
        for (let i = 0, l = router.length; i < l; i++) {
            let { root, pages } = router[i];
            if (!root) {
                root = '';
            }
            const pagesKeys = Object.keys(pages);
            for (let j = 0, ll = pagesKeys.length; j < ll; j++) {
                const pageRouter = pagesKeys[j];
                await this.addAssetByEXT(
                    `${pages[pageRouter][0] === '/' ? '.' : ''}${pages[pageRouter]}`,
                    path.join(this.mpb.dest, root, pageRouter),
                    assetType.page,
                    undefined,
                    root
                );
            }
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
        await this.addAssetByEXT('./app', path.join(this.mpb.dest, 'app'), assetType.app);
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
