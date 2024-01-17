# 文档站重建 + README 重写 + GitHub About 更新 Spec

日期：2026-08-21
状态：已决策，可直接实施
范围：mpbuild 5.0 发布后的对外门面。三件事：重建文档站（Vite + React + TS，部署 GitHub Pages）、重写根 README.md、更新 GitHub About。
事实来源：v5 代码库侦察报告（下称「报告一」）、旧站/GitHub 状态侦察报告（下称「报告二」）。**v5 代码库是文档内容的唯一事实依据；旧站（4.x / dumi）只提供 IA 骨架与文案风格参考，严禁照抄内容。**

## 1. 背景

- mpbuild 5.0.0 于 2026-08-20 发布，是图驱动整体重写。npm 包从无作用域的 `mpbuild` 改为 `@mpbuild/core` + `@mpbuild/cli`（CLI 命令 `mpb`），Node >= 20，纯 ESM。
- v5 重构删除了旧 dumi 文档站源码（原 `packages/website/`），但 `gh-pages` 分支和 GitHub Pages 仍在，旧站（内容是 4.x 的）至今仍在线，对 v5 用户构成误导。
- `.github/workflows/github-pages.yml` 仍存在但被 `if: false` 禁用（job 名 "disabled: website package removed"）。
- 根 README.md 结构潦草：无文档站链接、徽章少、无特性概览，配置一节像参考文档。
- GitHub About：description 仅「小程序构建工具」；topics 含已废弃的 babel/postcss；homepageUrl `https://ximing.github.io/mpbuild/` 仍指向旧站。

## 2. 目标与非目标

### 2.1 目标

1. 在仓库根 `website/` 从零搭建文档站：Vite + React 18 + TypeScript，中文内容，内容为 v5 事实，部署到 `gh-pages` 分支，线上地址 `https://ximing.github.io/mpbuild/`（base path `/mpbuild/`）。
2. 重写根 `README.md`：专业、克制、以快速开始为导向，链接到文档站与迁移指南。
3. 更新 GitHub About：description、topics、homepageUrl。
4. 改造 `.github/workflows/github-pages.yml`：push master 且 `website/**` 变更时自动构建部署。

### 2.2 非目标

- 不使用 dumi / vuepress / vitepress / 任何现成文档框架。用户明确指定 Vite + React + TS 自建。
- 不做英文版文档。站内文案全中文（README 同样中文为主）。
- 不做全文搜索（algolia / 本地索引均不做）。13 个内容页靠导航即可。
- 不做 SSR / SSG 预渲染。纯 SPA。
- 不更新 Gitee 镜像站（`mpbuild.gitee.io`）。`sync.yml` 保持现状；README 中**移除**对 Gitee 镜像的引用（其内容停留在 4.x）。是否停用 `sync.yml` 由用户另行决定，本 Spec 不动它。
- 不修改 `example/demo` 的 4.x 遗留文件（`mpb.config.js`、4.x 的 package.json scripts 等）。文档引用示例时只引用 v5 事实（`mpbuild.config.mjs`、`entry.js`、`src/`），禁止照抄遗留文件内容。
- 不改 v5 源码行为。文档只描述现状，不为「理想行为」写文档。

