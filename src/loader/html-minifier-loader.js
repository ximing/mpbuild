/**
 * Created by ximing on 2019-03-18.
 */
const htmlmin = require('html-minifier');

module.exports = function(asset, options) {
    asset.contents = htmlmin.minify(asset.contents, options);
    return asset;
};
