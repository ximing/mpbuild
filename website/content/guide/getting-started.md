---
title: 快速开始
group: 指南
order: 1
---

# 快速开始

mpbuild 把小程序源码建成依赖图，染色归属后再变换写盘。一次构建是四段流水线：

![四段流水线](/mpbuild/assets/pipeline.gif)

## 环境要求

- Node.js >= 20
- mpbuild v5 的包为纯 ESM:`@mpbuild/core`(编译器核心)与 `@mpbuild/cli`(命令行,命令为 `mpb`)

## 安装

```bash
npm i -D @mpbuild/cli
```

`@mpbuild/cli` 依赖 `@mpbuild/core`,装这一个即可。

## 最小配置

在项目根目录新建 `mpbuild.config.mjs`:

```js
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  entry: './entry.js',
  src: 'src',
  platform: 'wx',
  output: { dir: 'dist' },
})
```

- `entry` 指向一个导出 app 入口对象的文件(相对项目根目录,也可以直接写内联对象),详见 [entry 与路由](#/guide/entry)。
- `src` 是源码目录,其中必须存在 `app.js` 或 `app.ts`,否则报 `MISSING_APP_JS`。
- `platform` 开启文件级多态与条件编译,详见 [条件编译与多态](#/guide/conditional-compilation)。

对应的 `entry.js`(router 形态——由 entry 直接生成产物 `app.json`,无需磁盘 `src/app.json`):

```js
module.exports = {
  router: [
    { root: '', pages: { 'pages/index/index': '/pages/index/index' } },
  ],
}
```

> [!NOTE]
> entry 还有经典形态(`{ pages, subPackages }`),但经典形态的页面结构以磁盘上的 `src/app.json` 为准且该文件必须存在,entry 里的字段不会被消费。两种形态的差异与坑点见 [entry 与路由](#/guide/entry)。

## 构建与开发

```bash
mpb build   # 全量构建,产物写入 output.dir(默认 dist)
mpb dev     # 首次构建 + watch,文件变更后增量重建
```

更多命令与参数(`mpb analyze`、`mpb inspect graph`、`--minify`、`--no-cache`、退出码)见 [CLI 参考](#/reference/cli)。

## 配置文件名与优先级

`mpb` 在项目根目录按以下顺序查找配置,依次尝试加载第一个存在的文件:

1. `mpbuild.config.ts`
2. `mpbuild.config.mts`
3. `mpbuild.config.js`
4. `mpbuild.config.mjs`

生产环境(没有 tsx 等 TS 运行时)无法 import `.ts` / `.mts` 配置时,会跳过该文件并告警 `CONFIG_TS_SKIPPED`,继续尝试下一个;全部不可加载则以 `CONFIG_TS_SKIPPED` 报错。因此生产环境建议使用 `.js` 或 `.mjs`。

> [!WARNING]
> v5 **不再读取 4.x 的 `mpb.config.js`**。目录下只有 `mpb.config.js` 而没有任何 `mpbuild.config.*` 时,`mpb` 报 `LEGACY_CONFIG` 并以退出码 2 退出。请改名为 `mpbuild.config.mjs`,并按 [从 4.x 迁移](#/migration/from-v4) 调整字段。

## 完整示例

仓库内的 `example/demo` 是一个完整的 v5 示例工程(`mpbuild.config.mjs` + `entry.js` + `src/`),覆盖别名、router 形态 entry、子仓库、SCSS 插件等用法;`example/projects/one` 与 `example/projects/two` 是它引用的两个子仓库示例。