## 3. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 文档站位置 | 仓库根 `website/`，**独立 package**（不加入任何 pnpm workspace） | 根 workspace 是 pnpm 7 的 4.x 遗留，v5 workspace 是 pnpm 9；文档站自带 lockfile 最干净，CI 里单独 install |
| 技术栈 | Vite ^6 + React ^18.3 + TypeScript ~5.6 | 用户指定 |
| Markdown 加载 | 内容文件放 `website/content/`，`import.meta.glob` + `?raw` 加载，前端用 react-markdown 渲染 | 无构建期代码生成，内容增删即页面增删 |
| 代码高亮 | rehype-highlight（highlight.js），浅色/深色各载一套主题 | 成熟、零配置语言覆盖够（js/ts/json/css/xml/shell）；shiki 体积与异步成本高，不值得 |
| 路由 | **hash 路由**（`#/guide/getting-started` 形态） | GitHub Pages 项目页无服务端 rewrite；history 路由需要 404.html 复制 index.html 的 hack 且对 base path 敏感。hash 路由零部署假设、深链天然可用。URL 美观让位于可靠性 |
| 主题 | CSS 变量实现浅色/深色，默认跟随系统，手动切换存 localStorage | 无 UI 框架，纯 CSS，克制 |
| UI 框架 | 不用（无 antd/mui/tailwind） | 页面形态简单（首页 + 文档布局），自写 CSS 约 400 行可覆盖，避免设计语言被框架绑架 |
| 部署 | 改造现有 `github-pages.yml`，JamesIves/github-pages-deploy-action@v4 推 `website/dist` 到 `gh-pages` | 使用 `GITHUB_TOKEN` + `permissions: contents: write`（原 `ACCESS_TOKEN` PAT 已失效，首跑认证失败后按预案切换） |
| 内容语言 | 中文 | 与旧站、README、CHANGELOG 一致 |

## 4. 文档站

### 4.1 信息架构（IA）

顶部导航：`指南` `插件` `参考` `迁移` `FAQ` + GitHub 仓库链接 + 主题切换。
左侧边栏按当前分区显示组内页面。完整页面清单（13 个内容页 + 首页）：

```
/                              首页（hero + features + 快速开始片段）
#/guide/getting-started        快速开始
#/guide/entry                  entry 与路由
#/guide/conditional-compilation 条件编译与多态
#/guide/subpackages            分包与子仓库
#/guide/npm                    npm 支持
#/guide/watch-cache            watch 与缓存
#/plugins/api                  插件 API
#/plugins/official             官方插件
#/reference/config             配置参考（完整配置项表）
#/reference/cli                CLI 参考
#/reference/diagnostics        诊断码
#/reference/unsupported        暂不支持
#/migration/from-v4            从 4.x 迁移
#/faq                          FAQ
```

侧边栏分组：
- **指南**：快速开始 / entry 与路由 / 条件编译与多态 / 分包与子仓库 / npm 支持 / watch 与缓存
- **插件**：插件 API / 官方插件
- **参考**：配置参考 / CLI 参考 / 诊断码 / 暂不支持
- **迁移**：从 4.x 迁移
- **其他**：FAQ

每个 markdown 文件带 frontmatter（`title`、`group`、`order`），站点据此生成导航（见 4.3）。

### 4.2 各页面内容大纲与事实来源

「来源」列中：「报告一 §n」指侦察报告章节；文件路径为实施时必须亲自阅读核对的代码（以代码为准，报告是索引）。

