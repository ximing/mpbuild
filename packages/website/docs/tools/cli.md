---
title: CLI
order: 0
nav:
    title: 工程工具
    order: 3
---

# CLI

### 安装

```shell
# npm
npm i -D mpbuild-cli
# yarn
yarn add -D mpbuild-cli
```

### 命令

```shell
Usage: mpb [options] [command]

Options:
  -V, --version          输出版本号
  -c, --config <config>  设置配置文件地址,默认 mpb.config.js
  -cwd, --cwd <cwd>      设置 cwd
  -w, --watch            开启 watch 模式
  -h, --help             查看help

Commands:
  analyze <path>         使用 https://github.com/ximing/mp-analyzer 分析包体积
```

### 事例

```shell
# 普通构建:
npx mpb

# watching模式构建:
npx mpb -w
```
