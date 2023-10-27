# @mpbuild/core

微信小程序图驱动编译器核心。配合 [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli) 使用，命令是 `mpb`。

需要 Node.js `>=20`。

```js
import { copy, createCompiler, defineConfig, loadConfig, legacyScss, projectConfig } from '@mpbuild/core'

const config = await loadConfig(process.cwd())
await createCompiler(config).run()
```

`resolve.extensions` 按 kind 覆盖该 kind 的 `adapter.sourceExts`。

从 4.x 迁移见仓库根目录 `docs/migration-v5.md`。
