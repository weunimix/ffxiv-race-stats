# FFXIV 高难首杀竞速网站

Final Fantasy XIV 世界首杀竞速排行聚合平台。追踪高难副本的首杀争夺战，提供队伍进度、选手直播、赛事速报一站式浏览。

## 本地预览

无构建步骤，无外部依赖。直接打开 HTML 文件或起一个静态服务器：

```bash
python -m http.server 8000
```

访问 `http://localhost:8000`。

## 架构

```
运营人员 ──飞书──→ PI Agent ──→ GitHub ──→ Cloudflare Pages ──→ CDN
开发者   ──→ Git / IDE ──→ GitHub ──→ Cloudflare Pages ──→ CDN
```

运营人员通过 **飞书**（群聊或单聊，自然语言或 @ 机器人）指挥 PI Agent ——`pi-feishu` 扩展提供消息通道，Agent 回复与工具执行进度实时回传飞书。Agent 同时经 `feishu-mcp`（MCP server）具备读写飞书云文档的能力。

双轨模型：开发者和运营人员共享同一个 `main` 分支，通过不同的分支前缀和 PR 流程各司其职。

| | 开发轨 | 运营轨 |
|---|--------|--------|
| **分支前缀** | `feature/*`、`fix/*` | `content/*` |
| **变更对象** | `constants.js`、`schema/`、HTML / CSS / JS / CI | `data.js` 数据值 |
| **操作者** | 开发者 | Agent（代表运营人员） |
| **质量把关** | Code Review | 预览确认 |
| **频率** | 低（周级别） | 高（每天多次） |
| **文件保护** | CI 硬阻断 `feature/*` 修改 `data.js` | CI 硬阻断 `content/*` 修改其他文件 |

## 设计文档

| 文档 | 内容 |
|------|------|
| [运营系统设计](docs/operations-system-design.md) | 双轨分支模型、权限体系、Agent 能力设计、CI 与质量保障 |

## 部署

Cloudflare Pages 连接 GitHub 仓库。push 到 `main` → 自动部署生产。push 到任意分支 → 自动生成预览链接。无需构建命令，仓库根目录作为静态站点直接部署。
