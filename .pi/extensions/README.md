# Extensions — 硬约束层

Extensions 将 Agent 的关键行为约束编码为代码执行——Agent 调用工具时，工具强制检查前置条件，
而非依赖 Agent "记住"规则。

设计文档参考：[docs/operations-system-design.md §5.4](../../docs/operations-system-design.md)

## 已规划 Extension

| Extension | 文件 | 职责 | 状态 |
|-----------|------|------|------|
| 合并门禁 | `merge-gate.ts` | 检查运营确认后才执行 merge | 骨架 — 阶段 4 实现 |
| 预览链接 | `preview-url.ts` | push 后自动构造 Cloudflare Pages 预览 URL | 骨架 — 阶段 4 实现 |

## 运行方式

Extensions 通过 Claude Code 的 MCP (Model Context Protocol) 工具机制注册。
Agent 在执行敏感操作（如合并 PR）时，调用对应的 MCP 工具，工具内部执行校验逻辑。

## 设计原则

- **否认优先**：默认拒绝，只有满足条件时才放行
- **零副作用查询**：校验逻辑不修改任何状态
- **清晰错误信息**：拒绝时返回可操作的原因，便于 Agent 自我修正