| 路径 | 标题 | 内容大纲 | 来源 |
|---|---|---|---|
| `/` | 首页 | 见 4.5 | 报告一 §0/§1/§4 |
| `content/guide/getting-started.md` | 快速开始 | 要求（Node >= 20）；安装 `@mpbuild/cli`；最小 `mpbuild.config.mjs`（src/entry/output）；`mpb build` / `mpb dev`；指向 example/demo 作为完整示例；配置文件名优先级提示 | 报告一 §0/§2/§3；`v5/packages/cli/src/index.ts`、`example/demo/mpbuild.config.mjs`、`example/demo/entry.js` |
| `content/guide/entry.md` | entry 与路由 | 经典形态 `{pages, subPackages:[{root,pages,independent?}]}`；router 形态 `{router:[{root, pages:{逻辑页:源码位置}, independent?}]}` 与 `virtual:app.json`；顶层键透传进 app.json；页面/组件 JSON 可用 `*.config.js`（隔离执行、剥 `.config` 与 infix、失败报 `CONFIG_JS_INVALID`） | 报告一 §3；`v5/packages/core/src/config/entry.ts`、`example/demo/entry.js` |
| `content/guide/conditional-compilation.md` | 条件编译与多态 | `platform` 决定文件级 infix（`name.wx.js` 优先、输出剥 infix）与 ifdef 上下文；`ifdef.tokens`；块级 `@ifdef/@ifndef/@if/@endif`（JS/WXSS 用注释、WXML 用 HTML 注释）；`ifdef.blockcode` 默认 true | 报告一 §3/§4；core 中 ifdef 相关源码（`v5/packages/core/src/compile` 下，实施时定位） |
| `content/guide/subpackages.md` | 分包与子仓库 | 多源染色归属模型（owner = main / 分包名 / shared）；`subPackage.shared`（`duplicate`/`main`）；独立分包越界 `INDEPENDENT_PACKAGE_EDGE`；`PATH_COLLISION` 与 hash 后缀；`CYCLE` warning；`projects: [{name, src, alias}]` 子仓库（取代 4.x SubProjectPlugin；仓内禁用 `/` 开头绝对路径，报 `ABS_PATH_IN_SUBPROJECT`；子仓库先查 `projects[].alias`） | 报告一 §3/§4；`example/projects/one|two`、core plan/graph 源码 |
| `content/guide/npm.md` | npm 支持 | 入口字段优先级 miniprogram → browser → main → module；输出到 `output.npm`（默认 `dist/npm`）；node_modules script 内置 npmCompat SWC 变换（**无需用户加插件**）；watch 精确监听已入图 npm 文件 | 报告一 §4；`v5/packages/core/src/plugin/npm-compat.ts` |
| `content/guide/watch-cache.md` | watch 与缓存 | `mpb dev` 行为（首次构建 + watch，诊断到 stderr 后保持进程）；chokidar 80ms debounce；内容 hash 增量建图；topologyChanged / planChanged 谓词与差量 emit；配置变更触发 `reloadConfig` 全量；磁盘缓存位置 `node_modules/.cache/mpbuild`、`--no-cache`、4096 文件按 mtime GC | 报告一 §4；core watch 源码（`v5/packages/core/src/watch`） |
| `content/plugins/api.md` | 插件 API | `interface Plugin { name; load?(id, ctx): string\|void; generate?(file, ctx): file\|file[]\|void }`；load 第一个返回字符串者胜；与 Tapable / 4.x 插件 API **不兼容**（显著警示框）；`plugins` 配置项 | 报告一 §4；`v5/packages/core/src/types.ts`、`src/plugin/` |
| `content/plugins/official.md` | 官方插件 | 4 个插件各一节：`legacyScss()`（postcss-scss 类 SCSS 支持）、`projectConfig({projectname, appId, setting?})`（不覆盖已有文件）、`copy(patterns, opts?)`（自实现 glob，`**` 含零层目录）、npmCompat（emit 内置，非用户侧插件，说明即可） | 报告一 §4；`v5/packages/core/src/plugin/{legacy-scss,project-config,copy,npm-compat}.ts` |
| `content/reference/config.md` | 配置参考 | 完整配置项表：每项含「配置项 / 类型 / 默认值 / 说明」。覆盖报告一 §3 全部条目（src、entry、target、platform、output.dir/npm/clean/componentRelative、resolve.alias、resolve.extensions、compile.js.target/module、compile.css.lightningcss、compile.minify、subPackage.shared、projects、ifdef.tokens/blockcode、plugins）；另含配置文件解析规则（优先级 ts→mts→js→mjs；不读 `mpb.config.js` 报 `LEGACY_CONFIG` 退出码 2；生产环境 .ts/.mts 无法 import 时跳过告警 `CONFIG_TS_SKIPPED`，建议生产用 .js/.mjs；`defineConfig`） | 报告一 §3；**必须逐字段核对** `v5/packages/core/src/config/schema.ts` |
| `content/reference/cli.md` | CLI 参考 | `mpb build`（`--minify`、`--no-cache`）、`mpb dev`、`mpb --watch` 与 `mpb build --watch` 的等价分支（后者不应用 `--minify`）、`mpb analyze`（写 `<output.dir>/mpbuild-analyze.json`）、`mpb inspect graph`；退出码表（0 成功 / 1 error 级诊断 / 2 配置错误） | 报告一 §2；`v5/packages/cli/src/index.ts` |
| `content/reference/diagnostics.md` | 诊断码 | 16 个诊断码各一节：码、级别（error/warning）、含义、常见原因、处置建议。清单：RESOLVE_MISS、ABS_PATH_IN_SUBPROJECT、CONFIG_NOT_FOUND、CONFIG_TS_SKIPPED、LEGACY_CONFIG、ENTRY_LOAD、CONFIG_JS_INVALID、MISSING_APP_JS、MISSING_PAGE_JS、UNKNOWN_TARGET、TRANSFORM_FAIL、UNSUPPORTED_PREPROCESSOR、CYCLE、INDEPENDENT_PACKAGE_EDGE、PATH_COLLISION、COPY_GRAPH_UNSUPPORTED | 报告一 §4；`v5/packages/core/src/diagnostic/`（逐码核对触发条件与级别） |
| `content/reference/unsupported.md` | 暂不支持 | 首发不做清单：抖音/头条 adapter、HMR、JS bundle、workers/sitemap/tabBar 图标入图、WXML image src 抽取、json extends、minify include/exclude、完整 PluginContext、`copy({graph:true})`、用户侧 `virtual:` API、包体积强校验。每条一句话说明现状与替代做法（如有） | 报告一 §6 末段；架构 spec `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` §2.2 |
| `content/migration/from-v4.md` | 从 4.x 迁移 | 以 `docs/migration-v5.md` 为底稿提炼：包名迁移（mpbuild → @mpbuild/cli）、配置文件改名与字段改名对照表（output.path→output.dir、alias→resolve.alias、optimization.minimize→compile.minify、output.component.relative→output.componentRelative）、loader 链废弃、插件 API 全新、PolymorphismPlugin→platform+ifdef、SubProjectPlugin→projects、`new MPB().run()`→`createCompiler(config).run()`、不再提供 resolveOutside、Node>=20 纯 ESM。**`require('./x.json')` 不再内联**用显著警示框单独突出 | `docs/migration-v5.md`、`CHANGELOG.md`；报告一 §6 |
| `content/faq.md` | FAQ | 8–12 条，例如：支持抖音/头条吗（不支持，TargetAdapter 可自定义，指 `__tests__/__fixtures__/fake-mini`）；为什么我旧项目的 `mpb.config.js` 报退出码 2；为什么 `require('./x.json')` 产物变了；SCSS 怎么用（legacyScss）；生产环境配置文件为什么建议 .js/.mjs；`--minify` 与 `compile.minify` 关系；如何看依赖图（analyze / inspect graph） | 报告一全文提炼 |

