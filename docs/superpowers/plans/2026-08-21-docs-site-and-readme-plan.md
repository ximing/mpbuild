# 文档站重建 + README 重写 + GitHub About 更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 Spec 重建对外门面：仓库根 `website/` 从零搭 Vite + React 18 + TS 文档站（hash 路由、markdown 内容管线、浅/深主题、13 个内容页 + 首页），改造 `github-pages.yml` 部署到 gh-pages，全量重写根 `README.md`，更新 GitHub About（description/topics/homepageUrl），顺手补两个 v5 包的 package.json 元数据。

**Architecture:** `website/` 是**独立 package**（自带 lockfile，不进任何 pnpm workspace）。内容在 `website/content/**/*.md`，`import.meta.glob` + `?raw` 加载，自写 20 行 frontmatter 解析，react-markdown + remark-gfm + rehype-highlight 渲染。hash 路由（`#/guide/getting-started`），不引 react-router、不引 UI 框架。部署用 JamesIves/github-pages-deploy-action@v4 推 `website/dist` 到 `gh-pages`。

**Tech Stack:** Vite ^6 + React ^18.3 + TypeScript ~5.6（website/）；Node >= 20 跑所有 website 与 v5 命令（**默认 shell 是 Node 14，先 `eval "$(fnm env)" && fnm use 22`**）。

**Spec:** `docs/superpowers/specs/2026-08-21-docs-site-and-readme-spec.md`（下称 Spec）。所有任务描述引用 Spec 章节；实施 agent 必须先读 Spec 对应章节再动手。**v5 代码库是文档内容的唯一事实依据；旧站（4.x / dumi）严禁照抄。**

## Global Constraints

- **每个实施 agent 只许创建/修改自己任务的「产出」文件清单内的文件。** 各任务文件所有权互不重叠（见「任务总览与依赖」），禁止越界改别的任务的文件。
- **禁止照抄 4.x 遗留**：旧站文案、`example/demo/mpb.config.js`、`example/demo/package.json` 的 scripts、`example/demo/babel.config.js` 均不可引用。示例代码只取自 `example/demo/mpbuild.config.mjs`、`example/demo/entry.js`、`example/demo/src/`、`example/projects/`。
- 文档中不出现「loader」「Tapable」「Babel」「PostCSS（作为默认引擎）」等 4.x 概念，除非在迁移页作为对照。
- 每个 breaking change 在**首次出现它的页面**用 `> [!WARNING]` 警示块标注，并在迁移页汇总。`require('./x.json')` 不再内联必须单独突出。
- `website/` 不进根 `pnpm-workspace.yaml`，不进 `v5/` workspace；不改根 `package.json` 的 name/version/scripts；不改 v5 源码行为；不动 `sync.yml`（Gitee 镜像不在本次范围）。
- README 中**移除** Gitee 镜像链接；保留 all-contributors 区块原样。
- **Git 推送不写进 implementer Task。** 禁止在 Task A–E 里 `git push`、打 tag、动 gh-pages。push、首次部署（优先 `workflow_dispatch` 手动触发）、线上验证由编排器在集成验收通过后做。
- 提交：`git -c trailer.ifexists=doNothing commit`，禁止 `Co-authored-by`，禁止提及 AI / Grok / Claude / Cursor / Generated。中文注释；标识符英文。站内文案与 README 全中文。
- 环境：`eval "$(fnm env)" && fnm use 22` 后再跑 `pnpm install` / `pnpm build` / `pnpm dev`（website/ 与 v5/ 均要求 Node >= 20）。
- 内容页的 frontmatter 约定（Spec 已定死，B 组任务直接遵守，不需要等 A）：

```markdown
---
title: 快速开始
group: 指南
order: 1
---
```

  - `group` 取值只能是：`指南` / `插件` / `参考` / `迁移` / `其他`。
  - 文件路径即路由：`content/guide/getting-started.md` → `#/guide/getting-started`；`content/faq.md` → `#/faq`。
  - 正文 markdown：代码块显式标注语言（```ts / ```json / ```css / ```html / ```bash）；提示块用 GFM alert 语法 `> [!WARNING]` / `> [!NOTE]`；站内链接写 hash 路由（`#/reference/config`）或相对 `.md` 路径，外链直接写 URL（站点会自动加 `target="_blank"`）。

---

## 任务总览与依赖

| 任务 | 内容 | 文件所有权（排他） | 依赖 |
|---|---|---|---|
| A | website/ 站点工程（站壳 + 首页，不含真实内容页） | `website/**`（**除** `website/content/**`） | 无 |
| B1 | 内容：指南 6 页 | `website/content/guide/*.md` | 仅 Spec 约定（可与 A 并行） |
| B2 | 内容：插件 2 页 | `website/content/plugins/*.md` | 仅 Spec 约定（可与 A 并行） |
| B3 | 内容：参考 4 页 | `website/content/reference/*.md` | 仅 Spec 约定（可与 A 并行） |
| B4 | 内容：迁移 + FAQ 2 页 | `website/content/migration/from-v4.md`、`website/content/faq.md` | 仅 Spec 约定（可与 A 并行） |
| C | README.md 重写 | `README.md` | 无 |
| D | 部署 workflow + v5 包元数据 | `.github/workflows/github-pages.yml`、`v5/packages/core/package.json`、`v5/packages/cli/package.json` | 无 |
| E | GitHub About 更新 | 无文件（gh 命令） | 集成验收通过后 |

