---
title: 快速上手
order: 0
nav:
  title: 指南
  order: 1
---

# 快速上手

新建 `mpb.config.js`

```javascript
const path = require('path');
const MPB = require('mpbuild');

module.exports = entry => {
  return {
    // 入口配置文件
    entry,
    // 源码对应目录
    src: path.join(__dirname, 'src'),
    alias: {},
    output: {
      path: path.join(__dirname, 'dist'),
      npm: 'npm',
    },
    platform: 'wx',
    optimization: {
      // 如果需要压缩，配置 JS 固话需要过滤的 comment
      minimize: {
        js: true,
        wxml: true,
        json: true,
      },
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
};
```

新建 `build.js`

```javascript
const MPB = require('mpbuild');
const mbpConfig = require('./mpb.config');
const mpb = new MPB(mbpConfig('src/app.json'));
(async () => {
  // await mpb.run();
  await mpb.watch();
})();
```

启动构建

```bash
node build.js
```