**写作纪律（实施 agent 必须遵守）：**
- 所有行为性描述以 v5 代码为准。报告一是索引，写每个页面前必须打开「来源」列的代码文件核对。
- 每个 breaking change 在**首次出现它的页面**用警示块（`> [!WARNING]`）标注，并在迁移页汇总。
- 示例代码只取自 `example/demo/mpbuild.config.mjs`、`example/demo/entry.js`、`example/demo/src/`、`example/projects/`。**禁止**引用 `example/demo/mpb.config.js`、`example/demo/package.json` 的 scripts、`example/demo/babel.config.js`（均为 4.x 遗留）。
- 不出现「loader」「Tapable」「Babel」「PostCSS（作为默认引擎）」等 4.x 概念，除非在迁移页作为对照。

### 4.3 技术方案

#### 目录结构

```
website/
  package.json            # 独立 package，自带 pnpm-lock.yaml，不进任何 workspace
  pnpm-lock.yaml
  .gitignore              # node_modules, dist
  tsconfig.json
  vite.config.ts          # base: '/mpbuild/'，plugin-react，content/ 加入 watch
  index.html              # <html lang="zh-CN">，首屏主题初始化内联脚本（防闪烁）
  content/                # markdown 内容（IA 见 4.1）
    guide/
      getting-started.md
      entry.md
      conditional-compilation.md
      subpackages.md
      npm.md
      watch-cache.md
    plugins/
      api.md
      official.md
    reference/
      config.md
      cli.md
      diagnostics.md
      unsupported.md
    migration/
      from-v4.md
    faq.md
  src/
    main.tsx
    App.tsx               # 路由分发 + 布局
    router.ts             # 极简 hash 路由：useHashRoute() hook（listen hashchange）
    content.ts            # import.meta.glob 加载 + frontmatter 解析 + 导航模型
    components/
      Layout.tsx          # 顶栏 + 侧栏 + 内容区
      Sidebar.tsx
      Markdown.tsx        # react-markdown 封装（gfm + 高亮 + 链接改写）
      HomePage.tsx        # hero + features
      ThemeToggle.tsx
    styles/
      base.css            # CSS 变量（浅/深两套）、排版、布局
      hljs-light.css      # highlight.js 浅色主题（从 highlight.js/styles 拷贝内联）
      hljs-dark.css       # 深色主题，限定在 [data-theme="dark"] 下
```

