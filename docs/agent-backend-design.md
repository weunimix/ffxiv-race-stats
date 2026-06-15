# Agent 后端中控设计方案

## 概述

使用 PI Agent 框架作为后端中控，运营人员通过自然语言与 Agent 沟通，Agent 按照模板润色内容并提交到 GitHub，触发前端静态站点自动部署。

## 架构图

```
运营人员 ──→ Agent (PI 框架) ──→ GitHub (data.js) ──→ Cloudflare Pages ──→ 全球 CDN
                │                    │
                ├── Skills (模板)     ├── CI 校验 (schema/逻辑)
                ├── Rules (质量约束)   └── 分支预览 (人工确认)
                └── Agent Chain (流程编排)
```

## 双轨分支模型

项目存在两条独立的变更轨道：**开发轨**和**运营轨**。两条轨道的操作者、变更对象、频率和质量把关方式不同，但最终都通过 PR 合入 `main`。

### 两方需求

| | 开发侧 | 运营侧 |
|---|---|---|
| **谁操作** | 开发者 | Agent + 运营人员 |
| **改什么** | HTML / CSS / JS / Schema | data.js（内容数据） |
| **变更频率** | 低（按功能迭代） | 高（每天多次更新） |
| **质量把关** | Code review（另一个开发者） | 视觉确认（运营在浏览器看一眼） |
| **回滚敏感度** | 中（有 bug 修就是了） | 高（数据错误直接影响所有用户） |
| **冲突风险** | — | 开发改了 schema，Agent 还在用旧结构写数据 |

### 双轨流程图

```
开发轨                              运营轨
───────                             ───────

feature/xxx ◄── Developer          content/update-t1-p5 ◄── Agent
    │                                    │
    │ git push                           │ git push
    │                                    │
    ▼                                    ▼
Cloudflare Pages                      Cloudflare Pages
  feature preview                       content preview
  (开发者自测)                          (运营视觉确认)
    │                                    │
    │ 通过                              │ 通过
    ▼                                    │
PR → Code Review ───────────┐         PR ──→ CI 校验 ───┐
                             │         (运营点确认)       │
                             ▼                            ▼
                          main ──────────┬───────────────
                                         │
                                    Cloudflare Pages
                                      Production
```

### 核心规则

| 规则 | 说明 |
|------|------|
| **开发不用 main 测** | feature 分支 push 后 Cloudflare Pages 自动生成预览，开发者先在预览里确认 |
| **运营不能直接写 main** | Agent 只能推到 `content/*` 分支，永远不碰 `main` |
| **PR 是唯一合入途径** | 无论开发还是运营，最终都要走 PR 合入 `main` |
| **合并人不同** | 开发 PR 由另一个开发者合并；运营 PR 由运营人员自己在预览确认后点合并 |
| **CI 是裁决者** | 两边 PR 都跑 CI——开发侧保证构建不挂，运营侧保证数据结构合法 |

### 分支命名规范

```
feature/<功能名>        例: feature/add-guide-page
fix/<问题描述>          例: fix/mobile-overflow-table
content/<类型>-<描述>   例: content/update-t1-progress
                       例: content/add-news-item
                       例: content/roster-refresh
```

### 冲突处理

当开发改了 schema（比如新增字段），而 Agent 同时推了旧格式的数据：

```
1. CI 检测到 data.js 不合法 → PR 被拦截
2. Agent 读取 CI 日志 → 发现 schema 变更
3. Agent 重新生成符合新 schema 的数据 → 重新 push 到 content/* 分支
4. CI 通过 → 运营确认 → 合并
```

## 三层部署环境

| 环境 | 触发方式 | URL | 用途 |
|------|---------|-----|------|
| **Preview** | push 到 `feature/*` / `content/*` 分支 | `xxx.preview.pages.dev` | 开发/运营各自确认变更 |
| **Staging** | PR 合并到 `staging` | `staging.pages.dev` | 多轮更新汇总后整体预演（可选） |
| **Production** | PR 合并到 `main` | `ffxiv-race-stats.pages.dev` | 对外服务 |

## Agent 提交流程

