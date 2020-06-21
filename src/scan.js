/**
 * Created by ximing on 2019-03-14.
 */
const path = require('path');
const perf = require('execution-time')();
const log = require('./log');
const { formatBuildTime, emptyManifest, emptyStyle } = require('./util');
const AppJSON = require('./plugin/appJSON');
const { assetType } = require('./consts');
const Asset = require('./asset');

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
    }

    getPath(filePath, ext) {
        // 按照长度排序，长的优先匹配
        // TODO $后缀支持
        const keys = Object.keys(this.mpb.config.resolve.alias || {}).sort(
            (a, b) => b.length - a.length
        );
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            if (filePath.startsWith(key)) {
                return `${filePath.replace(key, this.mpb.config.resolve.alias[key])}${ext}`;
            }
        }
        return path.join(this.mpb.src, filePath, ext);
    }

    async addAssetByEXT(
        prefixPath,
        prefixOutputPath,
        type = assetType.page,
        base = this.mpb.config.src,
        root = '',
        source = ''
    ) {
        const pagePath = this.mpb.resolve.es(prefixPath, base);
        const meta = { type, root, source };
        if (type === assetType.page) {
            if (pagePath.endsWith('.tsx') || pagePath.endsWith('.jsx')) {
                this.mpb.jsxPagesMap[pagePath] = pagePath;
            }
            this.mpb.pagesMap[pagePath] = pagePath;
        }
        await this.mpb.assetManager.addAsset(pagePath, `${prefixOutputPath}.js`, meta);
        let stylePath;
        try {
            stylePath = this.mpb.resolve.style(prefixPath, base);
            // await this.mpb.assetManager.addAsset(stylePath, `${prefixOutputPath}.wxss`, meta);
        } catch (e) {}
        await this.mpb.assetManager.addAsset(
            stylePath ||
                emptyStyle(this.getPath(prefixPath, '.wxss'), `${prefixOutputPath}.wxss`, meta),
            `${prefixOutputPath}.wxss`,
            meta
        );
        let tplPath;
        try {
            tplPath = this.mpb.resolve.tpl(prefixPath, base);
            // await this.mpb.assetManager.addAsset(tplPath, `${prefixOutputPath}.wxml`, meta);
        } catch (e) {}
        await this.mpb.assetManager.addAsset(
            tplPath ||
                emptyStyle(this.getPath(prefixPath, '.wxml'), `${prefixOutputPath}.wxml`, meta),
            `${prefixOutputPath}.wxml`,
            meta
        );
        let manifestPath;
        try {
            manifestPath = this.mpb.resolve.manifest(prefixPath, base);
            // const manifestMeta = { type, root, source, 'mbp-scan-json-dep': 'usingComponents' };
            // await this.mpb.assetManager.addAsset(
            //     manifestPath,
            //     `${prefixOutputPath}.json`,
            //     manifestMeta
            // );
        } catch (e) {}
        const manifestMeta = { type, root, source, 'mbp-scan-json-dep': 'usingComponents' };
        await this.mpb.assetManager.addAsset(
            manifestPath ||
                emptyManifest(
                    this.getPath(prefixPath, '.json'),
                    `${prefixOutputPath}.json`,
                    meta,
                    type === assetType.component
                ),
            `${prefixOutputPath}.json`,
            manifestMeta
        );
        if (type === assetType.page || type === assetType.app) {
            console.log('type', type, pagePath);
            try {
                await this.mpb.hooks.afterBuildPointEntry.promise({
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
