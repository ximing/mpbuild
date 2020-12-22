/**
 * Created by ximing on 2019-04-08.
 */

module.exports = class PolymorphismPlugin {
    apply(mpb) {
        mpb.hooks.extension.tap('extension', (exts) => {
            exts.js = [...new Set(exts.js.concat(['.json']))];
            if (mpb.config.platform) {
                Object.keys(exts).forEach((item) => {
                    exts[item] = exts[item]
                        .map((ext) => `.${mpb.config.platform}${ext}`)
                        .concat(exts[item]);
                });
            }
            return exts;
        });
    }
};
