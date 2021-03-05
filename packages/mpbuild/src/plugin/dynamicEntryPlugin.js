/*
 * 页面真正使用的时候才进行页面构建够建小程序
 * 会有白屏问题，从A去B页面的时候再构建B页面，微信开发者工具会刷新，然后又回到A页面，就很难
 * */
module.exports = class DynamicEntryPlugin {
    apply(mpb) {
        //
    }
};