**并行性确认**：B1–B4 与 A 可直接并行——frontmatter 字段（title/group/order）、group 取值、路径即路由的约定均由 Spec §4.1/§4.3 与本计划 Global Constraints 定死，A 不创建任何 `website/content/` 下的真实文件（A 的本地验证用临时样例，验收后删除），因此不存在两个 agent 写同一文件的情况。唯一代价：B 组 agent 在 A 合入前无法用 `pnpm dev` 预览渲染效果，其完成标准只做到内容级自检；渲染级验证统一由集成验证（§集成验证）兜底。若编排器更保守，也可把 B1–B4 放到 A 合入后启动，换取每页可预览。

**建议并行批次**：

- **批次 1（7 个 agent 全并行）**：A、B1、B2、B3、B4、C、D。
- **批次 2（编排器/集成 agent 串行）**：合入全部任务 → 集成验证清单逐条执行 → 问题分派修复（修复任务仍按上面的文件所有权派给对应任务的 agent）。
- **批次 3（review，可与批次 2 的修复交织）**：3 个独立 review agent（内容准确性 / 工程质量 / README 渲染），检查清单见「Review 策略」。
- **批次 4（编排器 + 用户）**：push master、`workflow_dispatch` 手动触发首次部署、线上走查。
- **批次 5**：任务 E（GitHub About），验收项 8/10/11 全绿后执行。

---

### Task A: website/ 站点工程（站壳 + 首页）

**输入（必读）：**
- Spec §3（关键决策表）、§4.1（IA）、§4.3（技术方案：目录结构 / 依赖清单 / markdown 管线 / 样式与设计语言）、§4.4（首页设计）。
- 首页 features 事实来源：Spec §4.4 已给出 8 条定稿文案，直接用，不要自己发明第 9 条。

**产出（文件清单，全部新建）：**

```
website/package.json            # 按 Spec §4.3 依赖清单原样
website/.gitignore              # node_modules, dist
website/tsconfig.json
website/vite.config.ts          # base: '/mpbuild/'，plugin-react，content/ 加入 watch
website/index.html              # <html lang="zh-CN">，首帧前主题初始化内联脚本
website/src/main.tsx
website/src/App.tsx
website/src/router.ts           # useHashRoute() hook（约 40 行）
website/src/content.ts          # import.meta.glob + frontmatter 解析 + NAV 模型
website/src/components/Layout.tsx
website/src/components/Sidebar.tsx
website/src/components/Markdown.tsx
website/src/components/HomePage.tsx
website/src/components/ThemeToggle.tsx
website/src/styles/base.css
website/src/styles/hljs-light.css
website/src/styles/hljs-dark.css
website/pnpm-lock.yaml          # pnpm install 生成
```

**关键提醒：**
- `import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default', eager: true })`；**不要**用已废弃的 `as: 'raw'`。
- 不引 gray-matter：自写约 20 行 frontmatter 解析器，只支持 `key: value` 平铺字段。
- 不引 react-router、不引任何 UI 框架（无 antd/mui/tailwind）。CSS 自写约 400 行，设计规格见 Spec §4.3「样式与设计语言」（16px/1.75、内容栏 760px、约 10 个 CSS 变量 token、深浅两套、>=1024px 三栏、<1024px 侧栏抽屉化、表格与代码块 `overflow-x: auto`）。
- NAV 的 group 顺序在代码里显式定义：指南 → 插件 → 参考 → 迁移 → 其他；组内按 frontmatter `order` 排序。group 取值集合必须与 Global Constraints 中 B 组使用的五个值完全一致。
- `Markdown.tsx` 自定义 `a` 渲染器：站内 `#/...` 与相对 `.md` 链接改写为 hash 路由链接；外链加 `target="_blank" rel="noreferrer"`。每个页面渲染后 `document.title = `${title} - mpbuild``。
- **content 目录为空时站点必须正常构建与运行**（导航为空、首页可用）。为验证文档路由渲染，可在 `website/content/` 下临时放一个样例 md（带正确 frontmatter + 代码块 + `> [!WARNING]` 块）走查，**验证完必须删除**——`website/content/` 下的真实文件归 B 组任务所有。
- 主题机制：`<html data-theme="light|dark">`；`index.html` 内联脚本首帧前读 localStorage / `prefers-color-scheme`；hljs 两套主题分别限定在 `:root:not([data-theme="dark"])` 与 `[data-theme="dark"]` 下。
- 首页文案不出现任何 4.x 概念。

**Steps:**

