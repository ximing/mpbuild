/**
 * Created by ximing on 2019-03-14.
 */
const jsonminify = require('jsonminify');

module.exports = function(asset, opts) {
    if (opts.minify) {
        asset.contents = jsonminify(asset.contents).toString();
    }
    return asset;
};
