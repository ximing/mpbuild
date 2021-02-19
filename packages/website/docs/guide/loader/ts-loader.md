---
title: ts-loader
order: 2
---

## 说明

-   `ts-loader` 本身不具备 ts 类型校验能力，如需类型校验请使用[TsTypeCheckPlugin](/guide/plugin/ts-type-check-plugin)，TsTypeCheckPlugin 会使用独立进程进行类型校验
-   建议直接使用 `babel-loader` 的 [@babel/preset-typescript](https://babeljs.io/docs/en/babel-preset-typescript) 构建 typescript
-   建议`tsconfig.json` 中 "target" 设置为 "ESNext"，然后使用 babel 后置构建为 ES5

## 安装

内置，直接使用 `loader: 'ts-loader'` 即可,参考用法

## 用法

```javascript
module: {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            exclude: ['**/node_modules/**/*'],
            use: [
                {
                    loader: 'babel-loader',
                    options: { comments: true },
                },
                {
                    loader: 'ts-loader',
                },
            ],
        },
    ];
}
```
