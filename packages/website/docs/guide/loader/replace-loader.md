---
title: replace-loader
order: 5
---

## 说明

正则的方式替换任意文本文件内容

## 安装

内置，直接使用 `loader: 'replace-loader'` 即可,参考用法

## 用法

```javascript
const replaceMap = {
    $NODE_ENV: 'test',
    $VERSION: '1.0.0',
};
const replaceLoaderOptions = {
    search: /\$NODE_ENV|\$VERSION/g,
    replacement(match) {
        if (replaceMap[match] != null) {
            return replaceMap[match];
        }
        if (replaceMap[match] == null) console.error('jsReplaceLoaderOptions', match);
        return match;
    },
};
module: {
    rules: [
        {
            test: /\.json$/,
            use: [
                {
                    loader: 'replace-loader',
                    options: jsReplaceLoaderOptions,
                },
            ],
        },
    ];
}
```
