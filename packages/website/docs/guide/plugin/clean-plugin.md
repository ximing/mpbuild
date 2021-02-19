---
title: CleanMbpPlugin
order: 0
group:
    title: 内置插件
    order: 3
---

## 说明

清除目录,path 支持[glob 语法](https://github.com/mrmlnc/fast-glob#options-3)

## 用法

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.CleanMbpPlugin({
            path: ['dist/**/*', '!dist/project.config.json'],
        }),
    ],
};
```