- [ ] **Step 1: 读 Spec §3/§4.1/§4.3/§4.4**，按依赖清单建 `website/package.json` 与脚手架文件
- [ ] **Step 2: 实现 content.ts / router.ts / Markdown.tsx**（markdown 管线 + hash 路由）
- [ ] **Step 3: 实现 Layout/Sidebar/ThemeToggle + base.css + hljs 双主题**（含响应式抽屉）
- [ ] **Step 4: 实现 HomePage.tsx**（hero + 8 features + 页脚，按 Spec §4.4）
- [ ] **Step 5: 临时样例 md 走查文档路由**，确认渲染、高亮、WARNING 块、链接改写、document.title，然后删除样例
- [ ] **Step 6: 跑完成标准全部命令**，提交

**完成标准（可执行）：**

```bash
eval "$(fnm env)" && fnm use 22
cd /Users/ximing/project/mygithub/mpbuild/website
pnpm install
pnpm build                 # 含 tsc --noEmit，一次通过
grep -o '/mpbuild/' dist/index.html   # 非空：base 生效
pnpm preview &             # 人工/csi 走查：首页渲染、主题切换刷新后保持、首屏无闪烁、<=768px 无横向滚动
# 收尾确认：website/content/ 下无残留样例文件
```

---

### Task B0: B 组公共写作规范（B1–B4 的 prompt 必须整段包含）

> 这一段不是独立任务，是 B1–B4 每个任务 prompt 的公共前缀。

**必读（按顺序）：**
1. Spec §4.1（IA 与你的页面在导航中的位置）、§4.2 中**你负责的表格行**（大纲 + 来源列）、§4.2 末尾「写作纪律」四条。
2. 你负责页面的「来源」列列出的**每一个代码文件**（以代码为准，报告是索引；每页动笔前先打开核对）。
3. 侦察报告一/二的路径向编排器索取（若在 `docs/superpowers/` 或 `.superpowers/` 下可找到则读，找不到不影响——代码是唯一事实依据）。

**frontmatter 与分组 order（已定死，直接抄用，不要跨组协调）：**

| 文件 | title | group | order |
|---|---|---|---|
| content/guide/getting-started.md | 快速开始 | 指南 | 1 |
| content/guide/entry.md | entry 与路由 | 指南 | 2 |
| content/guide/conditional-compilation.md | 条件编译与多态 | 指南 | 3 |
| content/guide/subpackages.md | 分包与子仓库 | 指南 | 4 |
| content/guide/npm.md | npm 支持 | 指南 | 5 |
| content/guide/watch-cache.md | watch 与缓存 | 指南 | 6 |
| content/plugins/api.md | 插件 API | 插件 | 1 |
| content/plugins/official.md | 官方插件 | 插件 | 2 |
| content/reference/config.md | 配置参考 | 参考 | 1 |
| content/reference/cli.md | CLI 参考 | 参考 | 2 |
| content/reference/diagnostics.md | 诊断码 | 参考 | 3 |
| content/reference/unsupported.md | 暂不支持 | 参考 | 4 |
| content/migration/from-v4.md | 从 4.x 迁移 | 迁移 | 1 |
| content/faq.md | FAQ | 其他 | 1 |

**写作纪律（违反即返工）：**
- 所有行为性描述以 v5 代码为准。每写一句行为描述，问自己「这句话在 v5 代码里有证据吗」，没有就删。
- 每个 breaking change 在首次出现它的页面用 `> [!WARNING]` 标注。
- 示例代码只取自 `example/demo/mpbuild.config.mjs`、`example/demo/entry.js`、`example/demo/src/`、`example/projects/`。禁止引用 `example/demo/mpb.config.js`、`example/demo/package.json` scripts、`example/demo/babel.config.js`。
- 不出现「loader」「Tapable」「Babel」「PostCSS（作为默认引擎）」（B4 迁移页作对照除外）。
- 代码块显式标注语言；站内链接用 `#/路由` 或相对 `.md`；全中文。
- **你只许创建你任务清单内的 md 文件，不许改 website/ 下任何其他文件**（站点代码是 Task A 的，其他内容页是别的 agent 的）。

**B 组统一完成标准（内容级自检）：**

