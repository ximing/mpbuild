# coverage

这个小程序把 mpbuild 已经支持的能力放进同一次构建：router 主包、普通分包、独立分包、平台中缀、条件编译、`config.js`、TypeScript、抽象组件、`copy`、动态 `import`、`file:` npm 依赖和子仓库。磁盘上没有 `src/app.json`，页面来自 `entry.js` 的 router。

先在仓库根编译 CLI 和 core：

```bash
pnpm build
```

再在本目录安装本地依赖，然后构建和分析：

```bash
npm install --ignore-scripts --package-lock=false
node ../../packages/cli/bin/mpb.js build
node ../../packages/cli/bin/mpb.js analyze
```

产物在 `dist/`，已被仓库 gitignore 忽略，不要提交。`analyze` 会写出 `dist/mpbuild-analyze.json`。
