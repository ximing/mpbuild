---
title: entry 与路由
group: 指南
order: 2
---

# entry 与路由

`entry` 是配置里的必填项,描述小程序的 app 入口。它有两种给法:

- 字符串:一个文件路径(相对项目根目录,也可以写绝对路径),构建时动态 import,支持 `export default` 与 `module.exports`;文件加载失败报 `ENTRY_LOAD`。
- 内联对象:直接写在 `mpbuild.config.mjs` 的 `entry` 字段里。

entry 对象分两种形态——经典形态与 router 形态。**两种形态下页面结构与产物 `app.json` 的来源完全不同**:

| 形态 | 判定 | 页面发现来源 | 产物 app.json 来源 |
|---|---|---|---|
| 经典形态 | entry 不含 `router` | 磁盘上的 `src/app.json` | 磁盘上的 `src/app.json` |
| router 形态 | entry 含 `router` 数组 | `router` 各组的 `pages` | 由 entry 生成(`virtual:app.json`) |

## 经典形态:以磁盘 `src/app.json` 为准

经典形态的 entry 对象形如传统的 `app.json`(`{ pages, subPackages }`)。但要注意:**此时 entry 对象里的 `pages` / `subPackages` 与其他顶层键都不会被构建消费**——页面结构完全以磁盘上的 `src/app.json` 为准:

- `src/app.js` 的套件伴生从磁盘找到 `src/app.json`,解析其中的 `pages` / `subPackages`(含 `independent` 独立分包声明)收录页面;
- 这份 `src/app.json` 作为普通 json 模块入图,输出为 `dist/app.json`。

由于 entry 本身不被消费,经典形态下它可以是最小对象(`entry: {}`,或指向一个导出 `{}` 的文件)。

> [!WARNING]
> 经典形态**必须存在物理的 `src/app.json`**。缺少它时:不产出 `app.json`、不收录任何页面,而且**不会产生任何诊断**——构建看似成功,产物里却没有页面。希望由 entry 直接生成 `app.json` 时,请改用下面的 router 形态。

## router 形态:entry 驱动页面结构

router 形态把「路由路径」与「源码位置」解耦:`pages` 对象的 key 是路由跳转用的逻辑页面路径,value 是源码位置(`/` 开头相对 `src` 目录,或 alias):

```js
module.exports = {
  router: [
    {
      root: '',
      pages: {
        // key: 路由跳转的页面;value: 源代码所在位置
        'pages/index/index': '/pages/index/index',
        'pages/user/index': '/pages/user/index',
        'pages/one-test/index': '@one/pages/test/index',
      },
    },
    {
      root: 'subpkg1',
      pages: {
        'one/index': '@two/pages/test/index',
        'two/index': '@two/pages/test2/index',
      },
    },
  ],
}
```

以上例子取自 `example/demo/entry.js`。规则:

- `root: ''` 的组是主包;每个非空 `root` 的组成为一个分包,可带 `independent: true` 声明独立分包(约束见 [分包与子仓库](#/guide/subpackages))。
- 构建时由 entry 生成 `virtual:app.json` 虚拟模块写入产物(**仅 router 形态**):逻辑页路径进 `app.json` 的 `pages` / `subPackages`,源码位置只用于建图。因此同一个源码页面可以映射到任意逻辑路径,也可以把子仓库里的页面编进主包或分包。
- router 形态**不需要**磁盘 `src/app.json`;产物 `app.json` 完全由 entry 生成。

## 顶层键透传(仅 router 形态)

router 形态下,entry 对象里除 `router` / `pages` / `subPackages` 之外的顶层键,会原样透传进生成的 `app.json`:

```js
module.exports = {
  router: [
    /* ... */
  ],
  networkTimeout: { request: 30000, connectSocket: 30000 },
  debug: false,
  permission: {
    'scope.userLocation': { desc: '为便于为您定位附近门店' },
  },
}
```

经典形态没有这一步——需要的顶层键直接写在磁盘 `src/app.json` 里即可。

## 页面/组件 JSON 与 `*.config.js`

页面、组件的 JSON 除了写静态 `.json` 文件,还可以写成 `*.config.js`。构建期会在隔离的 `require` 中执行该文件,取导出的纯对象序列化为 JSON:

```js
// pages/index/index.config.js
module.exports = {
  navigationBarTitleText: '首页',
  usingComponents: { comp: '../components/comp/index' },
}
```

规则:

- 只接受纯对象(plain object),`export default` 与 `module.exports` 均可;每次加载前会清掉 require 缓存,watch 下改动生效。
- 输出文件名剥掉 `.config` 与平台 infix:`index.config.js` → `index.json`,`index.wx.config.js` → `index.json`。
- 执行抛错、导出不是纯对象或无法 JSON 序列化时,报 `CONFIG_JS_INVALID`(error 级诊断),该节点按空对象 `{}` 处理。
- `.config.js` 里 `require` 的相邻文件会被收集进 watch 集合,变更后触发该节点重建,见 [watch 与缓存](#/guide/watch-cache)。
