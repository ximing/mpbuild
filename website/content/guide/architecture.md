---
title: 架构：四段流水线
group: 指南
order: 1.5
---

# 架构：四段流水线

mpbuild 5.x 不跑 loader 链。一次构建是四段、顺序固定的流水线——先有图，才有归属，才有产物路径，最后才变换写盘。

![四段流水线](/mpbuild/assets/pipeline.gif)

## 1. 建图 graph

从 `entry` 与 `src/app.js`（或 `app.ts`）出发做 BFS。每碰到一个模块，按 kind 抽出依赖边：

- **script**：`import` / `require` / 动态可静态化的引用
- **style**：`@import`、`url()`
- **template**：`<include>` / `<import>` / `<wxs src>` 以及自定义标签对应的组件
- **json**：`usingComponents`、`componentGenerics`、分包与页面路径

得到一张 `ModuleGraph`：节点带 id / kind / sourcePath，边带 raw 引用与 kind。环会记 `CYCLE`（warning），不会让构建直接崩掉。

## 2. 归属 analyze

在图上做多源染色。主包页面与各分包页面都是色源，沿「影响归属」的边扩散：

| 触及情况 | owner |
|---|---|
| 被主包触及 | `main` |
| 只被某一个分包触及 | 该分包 root |
| 被多个分包触及、主包未触及 | `shared` |

`shared` 模块按 `subPackage.shared` 复制进各分包或提升到主包。独立分包与主包之间不允许有影响归属的边，违例报 `INDEPENDENT_PACKAGE_EDGE`。

![模块图按 owner 染色](/mpbuild/assets/graph.png)

## 3. 计划 plan

每个节点映射到唯一 dest。路径碰撞（两个源映到同一产物）记 `PATH_COLLISION`，后到者加内容 hash 前 8 位后缀。npm 包打到 `output.npm`（默认 `dist/npm`）。这一步**还不写盘**，只出一份 Output Plan。

## 4. 变换 emit

按 plan 对每个文件做变换再写：

- JS / TS → SWC（可选 minify、独立 source map）
- WXSS / CSS → Lightning CSS；类 SCSS 走可选插件 `legacyScss()`
- WXML / JSON 做路径重写后写出
- 内容 hash 命中磁盘缓存则跳过变换

watch（`mpb dev`）在图上 patch：内容变了只重跑受影响的节点，拓扑或 plan 变了才扩大范围。配置文件变更会 `reloadConfig` 后全量。

## 看图

```bash
mpb inspect graph              # 每个节点一行：id / owner / 出边
mpb analyze                    # 写 dist/mpbuild-analyze.json
```

更多命令见 [CLI 参考](#/reference/cli)，分包染色细节见 [分包与子仓库](#/guide/subpackages)。
