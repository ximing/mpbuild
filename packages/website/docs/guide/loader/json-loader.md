---
title: json-loader
order: 4
---

## 说明

让 .json 文件支持 `extends` 属性

## 安装

内置，直接使用 `loader: 'json-loader'` 即可,参考用法

## 用法

### 配置

```javascript
module: {
    rules: [
        {
            test: /\.json$/,
            use: [
                {
                    loader: 'json-loader',
                },
            ],
        },
    ];
}
```

### 用法

```json
{
    "extends": "./base.json",
    "key1": "1",
    "key2": "2"
}
```
