---
title: npm包
order: 1
nav:
  title: 指南
  order: 0
group:
  title: 基本概念
---

## npm 包

NPM 包可以是 JS 包、小程序组件(页面)和小程序分包的形式

当作为小程序页面时可以在配置文件中指定输出路径。

作为普通 JS 包时，需符合 [NPM module 规范](https://docs.npmjs.com/about-packages-and-modules)

### JS

JS 类型的 NPM 包如果不配置指定输出路径的话，默认输出到 npm 文件夹。

首先安装要使用的 npm 包。

```bash
npm install dayjs
```

在任意 JS 代码中引用该 NPM 包。

```javascript
//src目录下的app.js
import dayjs from 'dayjs';
App({
  onLaunch: function() {
    console.log(dayjs().format('YYYY-MM-DD'));
  },
});
```

### 小程序组件

支持在小程序 json 配置文件中直接引用 Npm 包中的小程序组件，会自动分析依赖将其放到合适位置

```json
{
  "usingComponents": {
    "yoda-slider": "@mtfe/yoda-static-weapp/yoda_modules/component/slider/slider"
  }
}
```

### 小程序页面

支持在 entry 中配置任意 npm 包中小程序页面

```javascript
// entry.js 可代替 app.json，router字段会生成pages和subpackages，其他字段透传
module.exports = {
  router: [
    {
      root: '',
      pages: {
        // key路由跳转的页面：value源代码所在位置
        'pages/debug/index': '@lsfe/seed/pages/debug/index',
      },
    },
  ],
  permission: {
    'scope.userLocation': {
      desc: '为便于为您定位附近门店',
    },
  },
};
```

## 特性
