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
            // 块级别注入上下文
            blockContext: {},
        }),
    ],
};
```

## 参数

### platform

当前平台，用来确定平台编译

### blockcode

是否开启代码级条件编译

### blockContext

块级别注入上下文,格式为 key:value

```javascript
// 举例
// 注入
blockContext = {
    NODE_ENV: 'production',
    DEBUG: 'true',
};

// @ifdef DEBUG
console.log('保留');
// @endif

// @ifndef DEBUG
console.log('不保留');
// @endif

// @if DEBUG!='true'
console.log('不保留');
// @endif

// @if NODE_ENV='production'
console.log('保留');
// @endif
```