```bash
cd /Users/ximing/project/mygithub/mpbuild
# 1. frontmatter 三字段齐全且 group/order 与上表一致
head -6 <你负责的每个 md 文件>
# 2. 无 4.x 概念污染（迁移页除外）
grep -nE 'loader|Tapable|Babel|babel|PostCSS|postcss' <你负责的 md 文件>   # 期望为空（B4 迁移页除外）
# 3. 无禁用示例文件引用
grep -nE 'mpb\.config\.js|babel\.config\.js' <你负责的 md 文件>   # 期望为空（B4 迁移页作对照时除外）
# 4. 每个 ``` 代码块都标了语言
grep -n '^```$' <你负责的 md 文件>   # 期望为空（结束的 ``` 后面应直接换行，用 ^```$ 匹配到的是未标语言的开块）
```

（渲染级验证——页面在站点里实际打开无空白、高亮正确、WARNING 块样式正确——由集成验证统一执行，B 组 agent 若启动时 Task A 已合入，可 `cd website && pnpm dev` 自行预览。）

---

### Task B1: 内容撰写 — 指南 6 页

**输入：** Task B0 公共规范 + Spec §4.2 对应 6 行大纲。逐页事实来源（动笔前必读）：

| 页面 | 必读代码文件 |
|---|---|
| getting-started | `v5/packages/cli/src/index.ts`、`example/demo/mpbuild.config.mjs`、`example/demo/entry.js` |
| entry | `v5/packages/core/src/config/entry.ts`、`example/demo/entry.js` |
| conditional-compilation | `v5/packages/core/src/compile/` 下 ifdef 相关源码（实施时 `grep -rn 'ifdef' v5/packages/core/src` 定位） |
| subpackages | `example/projects/one`、`example/projects/two`、`v5/packages/core/src/plan/`、`v5/packages/core/src/graph/`（多源染色归属、shared、独立分包越界、PATH_COLLISION、CYCLE） |
| npm | `v5/packages/core/src/plugin/npm-compat.ts` |
| watch-cache | `v5/packages/core/src/watch/`、`v5/packages/core/src/compiler.ts`（reloadConfig、磁盘缓存） |

**产出（新建）：**
```
website/content/guide/getting-started.md
website/content/guide/entry.md
website/content/guide/conditional-compilation.md
website/content/guide/subpackages.md
website/content/guide/npm.md
website/content/guide/watch-cache.md
```

**关键提醒：**
- getting-started：Node >= 20、安装 `@mpbuild/cli`、最小 `mpbuild.config.mjs`、`mpb build` / `mpb dev`、指向 example/demo、配置文件名优先级提示（ts→mts→js→mjs，不读 `mpb.config.js` 报 `LEGACY_CONFIG` 退出码 2——这是 breaking，首次出现用 WARNING 块）。
- entry：经典形态与 router 形态、`virtual:app.json`、顶层键透传、页面/组件 JSON 的 `*.config.js`（隔离执行、剥 `.config` 与 infix、失败报 `CONFIG_JS_INVALID`）。
- subpackages：owner 染色模型、`subPackage.shared` 两值、`INDEPENDENT_PACKAGE_EDGE`、`PATH_COLLISION` hash 后缀、`CYCLE` warning、`projects: [{name, src, alias}]` 取代 4.x SubProjectPlugin、`ABS_PATH_IN_SUBPROJECT`、子仓库先查 `projects[].alias`。
- npm：入口字段优先级 miniprogram → browser → main → module；输出 `output.npm`（默认 `dist/npm`）；npmCompat **内置无需用户加插件**。
- watch-cache：80ms debounce、内容 hash 增量建图、topologyChanged/planChanged 差量 emit、配置变更全量 reloadConfig、`node_modules/.cache/mpbuild`、`--no-cache`、4096 文件按 mtime GC。

**完成标准：** Task B0 统一自检 4 条命令全过 + 每页大纲要点覆盖 Spec §4.2 对应行（逐条打勾）。

---

### Task B2: 内容撰写 — 插件 2 页

**输入：** Task B0 公共规范 + Spec §4.2 对应 2 行大纲。必读代码：
- `v5/packages/core/src/types.ts`（Plugin 接口定义）
- `v5/packages/core/src/plugin/legacy-scss.ts`
- `v5/packages/core/src/plugin/project-config.ts`
- `v5/packages/core/src/plugin/copy.ts`
- `v5/packages/core/src/plugin/npm-compat.ts`

**产出（新建）：**
```
website/content/plugins/api.md
website/content/plugins/official.md
```

**关键提醒：**
- api 页：`interface Plugin { name; load?(id, ctx): string|void; generate?(file, ctx): file|file[]|void }`；load 第一个返回字符串者胜；**与 Tapable / 4.x 插件 API 不兼容——显著 `> [!WARNING]` 警示框**（这是 breaking，首次出现就在本页）。
- official 页 4 节：`legacyScss()`（postcss-scss 类 SCSS 支持）、`projectConfig({projectname, appId, setting?})`（不覆盖已有文件）、`copy(patterns, opts?)`（自实现 glob，`**` 含零层目录）、npmCompat（内置，非用户侧插件，说明即可）。
- copy 的 glob 语义以 `v5/packages/core/src/plugin/copy.ts` 实际实现为准，不要凭印象写。

**完成标准：** Task B0 统一自检 4 条命令全过 + 大纲覆盖。

---

### Task B3: 内容撰写 — 参考 4 页

**输入：** Task B0 公共规范 + Spec §4.2 对应 4 行大纲。必读代码：
- config 页：**逐字段核对** `v5/packages/core/src/config/schema.ts`（这是验收项 9 的抽查对象，一个字段都不能漏/错）；配置解析规则看 `v5/packages/core/src/config/load.ts`
- cli 页：`v5/packages/cli/src/index.ts`
- diagnostics 页：`v5/packages/core/src/diagnostic/index.ts`（逐码核对触发条件与级别）
- unsupported 页：Spec §4.2 对应行清单 + `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` §2.2

**产出（新建）：**
```
website/content/reference/config.md
website/content/reference/cli.md
website/content/reference/diagnostics.md
website/content/reference/unsupported.md
```

**关键提醒：**
- config 页是**完整配置项表**（配置项 / 类型 / 默认值 / 说明），覆盖 Spec §4.2 列出的全部条目（src、entry、target、platform、output.dir/npm/clean/componentRelative、resolve.alias、resolve.extensions、compile.js.target/module、compile.css.lightningcss、compile.minify、subPackage.shared、projects、ifdef.tokens/blockcode、plugins）+ 配置文件解析规则（优先级 ts→mts→js→mjs；不读 `mpb.config.js` 报 `LEGACY_CONFIG` 退出码 2；生产环境 .ts/.mts 无法 import 时 `CONFIG_TS_SKIPPED`；`defineConfig`）。表格在 markdown 里注意列宽，内容长时用 `<br>` 或拆行，站点 CSS 已保证表格 `overflow-x: auto`。
- cli 页：`mpb build`（`--minify`、`--no-cache`）、`mpb dev`、`mpb --watch` 与 `mpb build --watch` 等价分支（后者不应用 `--minify`）、`mpb analyze`（写 `<output.dir>/mpbuild-analyze.json`）、`mpb inspect graph`；退出码表（0/1/2）。
- diagnostics 页：**16 个码齐全**（验收项 9 抽查）：RESOLVE_MISS、ABS_PATH_IN_SUBPROJECT、CONFIG_NOT_FOUND、CONFIG_TS_SKIPPED、LEGACY_CONFIG、ENTRY_LOAD、CONFIG_JS_INVALID、MISSING_APP_JS、MISSING_PAGE_JS、UNKNOWN_TARGET、TRANSFORM_FAIL、UNSUPPORTED_PREPROCESSOR、CYCLE、INDEPENDENT_PACKAGE_EDGE、PATH_COLLISION、COPY_GRAPH_UNSUPPORTED。每码：级别 / 含义 / 常见原因 / 处置建议。级别以 `diagnostic/index.ts` 实际为准。
- unsupported 页每条一句话现状 + 替代做法（如有），清单以 Spec §4.2 对应行为准。

**完成标准：** Task B0 统一自检 4 条命令全过 + 以下针对性自检：

```bash
cd /Users/ximing/project/mygithub/mpbuild
# 诊断码 16 个齐全
for c in RESOLVE_MISS ABS_PATH_IN_SUBPROJECT CONFIG_NOT_FOUND CONFIG_TS_SKIPPED LEGACY_CONFIG ENTRY_LOAD CONFIG_JS_INVALID MISSING_APP_JS MISSING_PAGE_JS UNKNOWN_TARGET TRANSFORM_FAIL UNSUPPORTED_PREPROCESSOR CYCLE INDEPENDENT_PACKAGE_EDGE PATH_COLLISION COPY_GRAPH_UNSUPPORTED; do grep -q "$c" website/content/reference/diagnostics.md || echo "MISSING: $c"; done
# config 页与 schema.ts 字段数对账（人工逐字段打勾，不许跳过）
```

---

### Task B4: 内容撰写 — 迁移 + FAQ 2 页

**输入：** Task B0 公共规范 + Spec §4.2 对应 2 行大纲。必读：
- `docs/migration-v5.md`（迁移页底稿，提炼而非照抄）
- `CHANGELOG.md`
- FAQ 涉及的代码事实回到对应源码核对（TargetAdapter 自定义参考 `v5/packages/core/src/__tests__/__fixtures__/fake-mini`）

**产出（新建）：**
```
website/content/migration/from-v4.md
website/content/faq.md
```

**关键提醒：**
- 迁移页要点（Spec §4.2）：包名迁移、配置文件改名与字段改名对照表（output.path→output.dir、alias→resolve.alias、optimization.minimize→compile.minify、output.component.relative→output.componentRelative）、loader 链废弃、插件 API 全新、PolymorphismPlugin→platform+ifdef、SubProjectPlugin→projects、`new MPB().run()`→`createCompiler(config).run()`、不再提供 resolveOutside、Node>=20 纯 ESM。**`require('./x.json')` 不再内联用显著 `> [!WARNING]` 单独突出**（验收项 9 抽查）。
- 迁移页是全站唯一允许出现 loader/Tapable/Babel 等 4.x 概念作对照的页面。
- FAQ 8–12 条，候选题目见 Spec §4.2 对应行；每条答案里的事实必须能在 v5 代码或本计划其他页面大纲中找到依据。

**完成标准：** Task B0 统一自检（第 2、3 条对迁移页放宽——作对照时允许出现 4.x 名词，但 WARNING 块必须存在）+ 以下针对性自检：

```bash
cd /Users/ximing/project/mygithub/mpbuild
grep -q "require('./x.json')" website/content/migration/from-v4.md || grep -q 'require(.\./.*\.json.)' website/content/migration/from-v4.md
grep -c '^> \[!WARNING\]' website/content/migration/from-v4.md   # >= 1
```

---

### Task C: README.md 重写

**输入（必读）：**
- Spec §5（章节结构 1–12 与每章要点，逐节照做）、§8 第 8 条（README 是文档站的精简版，特性列表与快速开始代码块以文档站为准——但注意 C 与 B 并行，因此快速开始代码块直接以 `example/demo/mpbuild.config.mjs` 与 `v5/packages/cli/src/index.ts` 为准写，B 组也从同一来源写，天然一致）。
- 现有 `/Users/ximing/project/mygithub/mpbuild/README.md`（已在 v5 方向部分重写，可吸收其准确表述，但结构必须按 Spec §5 全量重组）。
- `.github/workflows/` 下实际存在的 workflow 名（写计划时为 `github-pages.yml`、`publish-mpbuild.yml`、`sync.yml`；徽章指向哪个实施时核对，Spec §5 第 2 条）。
- `example/demo/mpbuild.config.mjs`、`v5/packages/cli/src/index.ts`（快速开始代码块事实来源）。

**产出：** 修改 `/Users/ximing/project/mygithub/mpbuild/README.md`（全量重写，只许动这一个文件）。

**关键提醒：**
- 保留 all-contributors 区块（`<!-- ALL-CONTRIBUTORS-BADGE:START -->` 徽章注释对与文末 contributors 列表区块）原样，包括注释标记——all-contributors bot 靠标记定位。
- 章节结构严格按 Spec §5 的 1–12：标题区 / 徽章 / 简介 / 特性 / 要求 / 快速开始 / 文档 / 从 4.x 迁移 / 包与仓库布局 / 生态链接 / License / Contributors。
- 删除：旧「配置」参考式内容（移到文档站）、Gitee 镜像链接、`mpb.config.js` 以外的 4.x 残留。注意现有 README 里大段「配置」说明（CONFIG_TS_SKIPPED、componentRelative、resolve.extensions 等）属于要移走的内容，README 里只留一句指向文档站配置参考。
- 快速开始代码块 <= 30 行。文档站链接 `https://ximing.github.io/mpbuild/` + 常用入口（快速开始 `#/guide/getting-started`、配置参考 `#/reference/config`、CLI 参考 `#/reference/cli`、插件 `#/plugins/api`、诊断码 `#/reference/diagnostics`、FAQ `#/faq`）。

