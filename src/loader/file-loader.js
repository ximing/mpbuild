/**
 * Created by ximing on 2019-03-14.
 */
module.exports = async function(asset, opts) {
    const { helper, config } = this.mpb;
    console.log('outputFilePath', asset.outputFilePath);
    // 触发编译
    await asset.render();
    return asset;
};
