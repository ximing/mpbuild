---
title: 诊断码
group: 参考
order: 3
---

# 诊断码

mpbuild 的诊断统一带语义化错误码，结构为 `{ code, severity, message, file?, loc? }`。CLI 把诊断打印到 stderr：

- **warning**：构建继续，退出码不受影响。
- **error**：存在任一 error 级诊断时 CLI 退出码为 1。
- 配置加载阶段的错误（`CONFIG_NOT_FOUND`、`LEGACY_CONFIG`、`ENTRY_LOAD`、`UNKNOWN_TARGET` 等）在图构建之前直接抛出：`CONFIG_NOT_FOUND` / `LEGACY_CONFIG` 退出码为 2，其余为 1。

## 速查表

| 诊断码 | 级别 | 一句话含义 |
|---|---|---|
| `CONFIG_NOT_FOUND` | error（退出码 2） | 找不到 `mpbuild.config.*` |
| `LEGACY_CONFIG` | error（退出码 2） | 检测到 4.x 遗留的 `mpb.config.js` |
| `CONFIG_TS_SKIPPED` | warning / error | TS 配置文件无法 import，跳过或失败 |
| `ENTRY_LOAD` | error（退出码 1） | 入口加载失败或入口不是对象 |
| `UNKNOWN_TARGET` | error（退出码 1） | 未注册的 target 名 |
| `MISSING_APP_JS` | error | `src` 下没有 `app.js` / `app.ts` |
| `MISSING_PAGE_JS` | error | entry/app.json 声明的页面脚本解析失败 |
| `CONFIG_JS_INVALID` | error | 页面/组件 `*.config.js` 隔离执行失败 |
| `RESOLVE_MISS` | error | 模块请求无法解析 |
| `ABS_PATH_IN_SUBPROJECT` | error | 子仓库内使用 `/` 开头的路径 |
| `TRANSFORM_FAIL` | error / warning | 变换或依赖抽取失败 |
| `UNSUPPORTED_PREPROCESSOR` | error | `legacyScss()` 处理 SCSS 失败 |
| `CYCLE` | warning | 依赖归属闭包存在环 |
| `INDEPENDENT_PACKAGE_EDGE` | error | 独立分包与主包之间存在越界引用 |
| `PATH_COLLISION` | warning | 两个模块映射到同一输出路径 |
| `COPY_GRAPH_UNSUPPORTED` | warning | `copy({ graph: true })` 未实现 |

## 配置加载阶段

### CONFIG_NOT_FOUND