#### 依赖清单（website/package.json）

```jsonc
{
  "name": "mpbuild-website",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.10.0"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

说明：
- 不引 react-router。hash 路由用一个约 40 行的 hook（解析 `location.hash`、监听 `hashchange`、滚动恢复）即可，减少依赖面。
- 不引 gray-matter（浏览器端有 Buffer 依赖问题）。frontmatter 自写约 20 行解析器：仅支持 `key: value` 平铺字段（title/group/order），内容自控，够用。
- `rehype-highlight` 自动检测语言；markdown 代码块统一显式标注语言（```ts / ```json / ```css / ```html / ```bash）。

#### Markdown 加载管线

1. `src/content.ts`：
   ```ts
   const modules = import.meta.glob('../content/**/*.md', {
     query: '?raw', import: 'default', eager: true,
   }) as Record<string, string>;
   ```
   （`query: '?raw'` 写法在 Vite 5.2+ 与 Vite 6 均有效；不要用已废弃的 `as: 'raw'`。）
2. 每个文件解析 frontmatter → `{ title, group, order, body }`；按路径推导路由 id（如 `guide/getting-started`）。
3. 导出导航模型：`NAV: [{ group: '指南', items: [{id, title, path}] }, ...]`，group 顺序在代码里显式定义（指南 → 插件 → 参考 → 迁移 → 其他），组内按 frontmatter `order` 排序。
4. `Markdown.tsx` 用 `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>` 渲染 `body`；自定义 `a` 渲染器：站内 `#/...` 链接与相对 `.md` 链接改写成 hash 路由链接，外链加 `target="_blank" rel="noreferrer"`。
5. 每个页面渲染后 `document.title = `${title} - mpbuild``；滚动到顶部（或 hash 内锚点）。

#### 样式与设计语言

- 目标气质：现代、克制、可读性优先。参考 VitePress / 现代 SaaS 文档站，但不模仿特定品牌。
- 排版：正文 16px / 行高 1.75 / 内容栏最大宽度 760px；代码 14px，等宽字体栈 `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`；中文正文字体栈 `-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`。
- 色彩：CSS 变量定义 `--bg / --bg-soft / --text / --text-soft / --border / --accent / --code-bg` 等约 10 个 token；accent 用一个克制的品牌色（建议绿/青系，与微信生态有弱联想即可，实施者定具体色值但深浅两模式都要过对比度）。深色模式不是简单反色，代码块背景与边框单独调。
- 主题机制：`<html data-theme="light|dark">`；`index.html` 内联脚本在首帧前读 localStorage / `prefers-color-scheme` 设置，避免闪烁；`ThemeToggle` 切换并持久化。hljs 两套主题分别限定在 `:root:not([data-theme="dark"])` 与 `[data-theme="dark"]` 选择器下。
- 响应式：`>=1024px` 三栏（侧栏 260px + 内容）；`<1024px` 侧栏抽屉化（汉堡按钮）；表格与代码块 `overflow-x: auto`，页面 body 永不横向滚动。
- markdown 内的 `> [!WARNING]` / `> [!NOTE]`（GFM alert 语法，remark-gfm ^4 支持）渲染为带左边条与图标的提示块。

