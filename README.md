# mpbuild

微信小程序图驱动构建器。5.x 实现位于 `v5/`，npm 包是 [`@mpbuild/core`](https://www.npmjs.com/package/@mpbuild/core) 与 [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli)（都是 `2.0.0`）。

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![NPM Version](https://img.shields.io/npm/v/@mpbuild/cli.svg?style=flat)](https://www.npmjs.com/package/@mpbuild/cli)

命令行是 `mpb`。**不会**再发布名为 `mpbuild` 的 5.0；历史上的 `mpbuild@4` 已冻结，源码已移出本仓库。

## 要求

- Node.js `>=20`

## 安装

```bash
pnpm add -D @mpbuild/cli
```

## 命令

```bash
mpb build
mpb build --no-cache
mpb build --minify
mpb dev
mpb analyze
mpb inspect graph
```

`--no-cache` 跳过磁盘 transform 缓存（目录 `node_modules/.cache/mpbuild`）。`output.clean` 不会删这个目录。`--minify` 覆盖 `compile.minify: true`。

`--watch` 是 `dev` 的别名。退出码：0 成功；1 含 error；2 配置错误。`mpb dev` 把首次构建和每次 watch tick 的诊断打印到 stderr（与 `mpb build` 相同），打印后保持进程。已入图文件的 chokidar `add` 当作内容变更（编辑器 unlink 再 add 会更新 dest）。已入图的 npm 文件会单独加入 watch，不会整棵监听 `node_modules`。

## 配置

项目根使用 `mpbuild.config.ts` / `mpbuild.config.mts` / `mpbuild.config.js` / `mpbuild.config.mjs`（`export default` 或 `module.exports`）。加载顺序：`mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js` → `mpbuild.config.mjs`（**.js 在 .mjs 前**，已有 `.js` 项目行为不变）。生产 bin 不能加载 `.ts` / `.mts` 时会 **跳过并诊断 `CONFIG_TS_SKIPPED`**，继续尝试 `.js` / `.mjs`；若只有无法加载的 `.ts` 则失败。不要同时留下会误导的 leftover `.ts` / `.mts`，生产请用 `.js` 或 `.mjs`，仍建议删掉无法加载的 TypeScript 配置。

**不读取** `mpb.config.js`。

```js
import { copy, defineConfig, legacyScss, projectConfig } from '@mpbuild/core'

export default defineConfig({
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'my-app', appId: 'touristappid' }),
    copy('src/tabbar.png'),
  ],
})
```

`copy('src/**/*.png')` 能匹配 `src/tabbar.png`（`**` 含零层目录）；copy 产物在 watch tick 中保留，不会每拍删掉。wxss/css 里的 `url('./x.png')` 会入图并写出到 dist；忽略 `data:`、空、绝对 URL。WXML `<image src>` 仍不抽。

该示例需要 `package.json` 的 `"type": "module"`，或把文件命名为 `mpbuild.config.mjs`。无插件的字段配置仍可用 CJS `module.exports`（不要 `require('@mpbuild/core')`）。

## 插件（2.0.0 承诺）

公开 `Plugin` 只有 `name` + `load?` + `generate?`。官方插件：`legacyScss()`、`projectConfig()`、`copy()`。`copy(patterns)` 默认 extras；`copy({ graph: true })` 未实现。完整 PluginContext 是以后的版本。

从 4.x 迁移见 [docs/migration-v5.md](docs/migration-v5.md)。

## 文档

- 迁移：[docs/migration-v5.md](docs/migration-v5.md)
- 架构规格：[docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md](docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md)
- 包说明：[v5/packages/cli/README.md](v5/packages/cli/README.md)、[v5/packages/core/README.md](v5/packages/core/README.md)

冷构建相对 4.x 快 5 倍是志向指标，不进 CI fail。

## 发布

不要在本地执行 `npm publish` 或 `changeset publish` 来发 `@mpbuild/*`。tag 必须是 `v2.0.0`。给仓库打并 push `v2.0.0` 后，[`.github/workflows/publish-mpbuild.yml`](.github/workflows/publish-mpbuild.yml) 会在 GitHub Actions 里对 `@mpbuild/core` 与 `@mpbuild/cli` 执行 `pnpm publish`。

在 GitHub Settings → Secrets and variables → Actions 添加名为 `NPM_TOKEN` 的 repository secret（npm 登录 token）。不要把 token 写进仓库。

用 `git push --force-with-lease origin master` 推 rewrite，**不要 merge origin 的 Snyk / 4.x `packages/mpbuild`**。`V1` 已备份 4.x。

## 仓库

实现只在 `v5/packages/core` 与 `v5/packages/cli`。金样在 `example/demo`（不要到 `v5/packages/example` 找）。

## License

[MIT](LICENSE)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://ximing.ren"><img src="https://avatars.githubusercontent.com/u/4659887?v=4?s=100" width="100px;" alt=""/><br /><sub><b>席铭</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/commits?author=ximing" title="Code">💻</a> <a href="#blog-ximing" title="Blogposts">📝</a> <a href="https://github.com/ximing/mpbuild/commits?author=ximing" title="Documentation">📖</a> <a href="#example-ximing" title="Examples">💡</a> <a href="#maintenance-ximing" title="Maintenance">🚧</a></td>
    <td align="center"><a href="https://github.com/yozosann"><img src="https://avatars.githubusercontent.com/u/19776974?v=4?s=100" width="100px;" alt=""/><br /><sub><b>yozosann</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3Ayozosann" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=yozosann" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/liujin10"><img src="https://avatars.githubusercontent.com/u/18552493?v=4?s=100" width="100px;" alt=""/><br /><sub><b>liujin123456</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3Aliujin10" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=liujin10" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ShiningDan"><img src="https://avatars.githubusercontent.com/u/23012618?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yuchen</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3AShiningDan" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=ShiningDan" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.
Contributions of any kind welcome!
