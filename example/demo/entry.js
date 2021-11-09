/**
 * Created by ximing on 2018/12/7.
 */
module.exports = {
    router: [
        {
            root: '',
            pages: {
                // key路由跳转的页面：value源代码所在位置
                'pages/index/index': '/pages/index/index',
                'pages/user/index': '/pages/user/index',
                'pages/one-test/index': '@one/pages/test/index'
            }
        },
        {
            root: 'subpkg1',
            pages: {
                'one/index': '@two/pages/test/index',
                'two/index': '@two/pages/test2/index'
            }
        }
    ],
    networkTimeout: {
        request: 30000,
        connectSocket: 30000
    },
    debug: false,
    navigateToMiniProgramAppIdList: [
        'wx8fe51119579ed91b',
        'wxd3e6d3907ba8c366',
        'wx92916b3adca84096',
        'wx77af438b3505c00e',
        'wx4474ed752dbe0955'
    ],
    permission: {
        'scope.userLocation': {
            desc: '为便于为您定位附近门店'
        }
    }
};