### 4.4 首页设计

- **Hero**：左侧大标题「mpbuild」+ 一句话定位「图驱动的微信小程序构建工具」+ 一句补充（SWC + Lightning CSS，精准分包，增量缓存）；两个按钮「快速开始 →」「GitHub」。右侧或下方一个终端风格代码块展示三条命令（`npm i -D @mpbuild/cli` / 最小配置 / `mpb build`）。
- **Features 网格**（8 个，全部按 v5 事实）：
  1. 图驱动架构 — 建图 → 归属分析 → Output Plan → 变换写盘，四段流水线职责清晰
  2. SWC + Lightning CSS — 无 Babel/PostCSS 负担，原生级速度
  3. 精准分包 — 多源染色归属模型，shared 模块复制或提主包可配
  4. 增量 watch + 磁盘缓存 — 内容 hash 增量建图，差量写盘
  5. 条件编译 — 文件级多态 infix + 块级 @ifdef，编译时拆分多端代码
  6. npm 支持 — 内置 npmCompat 变换，海量 npm 包开箱即用
  7. 插件体系 — load/generate 两段钩子 + 官方 SCSS / copy / projectConfig 插件
  8. 可观测 — `mpb analyze` 产物分析 + `mpb inspect graph` 逐节点图检查 + 16 个语义化诊断码
- **页脚**：MIT License · Copyright (c) 2019-present, ximing + GitHub 链接。
- 首页文案中不出现任何 4.x 概念（Babel/Postcss/loader/拓展机制等旧 features 文案全部废弃，仅保留「NPM」「条件编译」「依赖分析→可观测」三类主题的精神）。

### 4.5 部署 workflow

改造 `.github/workflows/github-pages.yml`（整体重写文件内容，不保留 `if: false` 的残留结构）：

```yaml
name: Deploy Website to GitHub Pages
on:
  push:
    branches: [master]
    paths:
      - 'website/**'
      - '.github/workflows/github-pages.yml'
  workflow_dispatch: {}
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    defaults:
      run:
        working-directory: website
    concurrency:
      group: gh-pages
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v4
        with:
          # 从 website/package.json 的 packageManager 字段读版本(避免与仓库根的 pnpm@7 声明冲突)
          package_json_file: website/package.json
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: website/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: JamesIves/github-pages-deploy-action@v4
        with:
          # 注意:v4 的输入名为小写(v3 的 ACCESS_TOKEN/BRANCH/FOLDER 大写风格已废弃)
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: gh-pages
          folder: website/dist
```

要点：
- `vite.config.ts` 必须 `base: '/mpbuild/'`，否则部署后资源 404。本地 `pnpm dev` 也走同一 base（Vite 自动处理，无需条件判断）。
- JamesIves action 默认在部署目录生成 `.nojekyll`（避免 `_assets` 类路径被 Jekyll 吞掉），确认不关闭该行为。
- 首次部署会用新站**整体替换** gh-pages 上仍在服务的旧 dumi 站——这是预期行为（旧站内容是 4.x，继续在线才是问题）。
- 触发条件不含 v5 源码路径；文档内容更新都发生在 `website/**`。若后续希望「改 v5 代码也重建文档」再加 paths。

## 5. README 重写规格

文件：`/Users/ximing/project/mygithub/mpbuild/README.md`，全量重写，中文，GitHub 渲染优先（不用 HTML 花哨布局，居中大标题可用 `<p align="center">` 适度使用）。章节结构与每章要点：

