# 参与贡献

感谢你愿意为 mpbuild 出一份力。本文件说明开发环境、测试与提交约定。

## 环境

- Node.js `>=20`（仓库测试在 Node 22 下跑；用 `fnm` / `nvm` 切换）
- pnpm `9`

```bash
git clone https://github.com/ximing/mpbuild.git
cd mpbuild/v5
pnpm install
```

## 目录

- `v5/packages/core` — 图驱动编译核心（`@mpbuild/core`）
- `v5/packages/cli` — 命令行 `mpb`（`@mpbuild/cli`）
- `example/demo` — 金样工程，CI 做语义对比
- `docs/migration-v5.md` — 4.x → 5.x 迁移指南

## 构建与测试

```bash
cd v5
pnpm build                                  # 编译 core + cli
pnpm --filter @mpbuild/core test -- --run   # 跑 core 全量测试
```

改动了 CLI 的 spawn 类测试时，它们会在用例内部自己 `pnpm build`。

## 提交约定

- 约定式提交（`feat:` / `fix:` / `docs:` / `chore:` / `test:` ...），commitlint 会校验。
- 不加 `Co-authored-by` 尾注，不在提交信息里提及 AI 工具。
- 代码注释用中文，标识符用英文。

## 提 Pull Request

1. 从 `master` 切一个分支，小步提交。
2. 新行为先写失败测试再实现（仓库遵循 TDD）。
3. 用户可见的行为变更，同步更新 `README.md` 与 `docs/migration-v5.md`。
4. 提交前确认 `pnpm --filter @mpbuild/core test -- --run` 全绿。

## 报告 Bug

用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md) 提 issue，尽量附上最小复现仓库与 `mpbuild.config.*` 片段。
