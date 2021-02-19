---
title: 包分析
order: 1
---

# mp-analyzer

微信小程序包大小分析工具，类似 webpack-bundle-analyzer [github 地址](https://github.com/ximing/mp-analyzer)

![treemap demo](https://github.com/ximing/ana/raw/master/assets/images/treemap.png)

## cli 方式

### 安装

```shell
# npm
npm i -D mp-analyzer mpbuild-cli
# yarn
yarn add -D mp-analyzer mpbuild-cli
```

### 使用

```shell
mpb analyzer ./dist
```

## 编程方式

### 安装

```shell
# npm
npm i -D mp-analyzer
# yarn
yarn add -D mp-analyzer
```

### 使用

```javascript
const path = require('path');
const { default: ANA } = require('mp-analyzer');

const ana = new ANA(path.join(__dirname, '../dist'));
ana.run();
```
