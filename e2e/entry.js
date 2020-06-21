module.exports = {
    router: [
        {
            root: '',
            pages: {
                // key路由跳转的页面：value源代码所在位置
                'pages/index/index': '/pages/index/index',
                'pages/logs/index': '/pages/logs/logs'
            }
        },
        {
            root: 'subPacks',
            pages: {
                // key路由跳转的页面：value源代码所在位置
                'pages/index/index': '/subPacks/pages/index/index',
                'pages/logs/index': '/subPacks/pages/logs/logs'
            }
        }
    ],
    networkTimeout: {
        request: 30000,
        connectSocket: 30000
    },
    debug: false,
    navigateToMiniProgramAppIdList: ['wx8fe51119579ed91b', 'wxd3e6d3907ba8c366'],
    permission: {
        'scope.userLocation': {
            desc: '为便于为您定位'
        }
    },
    window: {
        navigationBarBackgroundColor: '#FFFFFF',
        navigationBarTextStyle: 'black',
        backgroundColor: '#FFFFFF',
        backgroundTextStyle: 'dark',
        enablePullDownRefresh: false,
        navigationBarTitleText: '乐高'
    }
};
