---
title: 快速上手
order: 0
nav:
    title: 指南
    order: 1
---

# 快速上手

## cli 方式

### 安装依赖

```shell
# npm
npm i mpbuild
npm i -D mpbuild-cli
# yarn
yarn add mpbuild
yarn add -D mpbuild-cli
```

### 创建配置文件

新建 `mpb.config.js`

```javascript
const path = require('path');
const MPB = require('mpbuild');

module.exports = {
    // 入口配置文件
    entry: './entry.js',
    // 源码对应目录
    src: path.join(__dirname, 'src'),
    alias: {},
    output: {
        path: path.join(__dirname, 'dist'),
        npm: 'npm',
    },
    module: {
        rules: [
            {
                test: /\.wxss$/,
                use: [],
            },
            {
                test: /\.js$/,
                include: [],
                exclude: ['**/node_modules/**'],
                use: [
                    {
                        loader: 'babel-loader',
                        options: { comments: true },
                    },
                ],
            },
            {
                test: /\.json$/,
                use: [
                    {
                        loader: 'json-loader',
                    },
                ],
            },
            {
                test: /\.wxs$/,
                use: [],
            },
            {
                test: /\.wxml$/,
                use: [],
            },
        ],
    },
    plugins: [
        new MPB.CleanMbpPlugin({
            path: ['dist/**/*', '!dist/project.config.json'],
        }),
        new MPB.ProjectConfigPlugin({
            projectname: 'test',
            appId: 'test',
            setting: {
                minified: true,
            },
        }),
    ],
};
```

更多插件查看[插件](/guide/plugin/clean-plugin)

### 构建项目

```shell
# watch 模式
mpb -w
# build 模式
mpb
```

## 编程方式

### 安装依赖

```shell
# npm
npm i mpbuild
# yarn
yarn add mpbuild
```

### 创建配置文件

如上

### 构建脚本

新建 `build.js`

```javascript
const MPB = require('mpbuild');
const mbpConfig = require('./mpb.config');
const mpb = new MPB(mbpConfig);
(async () => {
    // 构建模式
    // await mpb.run();
    // watch 模式
    await mpb.watch();
})();
```

### 构建项目

```shell
node build.js
```