1. **标题区**：`mpbuild` + 一句话定位「图驱动的微信小程序构建工具」。
2. **徽章**（一行）：npm version（`@mpbuild/cli`）、node >= 20、license MIT、CI（指向仓库现有主 CI workflow；若无通用 CI badge 则用 GitHub Pages deploy workflow 的 badge 亦可，实施时核对 `.github/workflows/` 下实际存在的 workflow 名）。保留 all-contributors 徽章（若 contributors 区块保留）。
3. **简介**：3–4 句。v5 是图驱动重写；`mpbuild@4` 已冻结；当前包为 `@mpbuild/core` / `@mpbuild/cli`，命令 `mpb`。
4. **特性**：6–8 条 bullet（与首页 features 同源，可精简）：图驱动流水线、SWC + Lightning CSS、精准分包、增量 watch + 磁盘缓存、条件编译与多态、npm 支持、插件 API + 官方插件、可观测诊断。
5. **要求**：Node.js >= 20；包为纯 ESM。
6. **快速开始**：安装 → 最小 `mpbuild.config.mjs` → `mpb build` / `mpb dev`。代码块控制在 30 行内。详细配置指向文档站「配置参考」。
7. **文档**：文档站链接 `https://ximing.github.io/mpbuild/`；单列常用入口链接（快速开始 / 配置参考 / CLI 参考 / 插件 / 诊断码 / FAQ）。**不再出现 Gitee 镜像链接。**
8. **从 4.x 迁移**：一段警示式说明（包名变更、配置文件改名、`require('./x.json')` 不再内联等 3–4 个最重要的 breaking）+ 指向文档站迁移页与 `docs/migration-v5.md`。
9. **包与仓库布局**：简短表格 `@mpbuild/core`（`v5/packages/core`，图驱动编译器核心）/ `@mpbuild/cli`（`v5/packages/cli`，命令 `mpb`）；说明 v5 代码在 `v5/` 独立 pnpm workspace。
10. **生态链接**：CHANGELOG.md、CONTRIBUTING.md、Issue/PR 模板入口。
11. **License**：MIT。
12. **Contributors**：保留现有 all-contributors 区块原样。

**删除**：旧「冻结声明」改写进简介（措辞更新为 4.x 已冻结、v5 已发布）；旧「配置」一节的参考文档式内容全部移到文档站；旧「发布流程」「命令」细节移到文档站 CLI 参考。

## 6. GitHub About

- **description（最终文案）**：
  `图驱动的微信小程序构建工具 / Graph-driven WeChat miniprogram build tool（SWC · Lightning CSS · 精准分包 · 增量缓存）`
  （中英双语是因为仓库受众含英文浏览者；括号内四个关键词全部对应 v5 真实能力。）
- **topics（最终清单，整体替换现有）**：
  `weapp`、`wechat-miniprogram`、`miniprogram`、`build-tool`、`swc`、`lightning-css`、`typescript`、`npm`
  移除 `babel`、`postcss`（v5 不再使用）、保留语义的 `miniprogram`/`build` 归并进上表（`build` 太泛，用 `build-tool`）。
- **homepageUrl**：保持 `https://ximing.github.io/mpbuild/`（新站部署后地址不变，正是我们要的效果）。
- **顺手项（建议纳入实施，工作量极小）**：给 `v5/packages/core/package.json` 与 `v5/packages/cli/package.json` 补 `homepage: "https://ximing.github.io/mpbuild/"`、`repository`、`keywords`（同 topics 语义）。这会让 npm 页面徽章与文档站互链，且 README 的 npm badge 点击体验更好。不改 version、不触发发布。

执行方式：`gh repo edit ximing/mpbuild --description "..." --homepage "..." --add-topic ... --remove-topic ...`（或 `gh api` 整体 PUT topics）。实施 agent 若无可写凭据，把确切命令交给用户执行。