**完成标准（可执行）：**

```bash
cd /Users/ximing/project/mygithub/mpbuild
grep -ni gitee README.md                        # 期望为空
grep -c 'ALL-CONTRIBUTORS' README.md            # >= 2（徽章标记对 + 列表标记对）
grep -nE 'mpb\.config\.js' README.md            # 仅允许出现在「不读取 mpb.config.js」类迁移警示语境
grep -q 'ximing.github.io/mpbuild' README.md
# 徽章 URL 逐个 curl -sI 确认 200（npm badge、node badge、license badge、workflow badge）
```

---

### Task D: 部署 workflow 改造 + v5 包元数据

**输入（必读）：**
- Spec §4.5（workflow 完整 yaml 已给出，整体重写文件内容，不保留 `if: false` 残留结构）与「要点」四条。
- Spec §6 顺手项段落。
- 现有 `.github/workflows/github-pages.yml`（确认被替换）、`v5/packages/core/package.json`、`v5/packages/cli/package.json`（只加字段，不改 version、不动 scripts/deps）。

**产出（修改 3 个文件）：**
```
.github/workflows/github-pages.yml     # 按 Spec §4.5 yaml 原样写入
v5/packages/core/package.json          # 补 homepage/repository/keywords
v5/packages/cli/package.json           # 补 homepage/repository/keywords
```

