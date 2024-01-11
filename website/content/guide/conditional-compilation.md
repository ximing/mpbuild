---
title: 条件编译与多态
group: 指南
order: 3
---

# 条件编译与多态

设置 `platform`(如 `'wx'`)后,mpbuild 提供两层多端拆分能力:**文件级多态**(平台 infix)与**块级条件编译**(`@ifdef` 注释块)。

```js
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  platform: 'wx',
  ifdef: {
    tokens: { debug: true, channel: 'dev' }, // 自定义 token
    blockcode: true, // 块级条件编译开关,默认 true
  },
})
```

## 文件级多态(infix)

解析模块时,每个候选扩展名都优先尝试带 `.${platform}` 中缀的文件,再尝试不带中缀的同名文件。`platform: 'wx'` 时:

- `pages/test/index.wx.js` 优先于 `pages/test/index.js`
- `index.wx.wxml` 优先于 `index.wxml`,`index.wx.wxss` 优先于 `index.wxss`

页面/组件等套件成员输出时会剥掉中缀:`index.wx.js` 的产物是 `index.js`,`index.wx.config.js` 的产物是 `index.json`。未被选中的同名候选文件会加入 watch 集合,新增或删除平台特化文件能触发正确的重建。

示例见 `example/projects/one/pages/test/`:同一目录下同时存在 `index.js` 与 `index.wx.js`、`index.wxml` 与 `index.wx.wxml` 等成对文件。

## 块级条件编译(@ifdef)

在源码里用注释写条件块,构建时按 token 上下文决定是否保留;指令行本身与被剔除的块都会从产物中删除。

JS / WXSS 使用行注释或块注释:

```js
// @ifdef wx
wx.showToast({ title: '仅微信平台' })
// @endif

/* @ifndef debug */
console.log('release build')
/* @endif */

// @if wx || qq
// 任一 token 命中即保留
// @endif
```

WXML 使用 HTML 注释:

```html
<!-- @ifdef wx -->
<view>仅微信平台</view>
<!-- @endif -->
```

块可以嵌套,`@endif` 闭合最近一个未闭合的块。

### token 上下文

条件是否成立,由以下上下文共同决定(按展开顺序,后面的键覆盖前面的同名键):

1. `{ [platform]: true }` —— `platform: 'wx'` 时 `@ifdef wx` 恒成立
2. `p` —— 固定等于 `platform` 字符串
3. `ifdef.tokens` —— 用户在配置里定义的 token

判定规则:token 值为 `true` 或非空字符串视为「开」。`@ifdef TOKEN` 要求 TOKEN 开,`@ifndef TOKEN` 要求 TOKEN 关,`@if A || B` 支持用 `||` 连接多个 token,任一为开即保留。

### 生效条件

- 只有设置了 `platform`,块级剥离才会执行;`ifdef.blockcode: false` 可整体关闭(默认 `true`)。
- 静态资源(asset)不做条件编译,原样拷贝。