- **级别**：error，直接抛出，CLI 退出码 2。
- **含义**：当前目录下不存在 `mpbuild.config.ts` / `.mts` / `.js` / `.mjs` 中任何一个。
- **常见原因**：在未初始化配置的目录执行 `mpb`；配置文件名拼写错误。
- **处置**：在项目根新建 `mpbuild.config.mjs`，最小内容见 [快速开始](#/guide/getting-started)。

### LEGACY_CONFIG

- **级别**：error，直接抛出，CLI 退出码 2。
- **含义**：没有找到 `mpbuild.config.*`，但发现了 4.x 遗留的 `mpb.config.js`。v5 不读取该文件。
- **常见原因**：4.x 项目直接升级了 v5 的 CLI。
- **处置**：把配置迁移到 `mpbuild.config.mjs`（字段改名对照见 [从 4.x 迁移](#/migration/from-v4)），旧的 `mpb.config.js` 可删除。

### CONFIG_TS_SKIPPED

- **级别**：可降级时为 warning；所有候选都失败时抛出 error，CLI 退出码 1。
- **含义**：生产环境的 Node 无法 import `.ts` / `.mts` 配置文件（`unknown file extension`），mpbuild 记录该警告并尝试下一个候选文件名；没有任何候选可用时报错退出。注意：TS 文件能 import 但内容有语法错误（SyntaxError）时**不会**跳过，直接抛错。
- **常见原因**：生产环境只放了 `mpbuild.config.ts`，而运行它的 Node 不支持直接执行 TS。
- **处置**：生产环境改用 `mpbuild.config.js` / `.mjs`；或保留 `.ts` 的同时提供 js/mjs 兜底。

### ENTRY_LOAD

- **级别**：error，直接抛出，CLI 退出码 1。
- **含义**：`entry` 配置的字符串路径无法加载（文件不存在、import 抛错），或 entry 的值不是对象（`null`、数组、原始值）。
- **常见原因**：`entry: './entry.js'` 路径写错；入口文件本身有语法错误；入口文件导出的是数组。
- **处置**：按报错消息里的绝对路径检查入口文件；入口形态见 [entry 与路由](#/guide/entry)。

### UNKNOWN_TARGET

- **级别**：error，直接抛出，CLI 退出码 1。
- **含义**：`target` 使用了未注册的字符串名。内置仅 `'weapp'`。
- **常见原因**：`target: 'tt'` 等拼写；抖音/头条 adapter 未发布（见 [暂不支持](#/reference/unsupported)）。
- **处置**：改回 `'weapp'`，或实现 `TargetAdapter` 接口并把对象传给 `target`。

## 入口与页面

### MISSING_APP_JS

- **级别**：error。
- **含义**：`src` 目录下既没有 `app.js` 也没有 `app.ts`，无法确定应用入口脚本。
- **常见原因**：`src` 配置指向了错误目录；入口脚本被误删或改名。
- **处置**：确认 `src` 指向源码根，并在其中提供 `app.js` / `app.ts`。

### MISSING_PAGE_JS

- **级别**：error。
- **含义**：entry（或产物 `app.json`）中声明的某个页面脚本无法解析到磁盘文件。
- **常见原因**：`pages` / `subPackages[].pages` / `router[].pages` 里的路径拼写错误；页面文件后缀不在 `resolve.extensions` 覆盖范围内；分包 `root` 与页面路径拼接后不存在。
- **处置**：按诊断中的 `file` 检查声明与实际文件；必要时调整 `resolve.extensions`。

### CONFIG_JS_INVALID

- **级别**：error。
- **含义**：页面/组件的 `*.config.js`（代替 JSON 的隔离执行配置）执行失败，mpbuild 以 `{}` 兜底继续。
- **常见原因**：`.config.js` 里有语法错误、引用了不可用的模块、或导出的不是可序列化的对象。
- **处置**：按报错中的文件与原因修复该 `.config.js`；保持其只依赖 Node 内置能力，详见 [entry 与路由](#/guide/entry)。

## 模块解析

### RESOLVE_MISS

- **级别**：error。
- **含义**：一次模块请求（JS 引用、模板 `<import>`/`<include>`/`<wxs>`、样式 `url()`、JSON 组件路径等）在别名展开、相对/源码根路径、npm 包解析全部落空后仍无法定位文件；对模板/样式/资源类请求，还会额外尝试一次相对 importer 所在目录的补全，落空后才报此码。
- **常见原因**：路径拼写错误；别名未配置或函数别名返回了 `undefined`；npm 包未安装或包内 `miniprogram`/`browser`/`main`/`module` 字段指向的文件不存在；`plugin:` / `http(s):` / `data:` / `wxfile:` / `//` 开头的 specifier 属于 external，**不会**报此码。
- **处置**：按诊断里的 request 与 importer 核对路径；别名与后缀规则见 [配置参考](#/reference/config)；npm 入口优先级见 [npm 支持](#/guide/npm)。

### ABS_PATH_IN_SUBPROJECT

- **级别**：error。
- **含义**：`projects` 声明的子仓库内的文件使用了 `/` 开头的路径（在主项目里它表示相对 `src` 的根路径，子仓库没有这个概念）。
- **常见原因**：子仓库代码沿用了主仓的 `/utils/xxx` 写法。
- **处置**：改用相对路径，或在 `projects[].alias` / 全局 `resolve.alias` 里配置别名后用别名引用。详见 [分包与子仓库](#/guide/subpackages)。

## 变换

### TRANSFORM_FAIL

- **级别**：除 **CSS 变换失败降级为 warning**（保留原代码继续）外，其余情形均为 **error**——包括建图期依赖边抽取失败、写盘期 JS 变换抛错、JSON 变换失败（如 `JSON.parse` 抛出）等。
- **含义**：单个模块的依赖抽取或 SWC / Lightning CSS 变换失败。
- **常见原因**：源码语法错误；用了当前变换不支持的语法；SWC 编译目标（`compile.js.target`）与语法组合异常。
- **处置**：按诊断中的文件与原始错误消息修复源码；若是个别 CSS 文件，可先以 warning 状态运行再逐个修复。

### UNSUPPORTED_PREPROCESSOR

- **级别**：error。
- **含义**：`legacyScss()` 插件在解析/处理 SCSS 语法的样式文件时失败。
- **常见原因**：SCSS 语法错误；使用了该插件不支持的预处理语法。
- **处置**：按报错中的文件与消息修复样式源码；`legacyScss()` 的适用范围见 [官方插件](#/plugins/official)。

## 图与分包

### CYCLE

- **级别**：warning。
- **含义**：依赖归属闭包中存在循环依赖（A 依赖 B、B 又依赖 A）。
- **常见原因**：模块间相互 import。
- **处置**：warning 不阻塞构建，但循环依赖会干扰分包归属判断，建议打破环（提取公共模块、调整依赖方向）。

### INDEPENDENT_PACKAGE_EDGE

- **级别**：error（weapp adapter 将独立分包越界定义为 error）。
- **含义**：独立分包（`independent: true`）与主包之间存在影响归属的依赖边——独立分包引用了主包模块，或主包引用了独立分包模块。独立分包要求自包含。
- **常见原因**：独立分包页面引用了主包的 `utils`；主包代码引用了独立分包里的模块。
- **处置**：把共享代码复制进独立分包，或把 `subPackage.shared` / 引用关系调整到非独立分包；分包模型见 [分包与子仓库](#/guide/subpackages)。

### PATH_COLLISION

- **级别**：warning。
- **含义**：两个不同的模块计算出了相同的输出路径。后写者会自动加内容 hash 后缀（如 `index-1a2b3c4d.js`）避免互相覆盖。
- **常见原因**：多源染色后不同来源的同名文件落到同一分包位置；`subPackage.shared: 'duplicate'` 下的边缘情况。
- **处置**：一般可安全忽略（产物已去重命名）；若想消除，检查同名源文件并调整目录结构或别名。

## 插件

### COPY_GRAPH_UNSUPPORTED

- **级别**：warning。
- **含义**：调用了 `copy(patterns, { graph: true })`，但「拷贝文件入图」在 v5 首发未实现，插件降级为 extras 直拷（与 `graph: false` 相同）。
- **常见原因**：沿用了期望 copy 产物参与依赖图的写法。
- **处置**：移除 `graph: true`，接受 extras 直拷语义；该限制见 [暂不支持](#/reference/unsupported)。