**关键提醒：**
- 两个 package.json 补：`"homepage": "https://ximing.github.io/mpbuild/"`、`"repository": { "type": "git", "url": "https://github.com/ximing/mpbuild.git", "directory": "v5/packages/core" }`（cli 对应改 directory）、`"keywords"` 同 topics 语义（weapp / wechat-miniprogram / miniprogram / build-tool / swc / lightning-css / typescript / npm，可裁剪为 npm 搜索友好子集）。**不改 version、不触发发布。**
- workflow 使用 `GITHUB_TOKEN` + `permissions: contents: write`（`ACCESS_TOKEN` 已失效，首跑后按预案切换；不再需要 `GIT_CONFIG_NAME` / `GIT_CONFIG_EMAIL`）；pnpm 版本经 `package_json_file: website/package.json` 解析（根 package.json 的 pnpm@7 声明会冲突）；JamesIves action 默认生成 `.nojekyll`，不要关闭。
- 触发 paths 只有 `website/**` 与 workflow 自身；含 `workflow_dispatch`。

**完成标准（可执行）：**

```bash
cd /Users/ximing/project/mygithub/mpbuild
node -e "const y=require('fs').readFileSync('.github/workflows/github-pages.yml','utf8'); console.log(y.includes('if: false') ? 'FAIL: if:false 残留' : 'ok')"   # ok
command -v actionlint >/dev/null && actionlint .github/workflows/github-pages.yml || echo 'actionlint 不可用则人工核对 yaml 缩进与 Spec §4.5 逐行一致'
node -e "for (const p of ['v5/packages/core/package.json','v5/packages/cli/package.json']) { const j = require('./'+p); if (j.version !== '5.0.0') throw new Error(p+' version 被改'); if (!j.homepage || !j.repository || !j.keywords) throw new Error(p+' 缺字段'); } console.log('ok')"
```

