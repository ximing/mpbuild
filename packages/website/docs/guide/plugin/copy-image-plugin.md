---
title: CopyImagePlugin
order: 1
---

## 说明

图片 copy

## 用法

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.CopyImagePlugin({
            srcFiles: {
                // 源文件(绝对路径)： 目标路径(相对于 output)
                '/absolute/image/path/xxx.png': '/images/xxx.png',
            },
            output: path.join(__dirname, 'dist'),
        }),
    ],
};
```
