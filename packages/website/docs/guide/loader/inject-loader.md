---
title: inject-loader
order: 9
---

## 说明

注入一些环境信息，默认注入 `__dirname`和`__filename`，以 dist 目录为起点

## 安装

内置，直接使用 `loader: 'inject-loader'` 即可,参考用法

## 用法

```javascript
module: {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            exclude: ['**/node_modules/**/*'],
            use: [
                {
                    loader: 'babel-loader',
                    options: { comments: true },
                },
                {
                    loader: 'inject-loader',
                    options: {
                        // 可以不写
                        custom: function (asset, mpe) {
                            return {};
                        },
                    },
                },
            ],
        },
    ];
}
```
