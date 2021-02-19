---
title: 生命周期钩子
order: 1
group:
    title: 插件能力
    order: 2
---

## 简介

mpbuild 插件机制基于 [tapable@1](https://github.com/webpack/tapable/tree/tapable-1) 实现，钩子含义可以参照 tapable 文档

## hooks

| 事件                | 参数                                                                     | 钩子类型                 | 备注                                                             |
| ------------------- | ------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------- |
| start               | mpb                                                                      | AsyncParallelHook        | mpbuild 启动时，配置等信息还没准备完毕                           |
| configProcess       | opt                                                                      | SyncWaterfallHook        | 启动后对配置文件进行处理时触发                                   |
| beforeCompile       | mpb                                                                      | AsyncParallelHook        | 开始构建前，配置信息均准备完毕，只会触发一次                     |
| resolveAppEntryJS   | entryObject                                                              | SyncBailHook             | 解析 entry 的时候触发，可以在这里更改 entry 内容                 |
| afterGenerateEntry  | mpb                                                                      | AsyncSeriesBailHook      | appEntry 确定后触发                                              |
| afterCompile        | mpb                                                                      | AsyncParallelHook        | 每次构建完成触发，watch 模式下每次文件变更导致重新构建会触发一次 |
| beforeAddAsset      | asset                                                                    | AsyncSeriesWaterfallHook | 文件被添加到 mpbuild 依赖图中之前触发                            |
| resolve             | {lib: src,resolveLib: '',asset,resolveType: 'wxss',exts: mpb.exts.wxss,} | SyncWaterfallHook        | 解析文件原始路径                                                 |
| rewriteOutputPath   | {filePath: libPath,asset,depType: 'js'}                                  | SyncWaterfallHook        | 重写文件输出路径                                                 |
| addAsset            | asset                                                                    | AsyncSeriesBailHook      | 文件被添加到 mpbuild 依赖图时触发                                |
| delAsset            | asset                                                                    | AsyncSeriesBailHook      | 文件被从 mpbuild 依赖图中删除时触发                              |
| beforeEmitFile      | asset                                                                    | AsyncSeriesWaterfallHook | 文件被写到磁盘之前触发                                           |
| resolveJS           | { lib, asset }                                                           | SyncBailHook             | JS 文件中依赖被解析之前触发，返回 null 此依赖不会被解析          |
| beforeOutputAppJSON | app.json                                                                 | SyncWaterfallHook        | 处理 app.json                                                    |
