---
title: 基础配置
order: 0
group:
  title: 基本概念
  order: 1
---

## entry

mpbuild 使用入口起点(entry point) 来构建其内部依赖图。进入入口起点后，mpbuild 会按照小程序的依赖关系找出有哪些模块是入口起点（直接和间接）依赖的。

可以通过在 mpbuild 配置中配置 entry 属性，来指定一个入口起点（或多个入口起点）。

```javascript
module.exports = {
  entry: './path/to/my/entry/file.js',
};
```

## output

output 属性告诉 mpbuild 在哪里输出构建后的文件，支持两个配置，path 字段为输出文件目录，[npm](./npm) 字段为 npm 包输出目录名称

```javascript
const path = require('path');

module.exports = {
  entry: './path/to/my/entry/file.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    npm: 'npm',
  },
};
```

[comment]: <> (## platform)

[comment]: <> (mpbuild 支持[多态协议]&#40;./poly&#41; platform 字段指定当前构建的是哪个平台的字段)

## optimization

压缩指令

```javascript
const path = require('path');

module.exports = {
  entry: './path/to/my/entry/file.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    npm: 'npm',
  },
  optimization: {
    // 如果需要压缩，配置 JS 固话需要过滤的 comment
    minimize: {
      // 压缩使用uglify，可以传入uglify 参数，也可以是true
      js: uglifyOption
        ? uglifyOption
        : {
            toplevel: true,
          },
      // js: true
      wxml: {
        // 支持include 和 exclude，哪些文件需要压缩，哪些文件不需要压缩
        exclude: ['**/dynamic/lib/**/core.wxml'],
      },
      json: true,
      wxs: {
        exclude: ['**/dynamic/lib/**/*.wxs'],
      },
    },
  },
};
```

## exts

小程序各个类型文件扫描的文件后缀,默认值如下：

```javascript
module.exports = {
  exts: {
    js: ['.js', '.ts'],
    wxml: ['.wxml'],
    wxss: ['.wxss'],
    wxs: ['.wxs'],
    json: ['.json', '.config.js'],
  },
};
```

## loader

loader 让 mpbuild 能够按照不同文件类型去处理不同的文件 ，loader 有两个主要配置：

test 属性，用于标识出应该被对应的 loader 进行转换的某个或某些文件。
use 属性，表示进行转换时，应该使用哪个 loader。

```javascript
module.exports = {
  output: {
    filename: 'my-first-webpack.bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.wxss$/,
        use: [
          {
            loader: 'postcss-loader',
            options: {
              parser: require('postcss-scss'),
              plugins: [
                require('cssnano')({
                  preset: ['default', { calc: false }],
                }),
              ],
            },
          },
        ],
      },
      {
        test: /\.js$/,
        include: [
          '**/node_modules/@mtfe/**/*',
          '**/node_modules/@tarojs/**/*',
          '**/node_modules/@dp/owl-wxapp/es6/**/*',
        ],
        exclude: ['**/node_modules/**'],
        use: [
          {
            loader: 'babel-loader',
            options: { comments: true },
          },
        ],
      },
      {
        test: /\.(ts|tsx)$/,
        include: ['**/node_modules/@mtfe/**/*', '**/node_modules/@tarojs/**/*'],
        exclude: ['**/node_modules/**/*'],
        use: [
          {
            loader: 'babel-loader',
            options: { comments: true },
          },
          {
            loader: 'ts-loader',
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
};
```

## plugin

loader 被用于转换某些类型的文件，而插件则可以用于执行范围更广的任务。插件的范围包括，从打包优化和压缩，一直到重新定义环境中的变量。插件接口功能极其强大，可以用来处理各种各样的任务。

想要使用一个插件，你只需要 require() 它，然后把它添加到 plugins 数组中。多数插件可以通过选项(option)自定义。你也可以在一个配置文件中因为不同目的而多次使用同一个插件，这时需要通过使用 new 操作符来创建它的一个实例。

mpbuild 提供许多开箱可用的插件！查阅我们的插件列表获取更多信息。

```javascript
const MPB = require('mpbuild');
module.exports = {
  plugins: [
    new MPB.CleanMbpPlugin({
      path: ['dist/**/*', '!dist/project.config.json'],
    }),
    new MPB.TsTypeCheckPlugin({
      project: __dirname,
    }),
    new MPB.ProjectConfigPlugin({
      projectname: rFile.values.brandName,
      appId: rFile.values.appId,
      setting: {
        minified: true,
      },
    }),
  ],
};
```
