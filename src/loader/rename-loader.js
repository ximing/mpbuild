/**
 * Created by ximing on 2019-03-14.
 */

module.exports = function(opts = {}) {
    return function(asset) {
        const [prefixPath, ext] = this.helper.splitExtension(asset.outputFilePath);
        asset.outputFilePath = `${prefixPath}.${opts[ext] || ext}`;
        return asset;
    };
};
