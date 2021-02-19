---
title: babel-loader
order: 1
group:
    title: loader
    order: 2
---

## 安装

内置，直接使用 `loader: 'babel-loader'` 即可,参考用法

## 用法

```javascript
module.exports = {
    module: {
        rules: [
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
        ],
    },
};
```

### 配置文件

推荐使用 `babel.config.js` 来进行 babel 配置，详细查看[babel 文档](https://babeljs.io/docs/en/configuration#babelconfigjson)

### 编程方式

参考 babel [选项](https://babeljs.io/docs/usage/api/#options)

你可以使用 options 属性 来给 loader 传递选项：

```javascript
module: {
    rules: [
        {
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env'],
                    plugins: [require('@babel/plugin-transform-object-rest-spread')],
                },
            },
        },
    ];
}
```

## 疑难解答

### babel-loader 很慢！

确保转译尽可能少的文件。你可能使用 /\.js$/ 来匹配，这样也许会去转译 node_modules 目录或者其他不需要的源代码。

要排除 node_modules，参考文档中的 loaders 配置的 exclude 选项。

你也可以通过使用 cacheDirectory 选项，将 babel-loader 提速至少两倍。 这会将转译的结果缓存到文件系统中。

### babel 在每个文件都插入了辅助代码，使代码体积过大！

babel 对一些公共方法使用了非常小的辅助代码，比如 \_extend。 默认情况下会被添加到每一个需要它的文件中

你可以引入 babel runtime 作为一个独立模块，来避免重复引入。

下面的配置禁用了 babel 自动对每个文件的 runtime 注入，而是引入 babel-plugin-transform-runtime 并且使所有辅助代码从这里引用。

更多信息请参考[文档](http://babeljs.io/docs/plugins/transform-runtime/)。

注意： 你必须执行 `npm install babel-plugin-transform-runtime --save-dev` 来把它包含到你的项目中，也要使用 `npm install babel-runtime --save` 把 babel-runtime 安装为一个依赖。