```
运营说 "更新队伍1进度到 P5，HP 12%"
         │
         ▼
    Agent 理解意图
         │
         ▼
    Agent 读取 data.js 当前内容
         │
         ▼
    Agent 生成修改 + 自检（schema/风格/逻辑）
         │
         ▼
    Agent push 到 content/update-t1-p5 分支
         │
         ▼
    Cloudflare Pages 生成预览链接
         │
         ▼
    Agent 将预览链接发给运营确认
         │
    ┌────┴────┐
    ▼         ▼
  通过      驳回 → Agent 修正 → 重新 push
    │
    ▼
  Agent 创建 PR → 合并到 main → 生产自动部署
```

## 为什么用 Agent

| 问题 | Agent 如何解决 |
|------|---------------|
| 多人运营风格不统一 | Agent 按模板润色，强制输出一致 |
| 数据格式错误（如 phase 拼错、region 不合法） | Agent 按 schema 做结构校验再提交 |
| 运营门槛高（需要会写 JS 对象） | 自然语言输入 → Agent 转结构化数据 |
| 内容质量无把关 | Agent 可做信息完整性检查 |
| 维护困难 | Agent 可对流程进行自检，具有自我优化能力 |

## PI 框架能力对应

| 需求 | PI 对应能力 |
|------|------------|
| 按模板润色、统一风格 | **Skills** — 每种内容类型写一个 skill（`update-team`、`add-news`、`add-broadcaster`） |
| 信息校验、质量把关 | **Rules** — 强制加载，校验字段合法性、链接可达性、中文风格一致性 |
| 流程自检、自我优化 | **Agent Chain** — 编排"输入→校验→格式化→审查→提交"流水线，CI 失败自动修正 |
| 非技术人员使用 | 自然语言输入，Agent 转结构化数据，运营不需要碰 `data.js` |

## CI 校验层

`.github/workflows/validate.yml` 对每个 PR 做机械化校验，即使 Agent 自检通过也再做一次：

```
校验内容：
- JSON/JS 语法合法
- RACE_DATA 结构完整（meta/teams/news/broadcasters）
- 队伍 rank 无重复、无越界
- phase 值在 PHASE_ORDER 白名单内
- region 在 ['JP','NA','EU','OC','CN','KR'] 内
- bossHP 在 0–100 区间
- stream URL 不是 "#" 占位符（提醒，不阻断）
```

CI 不通过 → 无法合并，即使 Agent 想合也不行。

## Agent 自我修正闭环

当 CI 挂了或者运营驳回：
- Agent 读取 CI 错误日志
- Agent 修正 `data.js`
- Agent 重新 push 到同一 `content/*` 分支
- 预览链接自动更新

## 安全机制

- **预览隔离**：Agent 永远不直接 push 到 `main`，所有改动先走 `content/*` 分支
- **人工最终确认**：运营在浏览器预览链接中确认无误后，Agent 才创建 PR 合并
- **Git 回滚**：出问题直接 `git revert` + push，Cloudflare Pages 自动回滚，30 秒内完成
- **CI 双重校验**：即使 Agent 自检通过，CI 也再做一轮机械校验

## 建议的目录结构

```
FFXIVRanking/
  schema/                    # 数据契约层（Agent + CI 共同遵守）
    team.schema.json
    news.schema.json
    broadcaster.schema.json
    meta.schema.json
  pi/
    skills/                  # PI Skills — 内容模板
      update-team.md
      add-news.md
      add-broadcaster.md
    rules/                   # PI Rules — 质量约束
      content-style.md       # 中文风格、术语规范
      data-integrity.md      # 字段完整性、HP/phase 合法性
    chains/                  # PI Agent Chains — 流程编排
      publish-content.yaml
    templates/               # 文本模板（News 格式、Team 介绍等）
      team-profile.md
      news-item.md
  .github/
    workflows/
      validate-data.yml      # CI：提交前 schema 校验
```

## 实现优先级

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **第一阶段**（当前） | 静态前端页面部署 | 无 |
| **第二阶段** | Agent PI Skills/Rules/Chains | 第一阶段完成 |
| **第三阶段** | Agent 接入运营工作流 | 第二阶段完成 |
