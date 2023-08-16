# mpbuild 5.0 分阶段路线图

> 总规格：`docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md`  
> 执行方式：主 Agent 只编排；每阶段一份独立实施计划；子代理 TDD；每完成一小步就提交。  
> 当前开工：P1 → `docs/superpowers/plans/2026-08-19-mpbuild-v5-p1-build.md`

## 阶段

| 阶段 | 计划文件 | 可独立验收 |
|---|---|---|
| P0 图内核 | `2026-08-19-mpbuild-v5-p0-graph-kernel.md` | `mpb inspect graph` 打出节点/边；假 adapter 快照通过 |
| P1 可构建 | `2026-08-19-mpbuild-v5-p1-build.md` | `mpb build` 打出页面四件套；`plugin://` 不失败；命令为 `mpb`；4.x 包删除 |
| P2 增量 | 待 P1 完成后另写 | Watch 状态机 + 增量正确性用例 |
| P3 金样 | 待 P2 完成后另写 | `example/demo` 语义对比 CI |
| P4 发布 | 待 P3 完成后另写 | 迁移文档 + `@mpbuild/*@2.0.0` |

后一阶段计划必须等前一阶段计划全部 Task complete 且全量测试绿后再写，避免空中楼阁。

## 编排规则

1. 工作在当前阶段分支（P1：`feat/v5-p1-build`）的隔离 worktree，不直接改用户当前 checkout 的 master 工作区。
2. 每个 Task：RED → 确认失败 → GREEN → 确认通过 → 提交。
3. 提交信息用约定式中文/英文短句，禁止 `Co-authored-by`、禁止提及 AI / Grok / Claude / Cursor / Generated。
4. Task 完成后由评审子代理看 diff；Critical/Important 必须修完再进下一 Task。
5. 主 Agent 禁止修改 `v5/packages/**` 业务源码。
