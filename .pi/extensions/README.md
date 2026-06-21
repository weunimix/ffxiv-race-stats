# Extensions — 硬约束层

Extensions 将 Agent 的关键行为约束编码为代码执行——Agent 调用工具时，工具强制检查前置条件，
而非依赖 Agent "记住"规则。

设计文档参考：[docs/operations-system-design.md §5.4](../../docs/operations-system-design.md)

## 已实现

| Extension | 实现方式 | 职责 |
|-----------|---------|------|
| 合并门禁 | `gh pr view --json state,statusCheckRollup` + 运营确认 | CI 通过 + 运营回复"合并"后执行 merge |
| 预览链接 | Cloudflare Pages 自动生成 | push 到任意分支 → `<commit>.ffxiv-race-stats.pages.dev` |
| 文件范围检查 | CI (`validate.yml`) | 双向硬阻断：`feature/*` 不得含 `data.js`；`content/*` 仅允许 `data.js` |
| 数据完整性 | CI (`scripts/validate-data.js`) | 三阶段：schema 结构 → 值域交叉 → 业务规则 |

## 运行方式

Agent 在操作 Git 时：
1. **创建 PR**：`gh pr create --base main` — 触发 CI 校验
2. **检查 CI**：`gh pr view <N> --json state,statusCheckRollup` — 确认 CI 通过
3. **合并 PR**：`gh pr merge <N> --squash --delete-branch` — Squash Merge + 自动删分支

合并门禁通过 Agent 工作流中的「等待运营确认」步骤实现——Agent 必须在收到运营回复"合并"后才执行 merge。

## 设计原则

- **否认优先**：默认拒绝，只有满足条件时才放行
- **零副作用查询**：校验逻辑不修改任何状态
- **清晰错误信息**：拒绝时返回可操作的原因，便于 Agent 自我修正
