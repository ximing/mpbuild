# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.0.8](https://github.com/ximing/mpbuild/compare/v1.4.13...v4.0.8) (2021-01-09)


### Features

* remove use strict ([76c9e93](https://github.com/ximing/mpbuild/commit/76c9e93c4c11620e87eb4bcc2c681c3008410162))
* v4 ([809865d](https://github.com/ximing/mpbuild/commit/809865d7ea881a251a2362a87e562da798050519))
* 修复wxs解析依赖的问题 ([2beda78](https://github.com/ximing/mpbuild/commit/2beda78f99f7c706de5b515c1b352d2a589ac551))
* 前置 entry获取 ([9fcb798](https://github.com/ximing/mpbuild/commit/9fcb798b29572d77ad9eb2e3dff1881563e04930))
* 升级 ([abea7d6](https://github.com/ximing/mpbuild/commit/abea7d64d0c9056833aadbc0b30a47440bc15686))
* 升级最低nodejs版本 ([6ace6f5](https://github.com/ximing/mpbuild/commit/6ace6f57fb26b53bec5f398988fba2f23eb9912f))
* 压缩wxs ([6da23ed](https://github.com/ximing/mpbuild/commit/6da23ed5030f3c3dbb65abc1c723ac5a7af18a8e))
* 新增resolve 模块 ([d07bef4](https://github.com/ximing/mpbuild/commit/d07bef41ed60a8c790b91a94dd1acba0e9c202f8))
* 添加website ([554987d](https://github.com/ximing/mpbuild/commit/554987d47a61ba2a4a07b3264123ef8cbef88101))


### Bug Fixes

* loader asset不变的bug ([337f5ae](https://github.com/ximing/mpbuild/commit/337f5ae8ec9cd33e124548a53d78719f1e71f8fe))
* loader asset不变的bug ([0af8b2f](https://github.com/ximing/mpbuild/commit/0af8b2f1e779ffa71a58e71e49a92edb263e5d7d))

### [1.4.13](https://github.com/ximing/mpbuild/compare/v1.4.12...v1.4.13) (2020-12-17)


### Features

* 修改变量名 ([aef44e1](https://github.com/ximing/mpbuild/commit/aef44e1))



### 1.4.12 (2020-12-17)


### Bug Fixes

* watch下 json依赖不生效问题 ([6f2b02f](https://github.com/ximing/mpbuild/commit/6f2b02f))
* 支持asset自定义 target ([04b3339](https://github.com/ximing/mpbuild/commit/04b3339))
* 没有考虑到wxs是内联而不是src的情况，修改该bug ([f82aa28](https://github.com/ximing/mpbuild/commit/f82aa28))
* 默认不支持taro文件编译 ([6f8e016](https://github.com/ximing/mpbuild/commit/6f8e016))


### Features

* change keywords ([b61472c](https://github.com/ximing/mpbuild/commit/b61472c))
* components support ([370360d](https://github.com/ximing/mpbuild/commit/370360d))
* fix alias path ([18f6c32](https://github.com/ximing/mpbuild/commit/18f6c32))
* fix all bugs ([2188b85](https://github.com/ximing/mpbuild/commit/2188b85))
* init project ([9d6616a](https://github.com/ximing/mpbuild/commit/9d6616a))
* js中引入外部json直接编译到js文件里面 ([1ac4dc3](https://github.com/ximing/mpbuild/commit/1ac4dc3))
* minifyJS options.output.comment 添加默认值 ([e967dac](https://github.com/ximing/mpbuild/commit/e967dac))
* npm包查找方式修改 ([b5ffa81](https://github.com/ximing/mpbuild/commit/b5ffa81))
* release 1.1.0 ([42d9fa1](https://github.com/ximing/mpbuild/commit/42d9fa1))
* release 1.2.12 ([3dff767](https://github.com/ximing/mpbuild/commit/3dff767))
* release 1.2.7 ([77f650e](https://github.com/ximing/mpbuild/commit/77f650e))
* release 1.4.5 ([c670792](https://github.com/ximing/mpbuild/commit/c670792))
* release 1.4.9 ([1973774](https://github.com/ximing/mpbuild/commit/1973774))
* release: 1.1.2 ([9ec5359](https://github.com/ximing/mpbuild/commit/9ec5359))
* release: 1.2.0 ([87f5c38](https://github.com/ximing/mpbuild/commit/87f5c38))
* ts 支持更好的错误提示 ([aa3396f](https://github.com/ximing/mpbuild/commit/aa3396f))
* ts 支持类型校验 ([99a41e0](https://github.com/ximing/mpbuild/commit/99a41e0))
* typescript 支持类型校验 ([80c72d2](https://github.com/ximing/mpbuild/commit/80c72d2))
* 使用重试机制，防止提前kill ([e2b6b55](https://github.com/ximing/mpbuild/commit/e2b6b55))
* 使用阿里云的源 进行图片压缩处理 ([d3ffc92](https://github.com/ximing/mpbuild/commit/d3ffc92))
* 修复 引用路径问题 ([696d839](https://github.com/ximing/mpbuild/commit/696d839))
* 修复env ([ddc13bf](https://github.com/ximing/mpbuild/commit/ddc13bf))
* 修复js引入失败问题 ([bb4d3f2](https://github.com/ximing/mpbuild/commit/bb4d3f2))
* 修复process问题 ([54dab45](https://github.com/ximing/mpbuild/commit/54dab45))
* 修复resolveJS问题 ([4441f27](https://github.com/ximing/mpbuild/commit/4441f27))
* 修复watch重启两次的问题 ([51ba6a9](https://github.com/ximing/mpbuild/commit/51ba6a9))
* 修复wxss依赖不正确的问题 ([88f7dc4](https://github.com/ximing/mpbuild/commit/88f7dc4))
* 修复依赖处理的问题 ([4edbc71](https://github.com/ximing/mpbuild/commit/4edbc71))
* 修复内存泄漏问题 ([ef7490e](https://github.com/ximing/mpbuild/commit/ef7490e))
* 修复包引用关系 ([9a01f1f](https://github.com/ximing/mpbuild/commit/9a01f1f))
* 升级依赖 ([290321c](https://github.com/ximing/mpbuild/commit/290321c))
* 升级依赖包 ([ee2d536](https://github.com/ximing/mpbuild/commit/ee2d536))
* 去除无用代码 ([e325324](https://github.com/ximing/mpbuild/commit/e325324))
* 去除无用依赖 ([be8174b](https://github.com/ximing/mpbuild/commit/be8174b))
* 去除无用的ts引用检测 ([de797ed](https://github.com/ximing/mpbuild/commit/de797ed))
* 增加minify include exclude ([1bfdce0](https://github.com/ximing/mpbuild/commit/1bfdce0))
* 增加关闭pool功能 ([5a0269f](https://github.com/ximing/mpbuild/commit/5a0269f))
* 引入taro ([068b82f](https://github.com/ximing/mpbuild/commit/068b82f))
* 支持 json 继承 ([ff30f50](https://github.com/ximing/mpbuild/commit/ff30f50))
* 支持entry内容解析 ([ef498ca](https://github.com/ximing/mpbuild/commit/ef498ca))
* 支持optimization 参数 ([b63a27a](https://github.com/ximing/mpbuild/commit/b63a27a))
* 支持tsx ([7a74be2](https://github.com/ximing/mpbuild/commit/7a74be2))
* 支持wxml 直接include npm包的内容，支持wxss支持 import npm的样式 ([001db8a](https://github.com/ximing/mpbuild/commit/001db8a))
* 支持wxs ([e10937d](https://github.com/ximing/mpbuild/commit/e10937d))
* 支持任意地址链接 ([f3921c5](https://github.com/ximing/mpbuild/commit/f3921c5))
* 支持传参 ([c2fb1f7](https://github.com/ximing/mpbuild/commit/c2fb1f7))
* 支持更多配置 ([4fdc10d](https://github.com/ximing/mpbuild/commit/4fdc10d))
* 支持更好的增量编译 ([dd1499d](https://github.com/ximing/mpbuild/commit/dd1499d))
* 新增entry文件监控 ([d8b4852](https://github.com/ximing/mpbuild/commit/d8b4852))
* 新增js解析钩子 ([1dfa5d0](https://github.com/ximing/mpbuild/commit/1dfa5d0))
* 新增rename loader ([92c5b5d](https://github.com/ximing/mpbuild/commit/92c5b5d))
* 更换watch到watchpack ([8c6229a](https://github.com/ximing/mpbuild/commit/8c6229a))
* 添加js resolve 钩子 ([3eef067](https://github.com/ximing/mpbuild/commit/3eef067))
* 进程池加速 ([8318c70](https://github.com/ximing/mpbuild/commit/8318c70))



### 1.4.13 (2020-12-17)


### Bug Fixes

* watch下 json依赖不生效问题 ([6f2b02f](https://github.com/ximing/mpbuild/commit/6f2b02f))
* 支持asset自定义 target ([04b3339](https://github.com/ximing/mpbuild/commit/04b3339))
* 没有考虑到wxs是内联而不是src的情况，修改该bug ([f82aa28](https://github.com/ximing/mpbuild/commit/f82aa28))
* 默认不支持taro文件编译 ([6f8e016](https://github.com/ximing/mpbuild/commit/6f8e016))


### Features

* change keywords ([b61472c](https://github.com/ximing/mpbuild/commit/b61472c))
* components support ([370360d](https://github.com/ximing/mpbuild/commit/370360d))
* fix alias path ([18f6c32](https://github.com/ximing/mpbuild/commit/18f6c32))
* fix all bugs ([2188b85](https://github.com/ximing/mpbuild/commit/2188b85))
* init project ([9d6616a](https://github.com/ximing/mpbuild/commit/9d6616a))
* js中引入外部json直接编译到js文件里面 ([1ac4dc3](https://github.com/ximing/mpbuild/commit/1ac4dc3))
* minifyJS options.output.comment 添加默认值 ([e967dac](https://github.com/ximing/mpbuild/commit/e967dac))
* npm包查找方式修改 ([b5ffa81](https://github.com/ximing/mpbuild/commit/b5ffa81))
* release 1.1.0 ([42d9fa1](https://github.com/ximing/mpbuild/commit/42d9fa1))
* release 1.2.12 ([3dff767](https://github.com/ximing/mpbuild/commit/3dff767))
* release 1.2.7 ([77f650e](https://github.com/ximing/mpbuild/commit/77f650e))
* release 1.4.5 ([c670792](https://github.com/ximing/mpbuild/commit/c670792))
* release 1.4.9 ([1973774](https://github.com/ximing/mpbuild/commit/1973774))
* release: 1.1.2 ([9ec5359](https://github.com/ximing/mpbuild/commit/9ec5359))
* release: 1.2.0 ([87f5c38](https://github.com/ximing/mpbuild/commit/87f5c38))
* ts 支持更好的错误提示 ([aa3396f](https://github.com/ximing/mpbuild/commit/aa3396f))
* ts 支持类型校验 ([99a41e0](https://github.com/ximing/mpbuild/commit/99a41e0))
* typescript 支持类型校验 ([80c72d2](https://github.com/ximing/mpbuild/commit/80c72d2))
* 使用重试机制，防止提前kill ([e2b6b55](https://github.com/ximing/mpbuild/commit/e2b6b55))
* 使用阿里云的源 进行图片压缩处理 ([d3ffc92](https://github.com/ximing/mpbuild/commit/d3ffc92))
* 修复 引用路径问题 ([696d839](https://github.com/ximing/mpbuild/commit/696d839))
* 修复env ([ddc13bf](https://github.com/ximing/mpbuild/commit/ddc13bf))
* 修复js引入失败问题 ([bb4d3f2](https://github.com/ximing/mpbuild/commit/bb4d3f2))
* 修复process问题 ([54dab45](https://github.com/ximing/mpbuild/commit/54dab45))
* 修复resolveJS问题 ([4441f27](https://github.com/ximing/mpbuild/commit/4441f27))
* 修复watch重启两次的问题 ([51ba6a9](https://github.com/ximing/mpbuild/commit/51ba6a9))
* 修复wxss依赖不正确的问题 ([88f7dc4](https://github.com/ximing/mpbuild/commit/88f7dc4))
* 修复依赖处理的问题 ([4edbc71](https://github.com/ximing/mpbuild/commit/4edbc71))
* 修复内存泄漏问题 ([ef7490e](https://github.com/ximing/mpbuild/commit/ef7490e))
* 修复包引用关系 ([9a01f1f](https://github.com/ximing/mpbuild/commit/9a01f1f))
* 升级依赖 ([290321c](https://github.com/ximing/mpbuild/commit/290321c))
* 升级依赖包 ([ee2d536](https://github.com/ximing/mpbuild/commit/ee2d536))
* 去除无用代码 ([e325324](https://github.com/ximing/mpbuild/commit/e325324))
* 去除无用依赖 ([be8174b](https://github.com/ximing/mpbuild/commit/be8174b))
* 去除无用的ts引用检测 ([de797ed](https://github.com/ximing/mpbuild/commit/de797ed))
* 增加minify include exclude ([1bfdce0](https://github.com/ximing/mpbuild/commit/1bfdce0))
* 增加关闭pool功能 ([5a0269f](https://github.com/ximing/mpbuild/commit/5a0269f))
* 引入taro ([068b82f](https://github.com/ximing/mpbuild/commit/068b82f))
* 支持 json 继承 ([ff30f50](https://github.com/ximing/mpbuild/commit/ff30f50))
* 支持entry内容解析 ([ef498ca](https://github.com/ximing/mpbuild/commit/ef498ca))
* 支持optimization 参数 ([b63a27a](https://github.com/ximing/mpbuild/commit/b63a27a))
* 支持tsx ([7a74be2](https://github.com/ximing/mpbuild/commit/7a74be2))
* 支持wxml 直接include npm包的内容，支持wxss支持 import npm的样式 ([001db8a](https://github.com/ximing/mpbuild/commit/001db8a))
* 支持wxs ([e10937d](https://github.com/ximing/mpbuild/commit/e10937d))
* 支持任意地址链接 ([f3921c5](https://github.com/ximing/mpbuild/commit/f3921c5))
* 支持传参 ([c2fb1f7](https://github.com/ximing/mpbuild/commit/c2fb1f7))
* 支持更多配置 ([4fdc10d](https://github.com/ximing/mpbuild/commit/4fdc10d))
* 支持更好的增量编译 ([dd1499d](https://github.com/ximing/mpbuild/commit/dd1499d))
* 新增entry文件监控 ([d8b4852](https://github.com/ximing/mpbuild/commit/d8b4852))
* 新增js解析钩子 ([1dfa5d0](https://github.com/ximing/mpbuild/commit/1dfa5d0))
* 新增rename loader ([92c5b5d](https://github.com/ximing/mpbuild/commit/92c5b5d))
* 更换watch到watchpack ([8c6229a](https://github.com/ximing/mpbuild/commit/8c6229a))
* 添加js resolve 钩子 ([3eef067](https://github.com/ximing/mpbuild/commit/3eef067))
* 进程池加速 ([8318c70](https://github.com/ximing/mpbuild/commit/8318c70))
