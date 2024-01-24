---
title: FAQ
group: 其他
order: 1
---

## 支持抖音 / 头条小程序吗？

暂不支持。5.x 内置的目标平台 adapter 只有微信（`weapp`），传其他名字会报 `UNKNOWN_TARGET`。

不过 `target` 配置项除了字符串，还接受一个自定义的 `TargetAdapter` 对象（描述文件扩展名、模板标签、JSON 路径字段、npm 入口字段等），理论上可以自行适配其他小程序平台。参考写法见仓库里的测试样例 `packages/core/src/__tests__/fake-adapter.test.ts` 与 `packages/core/src/__fixtures__/fake-mini/`：它基于 `weappAdapter` 派生出一个 `fake` adapter，自定义了模板扩展名（`.tpl` → `.out`）与模板标签（`<inc href>`）。接口定义见 `packages/core/src/types.ts` 的 `TargetAdapter`。

## 为什么旧项目的 `mpb.config.js` 报退出码 2？

5.x 不再读取 `mpb.config.js`。当工作区里只存在旧配置文件时，配置加载会抛出 `LEGACY_CONFIG`，CLI 把它归为「配置错误」，以退出码 2 退出（退出码约定：0 成功 / 1 有 error 级诊断 / 2 配置错误）。

解决办法：把 `mpb.config.js` 改名为 `mpbuild.config.js`（或 `.mjs` / `.ts` / `.mts`），并按 [从 4.x 迁移](#/migration/from-v4) 的字段对照表调整内容。

## 为什么 `require('./x.json')` 的产物变了？

这是 5.x 刻意的 breaking change。4.x 会把 JSON 内容内联成 JS 里的对象字面量；5.x 把 JSON 作为独立模块入图、独立写出为 `.json` 文件，并重写源码里的引用路径。请确认运行时能正常加载这份 `.json`，不要依赖「产物里是对象字面量」的旧行为。详见 [从 4.x 迁移](#/migration/from-v4)。

## SCSS 怎么用？

使用官方插件 `legacyScss()`：

```js
// mpbuild.config.mjs
import { legacyScss } from '@mpbuild/core'

export default {
  src: 'src',
  entry: './entry.js',
  plugins: [legacyScss()],
}
```

它在插件的 `load` 阶段处理 style 模块（`.wxss` / `.css`）的内容，用 postcss-scss 语法解析，支持变量、嵌套、mixin 文件导入（导入路径需包含 `mixin`）；处理失败会报 `UNSUPPORTED_PREPROCESSOR`。注意微信 adapter 默认的 style 扩展名是 `.wxss` / `.css`，真实的 `.scss` 文件不在默认解析范围内。实现见 `packages/core/src/plugin/legacy-scss.ts`，更多说明见 [官方插件](#/plugins/official)。

## 生产环境为什么建议用 `mpbuild.config.js` / `.mjs`？

`@mpbuild/cli` 的生产 bin 是编译后的 JS，不再默认注册 TypeScript 加载器。当配置是 `.ts` / `.mts` 且生产环境无法 import 时，CLI 会跳过该文件并诊断 `CONFIG_TS_SKIPPED`，继续尝试 `.js` / `.mjs`；如果只有无法加载的 `.ts` 配置则直接失败。

因此生产环境（CI、部署机）建议直接提交 `mpbuild.config.js` 或 `mpbuild.config.mjs`，并删除残留的 `.ts` / `.mts` 配置以免误导。配置加载顺序与规则见 [配置参考](#/reference/config)。

## `--minify` 和 `compile.minify` 是什么关系？

`compile.minify` 是配置字段，支持 `boolean` 或按模块 kind 的对象（如 `{ script: true }`），默认 `false`。

CLI 的 `--minify` 是覆盖开关：`mpb build --minify` 会强制把 `compile.minify` 置为 `true`，优先级高于配置文件。注意 `mpb dev` 与 `mpb build --watch` 进入 watch 分支，`--minify` 不生效。实现见 `packages/cli/src/index.ts`，命令详情见 [CLI 参考](#/reference/cli)。

## 如何查看依赖图和构建分析？

两个命令：

```bash
mpb analyze        # 构建分析，结果写入 <output.dir>/mpbuild-analyze.json
mpb inspect graph  # 在终端逐节点打印依赖图（节点 id、owner 归属、依赖边）
```

`mpb analyze` 适合做产物构成与分包归属分析；`mpb inspect graph` 适合排查「某个文件为什么被/没被收进来」这类问题。两者出错时同样以退出码 1 退出并打印诊断。

## `target` 和 `platform` 有什么区别？

- `target`：目标平台 adapter，决定整套文件类型规则（扩展名表、模板标签、app.json 字段名等），默认 `'weapp'`，**不要把 `'wx'` 这类平台名写进 `target`**（会报 `UNKNOWN_TARGET`）。
- `platform`：条件编译的平台名（如 `'wx'`），决定文件级多态 infix（先试 `name.wx.js` 再试 `name.js`）与 `@ifdef` 块级指令的上下文。

详见 [条件编译与多态](#/guide/conditional-compilation)。

## npm 包需要额外配置吗？

一般不需要。引用 npm 包时按入口字段优先级 `miniprogram` → `browser` → `main` → `module` 解析，产物输出到 `output.npm`（默认 `dist/npm`）。node_modules 中已入图的 script 会由内置的 npmCompat SWC 变换处理，**不需要自己在 `plugins` 里加任何插件**。详见 [npm 支持](#/guide/npm)。

## `plugin://` 路径会被处理吗？

不会。`plugin:` / `http:` / `https:` / `data:` / `wxfile:` 开头的 specifier 一律视为 external：不建磁盘节点、不报 `RESOLVE_MISS`，源码与 JSON 里的 `plugin://` 路径原样保留。请不要把它们改写成相对路径。
