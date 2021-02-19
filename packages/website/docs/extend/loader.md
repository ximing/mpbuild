---
title: loader
order: 1
---

## 说明

loader 是一个高阶函数，最外层函数接收配置文件(`mpb.config.js`)中的 options 配置信息，然后返回一个函数，注意这里不能使用高阶函数，因为 mpbuild 在执行 loader 的时候回将 this 指定为 mpb 实例。返回函数接受 asset 作为参数，返回一个 asset 作为返回值

## 样例

```javascript
const path = require('path');
const _ = require('lodash');

module.exports = function (opts) {
    return function replaceLoader(asset) {
        try {
            let contents = JSON.parse(asset.contents);
            if (contents.extends) {
                if (typeof contents.extends === 'string') {
                    let filePath = '';
                    if (contents.extends[0] === '.') {
                        filePath = path.resolve(asset.dir, contents.extends);
                    } else {
                        filePath = path.join(this.src, contents.extends);
                    }
                    contents = _.merge({}, contents, require(filePath));
                    delete contents.extends;
                    asset.contents = JSON.stringify(contents);
                } else {
                    console.error('[json-loader] extends 必须为字符串');
                }
            }
        } catch (e) {
            console.error('[json-loader]', e);
        }
        return asset;
    };
};
```
