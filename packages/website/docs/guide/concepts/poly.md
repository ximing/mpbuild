---
title: 条件编译
order: 3
---

## 简介

主要 2 个目标：

-   保障多端可维护性，大量写 if else，会造成代码执行性能低下和管理混乱
-   编译时拆分多端代码，保证包体积

条件编译有两种模式[代码块级别](#代码块级别)和[文件级别](#文件级别)，默认不开启，需引入`PolymorphismPlugin`开启

## 使用方式

```javascript
const { PolymorphismPlugin } = require('mpbuild');
module.exports = {
    plugins: [
        new PolymorphismPlugin({
            platform: 'wx',
            // 是否开启代码块级别条件编译，默认开启
            blockcode: true,
        }),
    ],
};
```

## 代码块级别

在 C 语言中，通过宏的方式，为 windows、mac 等不同 os 编译不同的代码。`mpbuild` 参考这个思路提供了条件编译手段

### 条件编译

条件编译是用特殊的注释作为标记，在编译时根据这些特殊的注释，将注释里面的代码编译到不同平台。

写法：以 <span style="color:#859900;"> @ifdef</span> 或 <span style="color:#859900;"> @ifndef</span> 加<b style="color:#268BD2"> %PLATFORM%</b> 开头，以 <span style="color:#859900;">@endif</span> 结尾。

-   <span style="color:#859900;"> @ifdef</span>：if defined 仅在某平台存在
-   <span style="color:#859900;"> @ifndef</span>：if not defined 除了某平台均存在
-   <b style="color:#268BD2"> %PLATFORM%</b>：平台名称

| 条件编译写法                                      | 说明                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| @ifdef **wx** 需条件编译的代码 @endif             | 仅出现在 微信小程序 下的代码                                              |
| @ifndef **wx** 需条件编译的代码 @endif            | 除了 微信小程序，其它平台均存在的代码                                     |
| @if **wx** \|\| **h5** 需条件编译的代码 @endif | 在 微信小程序或 h5 存在的代码（这里只有\|\|，不可能出现&&，因为没有交集） |

<b style="color:#268BD2"> %PLATFORM%</b> 取值为插件参数中的中 platform 字段

**支持的文件**

-   .wxml
-   .js/ts
-   .wxss
-   .json
-   .wxs
-   各预编译语言文件，如：.scss、.less、.stylus、.ts、.pug 等

**注意：**

-   条件编译是利用注释实现的，在不同语法里注释写法不一样，js/ts/wxs/wxss/less/postcss 等建议使用 `// 注释` 也可以使用 `/* 注释 */`。wxml 等模板里必须使用 `<!-- 注释 -->`；

#### JS 类文件 的条件编译

示例，如下代码仅在 微信平台 下出现:

```javascript
// @ifdef wx
console.log('wx platform');
// @endif
```

示例，如下代码不会在 微信 平台上出现：

```javascript
// @ifndef wx
console.log('wx platform');
// @endif
```

除了支持单个平台的条件编译外，还支持**多平台**同时编译，使用 || 来分隔平台名称。

示例，如下代码会在 App 和 H5 平台上出现：

```javascript
// @ifdef wx || h5
console.log('wx platform');
// @endif
```

### 组件的条件编译

示例，如下公众号关注组件仅会在微信小程序中出现：

```html
<view>
    <view>微信公众号关注组件</view>
    <view>
        <!-- 但可直接使用微信原生的official-account组件-->
        <!-- @ifdef wx -->
        <official-account></official-account>
        <!-- @endif -->
    </view>
</view>
```

### 样式的条件编译

```css
/* @ifdef wx */
.color {
    text: red;
}
/* @endif */
```

```less
// @ifdef wx
.color {
    text: red;
}
// @endif
```

### 配置文件 的条件编译

小程序的配置文件为 `.json` 文件，json 文件按照规范是不能有注释的，因此，建议配置文件使用 `.config.js` 来描述，这样可以使用[JS 类文件](#js-类文件-的条件编译)的条件编译 来进行描述

## 文件级别

所有类型文件均可以使用可以使用后缀的形式进行文件级别的条件编译, `*.platform.js`,`*.platform.wxml`等，比如：

```
┌─component
│  ├─a.ts
│  ├─a.config.js
│  ├─a.wx.config.js
│  ├─a.mt.wxml
│  └─a.wx.wxml
├─app.wx.js
├─app.js
├─app.mt.json
└─app.json
```

mpbuild 构建的时候，会优先寻址带 platform 后缀的文件，找不到使用不带 platform 后缀的文件兜底

## 说明

-   有些跨端工具可以提供 js 的条件编译或多态，但这对于实际开发远远不够。mpbuild 不止是处理 js，任何代码都可以多端条件编译，才能真正解决实际项目的跨端问题。另外代码块级别的条件编译在实际开发中不会造成大量冗余代码，相对利于复用和维护。
-   产品总是给不同平台提不同需求。关键在于项目里，复用的代码多还是个性的代码多，正常都是复用的代码多，所以仍然应该多端。而个性的代码放到不同平台的目录下，差异化维护。
