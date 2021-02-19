---
title: ProjectConfigPlugin
order: 3
---

## 说明

生成微信小程序[项目配置文件](https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html)

## 用法

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.ProjectConfigPlugin({
            projectname: '测试项目',
            appId: '微信小程序appId',
            setting: {
                minified: true,
            },
        }),
    ],
};
```
