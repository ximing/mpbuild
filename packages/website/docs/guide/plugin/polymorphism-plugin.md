---
title: PolymorphismPlugin
order: 2
---

## 说明

详细介绍查看[条件编译](/guide/concepts/poly)

## 用法

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.PolymorphismPlugin({
            // 当前平台
            platform: 'wx',
            // 是否开启代码级条件编译
            blockcode: true,
        }),
    ],
};
```
