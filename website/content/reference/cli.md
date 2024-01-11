---
title: CLI 参考
group: 参考
order: 2
---

# CLI 参考

安装 `@mpbuild/cli` 后得到 `mpb` 命令。所有命令都在**当前工作目录**查找配置文件（解析规则见 [配置参考](#/reference/config)）。

```bash
npm i -D @mpbuild/cli
```

## mpb build

构建一次并写盘。

```bash
mpb build
mpb build --minify
mpb build --no-cache
```

| 选项 | 说明 |
|---|---|
| `--minify` | 本次进程内把 `compile.minify` 覆盖为 `true`（不改配置文件） |
| `--no-cache` | 关闭磁盘缓存（默认缓存在 `node_modules/.cache/mpbuild`） |

诊断输出到 stderr；存在 error 级诊断时退出码为 1（产物仍可能已部分写出）。

## mpb dev

首次构建后进入 watch：文件变更做增量重建，配置文件变更触发全量重载。

```bash
mpb dev
```

以下三种写法**完全等价**，都进入同一个 watch 分支：

```bash
mpb dev
mpb --watch
mpb build --watch
```

> [!NOTE]
> watch 分支在 `build` 分支之前匹配，因此 `mpb build --watch` 里的 `--minify` 与 `--no-cache` **不会生效**。watch 期间如需压缩，请在配置里设置 `compile.minify`。

watch 期间诊断持续打印到 stderr，进程保持不退出。

## mpb analyze

建图并计算 Output Plan（不写业务产物），把分析结果写到 `<output.dir>/mpbuild-analyze.json`：

```bash
mpb analyze
```

输出的 JSON 包含图节点与产物计划的汇总，用于排查「这个文件被打到了哪个包」。存在 error 级诊断时退出码为 1。

## mpb inspect graph

建图后把逐节点的图结构打印到 stdout（节点、kind、owner、边等），用于精确检查依赖图：

```bash
mpb inspect graph
```

存在 error 级诊断时退出码为 1。

## 退出码

| 退出码 | 含义 |
|---|---|
| `0` | 成功（可能有 warning 级诊断） |
| `1` | 存在 error 级诊断，或配置加载/校验失败（`ENTRY_LOAD`、`UNKNOWN_TARGET`、`CONFIG_TS_SKIPPED`、schema 校验失败等） |
| `2` | 配置文件缺失（`CONFIG_NOT_FOUND`）或检测到遗留的 `mpb.config.js`（`LEGACY_CONFIG`） |

## 其他

- 未识别的命令打印用法提示：`usage: mpb <inspect graph|build|dev|analyze>`。
- 各命令诊断码的含义与处置见 [诊断码](#/reference/diagnostics)。
