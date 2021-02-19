---
title: 实现一个插件
order: 2
---

## 说明

plugin 就是一个普通的类，我们需要实现 apply 方法，apply 会传入 mpb 的实例，然后使用`mpb.hooks`提供的钩子切入到构建过程即可

## 样例

```javascript
module.exports = class SubPackagesPlugin {
    constructor(opt = {}) {
        this.mustIncludeSubPackage = opt.mustIncludeSubPackage || [];
    }

    apply(mpb) {
        mpb.hooks.resolveAppEntryJS.tap('SubPackagesPlugin', (appEntry) => {
            if (mpb.__subPackages && typeof mpb.__subPackages === 'string') {
                console.log('进入指定子包编译模式，编译子包为:', mpb.__subPackages);
                const subPackageRootArr = this.mustIncludeSubPackage.concat(
                    mpb.__subPackages.split(',')
                );
                const entry = _.cloneDeep(appEntry);
                entry.router = entry.router.filter((item) => {
                    return !item.root || subPackageRootArr.includes(item.root);
                });
                delete entry.preloadRule;
                return entry;
            }
            return appEntry;
        });
    }
};
```
