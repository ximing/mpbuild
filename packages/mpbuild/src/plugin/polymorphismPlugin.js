/**
 * Created by ximing on 2019-04-08.
 */
const { preprocess } = require('preprocess');

module.exports = class PolymorphismPlugin {
    constructor(conf = {}) {
        this.conf = conf;
        this.blockcode = typeof this.conf.blockcode === 'boolean' ? this.conf.blockcode : true;
        this.platform = this.conf.platform;
        const originContext = {
            p: this.platform,
        };
        if (this.platform) {
            originContext[this.platform] = this.platform;
        }
        this.context = Object.assign(originContext, this.conf.blockContext || {});
    }

    apply(mpb) {
        mpb.platform = this.platform;
        mpb.hooks.extension.tap('extension', (exts) => {
            if (this.platform) {
                Object.keys(exts).forEach((item) => {
                    exts[item] = exts[item]
                        .map((ext) => `.${this.platform}${ext}`)
                        .concat(exts[item]);
                });
            }
            return exts;
        });
        if (this.blockcode) {
            mpb.hooks.beforeAddAsset.tapPromise('PolymorphismPlugin', async (asset) => {
                const jsFile = [
                    ...new Set([...mpb.exts.js, ...mpb.exts.wxs, ...mpb.exts.json]),
                ].filter((item) => item !== '.json');
                let type = '';
                if (jsFile.includes(asset.ext)) {
                    type = 'js';
                } else if (mpb.exts.wxml.includes(asset.ext)) {
                    type = 'html';
                } else if (mpb.exts.wxss.includes(asset.ext)) {
                    type = 'js';
                }
                if (type && asset.contents) {
                    asset.contents = preprocess(asset.contents, this.context, { type });
                }
                return Promise.resolve(asset);
            });
        }
    }
};
