/**
 * Created by ximing on 2019-03-14.
 */
module.exports = function() {
    return async function(asset) {
        const { helper, config } = this;
        console.log('outputFilePath', asset.outputFilePath);
        // 触发编译
        await asset.render();
        return asset;
    };
};