---

### Task E: GitHub About 更新（验收通过后执行）

**输入：** Spec §6（description / topics / homepageUrl 最终文案已给出，逐字使用）。

**产出：** 无文件。执行（或把命令交给用户执行）：

```bash
gh repo edit ximing/mpbuild \
  --description "图驱动的微信小程序构建工具 / Graph-driven WeChat miniprogram build tool（SWC · Lightning CSS · 精准分包 · 增量缓存）" \
  --homepage "https://ximing.github.io/mpbuild/"
# topics 整体替换（gh repo edit 的 --add-topic/--remove-topic 逐个操作，或用 gh api 整体 PUT）：
gh api repos/ximing/mpbuild/topics -X PUT \
  -f "names[]=weapp" -f "names[]=wechat-miniprogram" -f "names[]=miniprogram" \
  -f "names[]=build-tool" -f "names[]=swc" -f "names[]=lightning-css" \
  -f "names[]=typescript" -f "names[]=npm"
```

**关键提醒：** 实施 agent 若无可写凭据，把上面确切命令原样交给用户执行，不要自行尝试其他鉴权方式。执行时机：验收项 8（新站上线）、10、11 全绿之后。

**完成标准：**

```bash
gh repo view ximing/mpbuild --json description,repositoryTopics,homepageUrl
# description / topics / homepageUrl 与 Spec §6 逐字一致；topics 中无 babel/postcss
```

---

## 集成验证（全部任务合入后，编排器/集成 agent 执行）

对应 Spec §7 验收标准逐条执行。**本地可验**：1–7、9、10（部分）、11；**需 push 后验**：8、12、10（GitHub 实际渲染）。

```bash
eval "$(fnm env)" && fnm use 22
cd /Users/ximing/project/mygithub/mpbuild/website
pnpm install --frozen-lockfile && pnpm build        # 验收 1（含 tsc --noEmit）
grep -o '/mpbuild/' dist/index.html                 # 验收 7：base 生效
ls content/guide content/plugins content/reference content/migration content/faq.md
# 13 个内容页齐全（对照 Spec §4.1 清单）
pnpm preview &                                      # 验收 2/3/4/5/6：走查
```

走查清单（`pnpm preview` 带 base `/mpbuild/`，建议用 csi 技能驱动真实 Chrome 逐路由截图检查，或人工）：

- [ ] 验收 2：14 个路由（首页 + 13 内容页，清单见 Spec §4.1）全部可渲染，无空白页、无 console error。
- [ ] 验收 3：每个内容页有标题、正文、代码高亮；含 `> [!WARNING]` 的页面（entry/getting-started/plugins-api/migration 等）警示块样式正确。
- [ ] 验收 4：浅色/深色切换正常，刷新后主题保持，首屏无闪烁（内联脚本生效）。
- [ ] 验收 5：<=768px 宽度侧栏抽屉可用，body 无横向滚动（重点看 config 页宽表格）。
- [ ] 验收 6：导航、正文内链全部有效；外链全部 `target="_blank"`。可用 node 小脚本从 13 个 md 提取 `#/...` 链接与相对 `.md` 链接，对照 content glob 出的路由 id 集合核对。
- [ ] 验收 9（内容抽查）：
  - `content/reference/config.md` 配置项与 `v5/packages/core/src/config/schema.ts` **逐字段对账**（漏一项即打回 B3）。
  - `content/reference/diagnostics.md` 16 个码齐全且级别与 `v5/packages/core/src/diagnostic/index.ts` 一致。
  - `content/migration/from-v4.md` 含 `require('./x.json')` WARNING 块。
- [ ] 验收 10（本地部分）：README 所有徽章 URL `curl -sI` 返回 200；表格无超宽列。
- [ ] 验收 11：`grep -ni gitee README.md` 为空；README 内文档站/迁移/CHANGELOG/CONTRIBUTING 链接指向的仓库内文件真实存在；无 4.x 命令残留。
- [ ] 全站 4.x 污染扫描：`grep -rniE 'loader|tapable|babel' website/content/ | grep -v migration/from-v4.md` 应为空（official 页 legacyScss 描述里提及 postcss-scss 作为解析器名是允许的，迁移页除外）。
- [ ] 回退预案确认：首次部署前记录当前 `gh-pages` 分支 HEAD commit（`git rev-parse origin/gh-pages`），如需回退，force-push 该 commit 回 gh-pages 即可恢复旧站（旧 dumi 站产物仍在 gh-pages 历史中）。

push 后验证（编排器 + 用户）：