## 7. 验收标准

**文档站**
1. `cd website && pnpm install && pnpm build` 一次通过（含 `tsc --noEmit`），`pnpm preview` 可访问。
2. 4.1 列出的 14 个路由（含首页）全部可渲染，无空白页、无 console error。
3. 每个内容页渲染出标题、正文、代码高亮；含 warning 块的页面警示样式正确。
4. 浅色/深色切换正常，刷新后主题保持，首屏无闪烁。
5. 移动端宽度（<=768px）侧栏抽屉可用，无横向滚动。
6. 站内所有链接（导航、正文内链、README 指向的锚点）有效；外链全部 `target="_blank"`。
7. `vite build` 产物中资源路径均以 `/mpbuild/` 开头（grep dist/index.html 验证 base 生效）。
8. push 到 master（或 workflow_dispatch 手动触发）后 workflow 绿，gh-pages 分支更新，`https://ximing.github.io/mpbuild/` 打开为新站首页（不再是旧 dumi 站）。
9. 内容抽查：`配置参考` 页的配置项与 `v5/packages/core/src/config/schema.ts` 逐字段一致；`诊断码` 页 16 个码齐全；迁移页含 `require('./x.json')` 警示块。

**README**
10. GitHub 仓库首页渲染正常：徽章全部解析（无 broken image）、表格不爆宽、代码块高亮正常。
11. README 中所有链接（文档站、迁移、CHANGELOG、CONTRIBUTING）可点通；无 Gitee 镜像链接；无 4.x 命令/配置残留。

**GitHub About**
12. description / topics / homepageUrl 与 §6 一致（`gh repo view ximing/mpbuild --json description,repositoryTopics,homepageUrl` 核对）。

## 8. 风险与注意点

1. **4.x 内容污染（最大风险）**：旧站文案、`example/demo` 遗留文件、报告二中旧 IA 的分组（内置 loader / 内置插件 / loader 自定义）都属于 4.x 世界。实施时每一页都要问：「这句话在 v5 代码里有证据吗？」没有就删。
2. **breaking changes 必须突出**：`require('./x.json')` 不再内联、不读 `mpb.config.js`（退出码 2）、插件 API 不兼容、字段改名——这些是老用户升级的第一批坑，文档里用警示块而不是普通段落。
3. **example/demo 的 scripts 是 4.x 的**：`example/demo/package.json` 的 scripts、`mpb.config.js`、`babel.config.js` 均不可引用。快速开始的示例命令以 `@mpbuild/cli` 的 `mpb` 为准。
4. **旧站被替换是不可逆的对外变更**：首次部署后 `ximing.github.io/mpbuild/` 立刻变新站。部署前在本地 `pnpm preview`（带 base `/mpbuild/`）完整走查一遍；建议首次部署用 `workflow_dispatch` 手动触发，而不是等一次碰巧的 push。
5. **Gitee 镜像站会进一步过时**：`mpbuild.gitee.io` 停在 4.x 且本 Spec 不处理。README 移除其链接即可；若用户在意，可后续在 `sync.yml` 停用 Gitee Pages 部署（不在本次范围）。
6. **根 package.json / .nvmrc 滞后**（pnpm 7、Node 14）：不在本次范围，但实施 agent 跑 v5 相关命令时注意用 Node >= 20；文档站是独立 package，不受根 workspace 影响，这正是选择独立 package 的原因。
7. **secret 依赖（已落地）**：首跑证实 `ACCESS_TOKEN` PAT 已失效（git push 认证失败，exit 128），按本预案切换为 `GITHUB_TOKEN` + `permissions: contents: write`（JamesIves v4 原生支持，git 身份用默认 bot，不再需要 `GIT_CONFIG_NAME` / `GIT_CONFIG_EMAIL`）。
8. **README 与文档站内容同源**：特性列表、快速开始代码块在两处各写一遍，注意保持一致（以文档站为准，README 是精简版）。
