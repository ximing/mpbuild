---
title: SubPackagesPlugin
order: 5
---

## 说明

目前微信小程序逐步放开总包大小到 16M，这导致很多小程序逐渐变成一个平台类型的超级小程序，整个开发编译耗时长(包括 mpbuild 编译和微信开发者工具编译耗)，因为编译层已经优化过几次，剩下的一些通用优化手段并不能大幅度提升开发效率，所以系统通过减少编译量的方式提升编译速度和微信小程序预览速度

## 思路

小程序本身支持分包的机制，一般情况下基本能做到子包内聚一块业务，所以只需要构建主包+需要的子包 即可。

构建时间上的优化有两部分

-   首次构建时 mpbuild 构建速度更快，开发者工具预览时长更短
-   rebuild 构建时 mpbuild 基本没变化，但开发者工具预览时间会更快

另一个收益是降低内存占用和磁盘文件 watch

## 使用

### 配置插件

SubPackagesPlugin 提供了一个 mustIncludeSubPackage 配置，这个配置中配置的包是会一起构建出来的，因为有些子包是整个业务流程必须的一环，没必要每次都声明要构建这个子包，所以默认就添加到配置中去了

```javascript
const MPB = require('mpbuild');
module.exports = {
    plugins: [
        new MPB.SubPackagesPlugin({
            // 不管怎么样都会构建sub1子包
            mustIncludeSubPackage: ['sub1'],
        }),
    ],
};
```

### 命令

只需要在原有的 命令后面追加 --subPackages=a 包名称,b 包名称,c 包名称 即可，多个子包用,分割

如果只编译主包使用 --subPackages=none 即可

```shell
mpb --subPackages=sub1 # 构建主包+sub1分包
mpb --subPackages=sub1,sub2,sub3 # 构建主包+sub1+sub2+sub3分包
mpb --subPackages=none # 只构建主包
```