- [ ] 验收 8：优先 `gh workflow run github-pages.yml`（workflow_dispatch）手动触发首次部署；workflow 绿；`git fetch && git log origin/gh-pages -1` 确认更新；`https://ximing.github.io/mpbuild/` 打开为新站首页（不再是旧 dumi 站），随机点 3 个内容路由深链可直接打开。
- [ ] 验收 10（线上部分）：GitHub 仓库首页 README 渲染正常（徽章无 broken image、表格不爆宽）。
- [ ] 验收 12：任务 E 完成后 `gh repo view ximing/mpbuild --json description,repositoryTopics,homepageUrl` 与 Spec §6 一致。

## Review 策略（实施完成后，独立 review agent，与集成验证互补）

三个 review agent 并行，只读审查 + 出报告，不直接改文件；问题由编排器按文件所有权派回对应任务 agent 修复。

**R1 内容准确性 review（最关键）：**
- [ ] `config.md` vs `v5/packages/core/src/config/schema.ts` 逐字段对账（配置项名、类型、默认值、说明），列出每一处不一致。
- [ ] `diagnostics.md` 16 码 vs `v5/packages/core/src/diagnostic/index.ts`：码齐全、级别（error/warning）正确、触发条件描述与代码一致。
- [ ] 随机抽 3 个其他页面（建议 entry、npm、watch-cache 各一段），逐句核对行为描述 vs 对应源码，标出无代码证据的句子。
- [ ] 迁移页字段改名对照表 vs `docs/migration-v5.md` 与代码实际行为。
- [ ] 全站 grep 4.x 概念污染（同集成验证的污染扫描），确认只有迁移页作对照。

**R2 工程质量 review：**
- [ ] `cd website && pnpm install --frozen-lockfile && pnpm build` 从零一次通过（干净 clone 视角，tsc --noEmit 含在内）。
- [ ] `grep -o '/mpbuild/' dist/index.html` 与 `dist/assets/` 引用路径确认 base 生效。
- [ ] 链接完整性脚本：提取全部 md 的站内链接 ↔ 路由 id 集合对账；README 链接 ↔ 仓库文件/文档站路由对账。
- [ ] website/ 未被加入任何 pnpm workspace（`pnpm-workspace.yaml` 根与 v5 均无 website）；website 自带 lockfile 已提交。
- [ ] `.github/workflows/github-pages.yml` 与 Spec §4.5 逐行一致，无 `if: false` 残留。
- [ ] 两个 v5 package.json 只新增 homepage/repository/keywords，version/scripts/deps 未动（`git diff` 核对）。

**R3 README 渲染 review：**
- [ ] 徽章逐个 `curl -sI` 200；badge 链接跳转到正确目标（npm 包页、workflow 页）。
- [ ] 章节结构对照 Spec §5 的 1–12 逐节打勾；all-contributors 标记对完整。
- [ ] 无 Gitee 链接；快速开始代码块 <= 30 行且与 `example/demo/mpbuild.config.mjs` 事实一致。
- [ ] 文档站 6 个入口链接的 hash 路由与 B 组实际文件路径一致。

## 风险与回退（实施 checklist，源自 Spec §8）

- [ ] **4.x 内容污染（最大风险）**：每个 B 组 agent 每页动笔前打开来源代码文件核对；R1 review 兜底。
- [ ] **breaking changes 必须 WARNING 块突出**：`require('./x.json')` 不内联、不读 `mpb.config.js`（退出码 2）、插件 API 不兼容、字段改名——B1/B2/B4 各自页面 + 迁移页汇总，集成验证逐条检查。
- [ ] **example/demo 遗留文件不可引用**：`mpb.config.js`、package.json scripts、`babel.config.js`。B 组自检 grep 已覆盖。
- [ ] **旧站被替换不可逆**：首次部署前本地 `pnpm preview`（带 base `/mpbuild/`）完整走查 14 路由；首次部署用 `workflow_dispatch` 手动触发；部署前记录 `origin/gh-pages` HEAD 作为回退点（回退 = force-push 旧 commit 回 gh-pages）。
- [ ] **Gitee 镜像不处理**：只删 README 链接，不动 `sync.yml`。
- [ ] **Node 版本**：默认 shell 是 Node 14，所有 website/v5 命令前 `eval "$(fnm env)" && fnm use 22`。
- [x] **secret 依赖（已处置）**：首跑证实 `ACCESS_TOKEN` 失效（push gh-pages 认证失败，exit 128），经用户确认后切换为 `GITHUB_TOKEN` + `permissions: contents: write`，部署成功。
- [ ] **README 与文档站同源**：特性列表与快速开始代码块两处各写一遍；C 与 B1 都以 `example/demo/mpbuild.config.mjs` + `v5/packages/cli/src/index.ts` 为唯一来源，集成验证时 diff 两处代码块一致性。
- [ ] **B 组与 A 并行的代价**：B 组合入前无法预览页面渲染；若集成验证发现某页 markdown 语法导致渲染异常（如表格爆宽、未标语言的代码块），按文件所有权派回对应 B 任务修复。
