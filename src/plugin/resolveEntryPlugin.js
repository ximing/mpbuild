const path = require('path');
const Asset = require('../asset');
const { formatBuildTime, emptyManifest, emptyStyle } = require('../util');
const { assetType } = require('../consts');

module.exports = class ResolveEntryPlugin {
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
        return path.join(this.mpb.src, filePath) + ext;
    }

    apply(mpb) {
        this.mpb = mpb;
        // const extensionsKey = Object.keys(mpb.extensions);
        mpb.hooks.resolveEntry.tapPromise(
            'ResolveEntryPlugin',
            async ({ base, prefixPath, type, entryType, meta, prefixOutputPath, pagePath }) => {
                let asset;
                if (entryType === 'manifest') {
                    let manifestPath;
                    try {
                        manifestPath = this.mpb.resolve.manifest(prefixPath, base);
                    } catch (e) {}
                    if (!manifestPath) {
                        asset = emptyManifest(
                            this.getPath(prefixPath, '.json'),
                            `${prefixOutputPath}.json`,
                            meta,
                            type === assetType.component
                        );
                    } else {
                        asset = new Asset(manifestPath, `${prefixOutputPath}.json`, meta);
                    }
                } else if (entryType === 'tpl' || entryType === 'style') {
                    let tplPath;
                    const extMap = { tpl: '.wxml', style: '.wxss' };
                    try {
                        tplPath = this.mpb.resolve[entryType](prefixPath, base);
                    } catch (e) {}
                    if (tplPath) {
                        asset = new Asset(tplPath, `${prefixOutputPath}${extMap[entryType]}`, meta);
                    } else {
                        asset = emptyStyle(
                            this.getPath(prefixPath, extMap[entryType]),
                            `${prefixOutputPath}${extMap[entryType]}`,
                            meta
                        );
                    }
                } else if (entryType === 'es') {
                    if (type === assetType.page) {
                        if (pagePath.endsWith('.tsx') || pagePath.endsWith('.jsx')) {
                            this.mpb.jsxPagesMap[pagePath] = pagePath;
                        }
                        this.mpb.pagesMap[pagePath] = pagePath;
                    }
                    asset = new Asset(pagePath, `${prefixOutputPath}.js`, meta);
                }
                return {
                    base,
                    prefixPath,
                    type,
                    entryType,
                    meta,
                    asset,
                    prefixOutputPath,
                    pagePath,
                };
            }
        );
    }
};
