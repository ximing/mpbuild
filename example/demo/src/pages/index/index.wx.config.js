module.exports = {
    navigationBarTitleText: 'wx 首页',
    navigationBarBackgroundColor: '#FFFFFF',
    usingComponents: {
        comp1: '../../components/comp1/index',
        comp2: '/components/comp2/index',
        // @ifdef mt
        comp3: '/components/comp3/index'
        // @endif
    },
    enablePullDownRefresh: false,
    disableScroll: true
};
