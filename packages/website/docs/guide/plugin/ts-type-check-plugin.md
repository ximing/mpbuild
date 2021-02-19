---
title: TsTypeCheckPlugin
order: 4
---

## 说明

TsTypeCheckPlugin 会使用独立进程进行 typescript 的类型校验,不会阻塞构建流程

## 用法

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.TsTypeCheckPlugin({
            // tsconfig.json 文件所在目录
            project: __dirname,
            // 出现ts异常后是否退出构建，默认 true
            // 此选项只在非watch模式下生效，watch模式会notifier
            kill: true,
        }),
    ],
};
```
