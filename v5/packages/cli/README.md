# @mpbuild/cli

`mpb` 命令行。依赖 `@mpbuild/core@5.0.0`。

需要 Node.js `>=20`。

```bash
pnpm add -D @mpbuild/cli
mpb build
mpb build --minify
mpb dev
mpb analyze
mpb inspect graph
```

`mpb dev` 把首次构建和每次 watch tick 的诊断打印到 stderr（与 `mpb build` 相同），打印后保持进程。

配置文件：`mpbuild.config.js` 或 `mpbuild.config.mjs`（生产请用 JS）。`mpb inspect graph` 走 `mpbuild.config.*`。详见仓库 `docs/migration-v5.md`。

开发本包：先 `pnpm --filter @mpbuild/core build`，再 `pnpm --filter @mpbuild/cli build`。不经过 build 的源码调试可用 `pnpm --filter @mpbuild/cli dev`（tsx，仅开发态）。
