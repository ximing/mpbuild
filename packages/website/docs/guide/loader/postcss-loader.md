---
title: postcss-loader
order: 3
---

## 说明

提供

## 安装

内置，直接使用 `loader: 'postcss-loader'` 即可,参考用法

## 用法

### 编程方式

<span class='success-tag'>推荐</span> `mpb.config.js`中直接声明`options`

```javascript
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
                            require('@yeanzhi/postcss-advanced-variables')({
                                variables: rFile.themes,
                                disable: '@mixin, @include,@content, @import',
                            }),
                            require('postcss-nested')({ bubble: ['keyframes'] }),
                            require('cssnano')({
                                preset: ['default', { calc: false }],
                            }),
                        ],
                    },
                },
                {
                    loader: 'replace-loader',
                    options: loaderOptions,
                },
            ],
        },
    ];
}
```

### 配置方式

`postcss.config.js`

```javascript
module.exports = {
    parser: 'sugarss',
    plugins: {
        'postcss-import': {},
        'postcss-cssnext': {},
        cssnano: {},
    },
};
```

`mpb.config.js`

```json
{
    "loader": "postcss-loader",
    "options": {
        "config": {
            "path": "path/to/postcss.config.js"
        }
    }
}
```
