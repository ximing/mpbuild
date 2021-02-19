/**
 * Created by ximing on 2020-12-25.
 */
const resolve = require('../resolve');

module.exports = class ResolvePlugin {
    apply(mpb) {
        mpb.hooks.resolve.tap('ResolvePlugin', (opt) => {
            const { lib, asset, exts } = opt;
            opt.resolveLib = resolve(lib, asset, exts, mpb.src, mpb.config.alias);
            return opt;
        });
    }
};
