/**
 * Created by ximing on 2020-12-25.
 */
const path = require('path');
const resolve = require('../resolve');

module.exports = class ResolvePlugin {
    apply(mpb) {
        mpb.hooks.resolve.tap('ResolvePlugin', (opt) => {
            const { lib, asset, exts } = opt;
            const fakePath = path.resolve(path.dirname(asset.path), lib);
            // console.log('fakePath1', fakePath, lib)
            if (mpb.assetManager.getAssets(fakePath)) {
                opt.resolveLib = fakePath;
                return opt;
            }
            opt.resolveLib = resolve(lib, asset, exts, mpb.src, mpb.config.alias);

            // console.log('real', lib)
            return opt;
        });
    }
};
