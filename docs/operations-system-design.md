# 竞速网站运营系统设计文档

## 1. 概述

### 1.1 项目背景与设计目标

FFXIV 高难首杀竞速网站的内容运营依赖高频数据更新——队伍进度、赛事新闻、转播方信息每日变化多次。运营人员不编写代码，开发人员不触碰运营数据。系统需要让两类角色各司其职，通过结构化的流程保证数据质量，同时避免任何一方误操作影响另一方。

**设计目标：**

- 运营人员通过自然语言即可更新竞速数据，零代码门槛
- 所有数据变更在预览环境确认后才上线，杜绝错误推送到生产
- 运营者的操作范围被平台硬约束限制，无法触碰页面代码
- 开发者的变更不影响运营侧的数据更新节奏

### 1.2 架构总览

```
运营人员 ──→ PI Agent ──→ GitHub ──→ Cloudflare Pages ──→ CDN
                │              │
                ├── Skills     ├── CI 校验
                ├── Rules      ├── CODEOWNERS
                └── Extensions └── Branch Protection
```

两条独立的变更轨道：

```
开发轨                                   运营轨
───────                                  ───────

开发者                                   运营人员
   │                                       │
   │  改: HTML / CSS / JS / Schema         │  说: "队伍1 打到P5了 HP12%"
   │  不改: data.js 数据值                  │  不改: 页面代码
   │                                       │
   ▼                                       ▼
feature/* 分支                          Prompt Template（入口）
   │                                       │
   │  push                                 ▼
   ▼                                    Skill（执行工作流）
Cloudflare Pages 预览                       │
   │                                       ▼
   ▼                                    Rules（内容校验）
PR                                        │
   │                                     ▼
   ├── CI 通过                          Extension（合并门禁）
   ├── Code Review                        │
   └── 开发者 Approve → merge             ▼
                                    content/* 分支
                                         │
                                         │  push
                                         ▼
                                    Cloudflare Pages 预览
                                         │
                                         │  运营在浏览器确认
                                         ▼
                                    PR
                                       │
                                       ├── CI 通过
                                       ├── 运营确认
                                       └── Agent merge
```

### 1.3 两类角色定义

| | 开发者 | 运营者 |
|---|--------|--------|
| **身份** | 开发者 GitHub 账号 | 运营人员本人（不需要 GitHub 账号） |
| **操作方式** | IDE / CLI | 自然语言，通过 Agent 中转 |
| **管辖范围** | HTML / CSS / JS / Schema / CI 配置 | `data.js` 中的数据值 |
| **变更频率** | 低（周级别） | 高（每天多次） |
| **质量把关** | Code Review | 浏览器预览确认 |
| **合入权限** | feature PR 由另一开发者 Approve 后合并 | content PR 由运营者确认后，Agent 执行合并 |

---

## 2. 前端内容定义

在进入流程设计之前，先明确页面上每一类内容的维护归属。判定原则：

> **原子数据由运营维护。计算逻辑由开发维护。产品框架由开发维护。**

- 运营每改一个值，页面渲染自动反映，不需要开发介入
- 开发写计算逻辑（如计时器、统计聚合），但不决定数据值
- 随赛事变化且硬编码在 HTML 中的内容，应迁入运营维护范围

### 2.1 启动页（index.html）内容分解

**状态栏**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 赛事名称 | 运营 | `meta.eventName` |
| 数据中心 | 运营 | `meta.dataCenter` |
| 副本名称 | 运营 | `meta.dungeon` |
| 「第 N 日」 | 开发 | 从 `meta.startTime` 计算，不是独立数据 |
| 开赛计时 | 开发 | 从 `meta.startTime` 实时计算 |
| 赛事状态（LIVE / UPCOMING / ENDED） | 运营 | `meta.status` |

**Hero 区**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 赛事标题 | 运营 | `meta.eventName` |
| 报名按钮 | 开发 | 按钮样式和行为；链接地址通过 `meta.registrationUrl` 由运营配置 |
| 赛事公告 | **运营** | 赛事规则变更、重要时间节点等，每届不同 |
| 合作转播台 | 运营 | `broadcasters[]` |

**排名模块**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 表头列定义（排名 / 队伍 / 职业配置 / HP / 阶段） | 开发 | 列结构固定 |
| 队伍行数据（排名、队名、区域、phase、bossHP） | 运营 | 原子数据 |
| 8 人职业配置（job / role / stream / streaming） | 运营 | 原子数据 |
| 职业徽标颜色 | 开发 | Tank / Healer / DPS 色值是设计决策 |
| 展开 / 收起交互 | 开发 | 交互逻辑 |

**侧栏**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 开赛计时 | 开发 | 同状态栏计时器 |
| 赞助公示 | **运营** | 赞助商每届不同 |
| 直播覆盖统计 | 开发 | 从 `players[].streaming` 聚合计算 |

**速报时间线**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 每条新闻 | 运营 | 原子数据 |

**页脚 / 未开放模块**

| 展示内容 | 维护方 | 说明 |
|---------|--------|------|
| 版权、导航链接 | 开发 | 产品框架 |
| 副本攻略模块 | 开发 | 功能模块框架，上线后攻略内容归运营 |

### 2.2 数据层结构设计

基于以上内容分解，`data.js` 需要承载以下数据结构：

```
RACE_DATA
├── meta
│   ├── eventName          # 赛事名称
│   ├── edition            # 期数标识
│   ├── dungeon            # 副本名称
│   ├── boss               # Boss 名称
│   ├── dataCenter         # 数据中心
│   ├── startTime          # 开赛时间 (ISO 8601)
│   ├── status             # "upcoming" | "live" | "ended"
│   └── registrationUrl    # 报名链接
│
├── teams[]
│   ├── id                 # 唯一标识
│   ├── name               # 队伍名
│   ├── rank               # 排名 (≥1, 连续无跳号)
│   ├── bossHP             # Boss 剩余血量 (0–100)
│   ├── phase              # 当前阶段
│   ├── region             # 服务器区域
│   ├── isLive             # 队伍是否在线
│   └── players[]          # 恰好 8 人
│       ├── job             # 职业三字母缩写
│       ├── role            # "tank" | "healer" | "dps"
│       ├── stream          # 直播链接
│       └── streaming       # 是否正在直播
│
├── news[]
│   ├── id                 # 唯一标识
│   ├── time               # "YYYY-MM-DD HH:mm"
│   ├── text               # 速报正文 (≤50 字)
│   └── urgent             # 是否紧急
│
├── broadcasters[]
│   ├── id                 # 唯一标识
│   ├── name               # 转播方名称
│   ├── platform            # "bilibili" | "douyu" | "huya" | "twitch" | "youtube"
│   ├── url                # 直播间链接
│   └── note               # 备注（如"官方合作转播"）
│
├── notices[]              # 赛事公告
│   ├── text               # 公告正文
│   ├── urgent             # 是否紧急
│   └── sortOrder          # 排序权重
│
└── sponsors[]             # 赞助公示
    ├── name               # 赞助商名称
    ├── description        # 赞助说明
    └── url                # 赞助商链接 (可选)

// 辅助常量（位于 constants.js，开发者维护）
PHASE_ORDER                # 阶段顺序数组，如 ["P1","P2","P3","P4","CLEAR"]
ROLE_COLORS                # 角色颜色映射 { tank, healer, dps }
```

`PHASE_ORDER` 由开发者在 `constants.js` 中维护——每个新副本的阶段序列在赛事开始前由开发者设定。`PHASE_ORDER` 同时作为 phase 校验的白名单来源。

### 2.3 文件职责划分

```
constants.js               # 结构常量 + 校验白名单（开发者维护）
schema/                    # JSON Schema 数据契约（开发者维护）
data.js                    # RACE_DATA 纯数据值（运营侧维护）
```

开发者变更数据结构时，改 `constants.js` 和 `schema/`；运营变更数据值时，只改 `data.js`。CI 在 PR 阶段硬阻断任何越界操作。

### 2.3 维护边界总结

```
运营维护（data.js 内容值）
├── meta        — 赛事元信息 + 报名链接 + 赛事状态
├── teams[]     — 队伍进度 + 8 人配置 + 直播状态
├── news[]      — 速报条目
├── broadcasters[] — 转播方
├── notices[]   — 赛事公告
├── sponsors[]  — 赞助公示
└── PHASE_ORDER — 阶段定义

开发维护（页面代码）
├── HTML 结构 — 布局、导航、模块框架
├── CSS 样式 — 颜色 token、响应式、动画
├── JS 逻辑 — 计时器、HP 条动效、展开/收起、统计数据聚合
├── Schema   — 数据结构定义（与 CI 共享）
└── CI       — 校验规则
```

---

## 3. 双轨分支模型

### 3.1 轨道定义与数据流

项目只有 **一个长期分支：`main`**。所有变更通过短生命周期分支 + PR 合入 `main`（GitHub Flow）。

| 轨道 | 分支前缀 | 变更对象 | 操作者 |
|------|---------|---------|--------|
| 开发轨 | `feature/*`、`fix/*` | 页面代码、schema、CI 配置 | 开发者 |
| 运营轨 | `content/*` | `data.js` 数据值 | Agent（代表运营者） |

两条轨的变更对象交集极小——开发几乎不碰 `data.js` 的数据值，Agent 完全不碰页面代码。交集的唯一场景是 schema 变更（见 3.4）。

### 3.2 分支命名规范

```
开发轨
  feature/<动词>-<描述>   例: feature/add-guide-page
  fix/<描述>              例: fix/mobile-overflow-table

运营轨
  content/<操作>-<目标>   例: content/update-t1-p5
                            content/add-news-nl-clear
                            content/update-br-laochen
```

Agent 命名 `content/*` 分支时仅使用 ASCII 字符——避免 CI 工具和 URL 编码的兼容性问题。

**`content/*` 分支名长度限制（≤ 20 字符）：** Cloudflare Pages 的分支别名 URL（`<sanitized-branch>.ffxiv-race-stats.pages.dev`）截断到 28 字符。`content-` 前缀占 8 字符，因此 `content/` 后面的部分不得超过 20 字符，否则别名被截断、Agent 无法根据分支名推算预览 URL。

### 3.3 合并策略

两条轨统一使用 **Squash Merge**：

| 轨道 | 合并方式 | 理由 |
|------|---------|------|
| `content/*` → main | Squash merge | Agent 可能在同一分支上多次 push（修正后重推），squash 让 main 保持干净——一个内容操作 = main 上一个 commit |
| `feature/*` → main | Squash merge | 开发者可能在分支上有多次 WIP commit，squash 后 main 上只留一个清晰的 feat/fix commit |

main 的 commit log 天然就是 changelog。

### 3.4 Schema 变更策略

当开发需要修改数据结构（新增字段、修改类型），**只改 `schema/` 和 `constants.js`，不改 `data.js`**。必须遵守**向后兼容原则**，分三步走：

```
Step 1: 修改 schema/*.json → 新字段标记为非 required
        修改 constants.js → 更新白名单（如需新值域）
        发布 feature PR → 合并 main
Step 2: UI 代码同时支持有该字段和无该字段两种情况
Step 3: 在后续 PR 中将 schema 字段改为 required
        Agent 在此期间的 content/* PR 自然已携带该字段
```

CI 硬阻断保证 `feature/*` 分支无法触碰 `data.js`，因此 schema 变更和运营数据更新天然隔离。

如果 schema 变更无法向后兼容（极端情况），执行**运营轨冻结**：

```
1. 通知运营者暂停数据更新
2. 开发者合并 schema change → main（改 schema/ + constants.js）
3. Agent 立刻通过 content/* PR 更新 data.js 适配新结构
4. 恢复运营轨
```

冻结窗口 = 一次 Agent 更新的时间（分钟级）。

### 3.5 紧急回滚

当生产站出现错误数据、需要立刻恢复时，由**持有仓库 Admin 权限的开发者**执行紧急回滚。此操作绕开 PR 和 CODEOWNERS 审批，仅用于回退上一个 content merge commit：

```
开发者: git revert <content merge commit> → git push origin main
```

这是本项目中**唯一允许直推 main 的场景**。约束条件：

- 仅限 revert 操作（不可用于新增代码）
- 仅回滚最近一个 content merge commit
- 执行后需在团队频道通知运营侧 Agent 知晓（避免 Agent 基于已回滚的状态继续操作）

revert 本身可逆——如果事后发现回滚有误，可以再次 revert 恢复。

> **为什么不是 Agent 执行？** Agent 的 service account 被 Ruleset 禁止直推 main——这是硬约束。
> 解禁意味着 Agent 在任何时刻都能推 main，风险远大于偶尔需要开发协助回滚的不便。
> 紧急回滚是极低频操作（通常只在数据严重出错时发生），保留给有权限的开发者是合理的安全边界。

### 3.6 赛事初始化

每届新赛事开始时，需要两步操作，**必须按顺序合入**：

**Step 1 — 开发者更新结构常量**：如果新副本的阶段数或值域与上届不同，开发者创建 `feature/init-season-<edition>` 分支，修改 `constants.js`（`PHASE_ORDER` 等）和 `schema/`（如需新增字段）。此 PR 不触碰 `data.js`。

**Step 2 — Agent 初始化数据**：开发者 PR 合入 main 后，运营通过 Agent 创建 `content/init-season-<edition>` 分支，执行全量数据初始化：

| 数据域 | 操作 | 说明 |
|--------|------|------|
| `meta` | 全量刷新 | 新 eventName、dungeon、boss、dataCenter、startTime、status: "upcoming" |
| `teams[]` | 清空重建 | 替换为新参赛队伍及其初始数据（rank 从 1 起，bossHP 100%，phase P1） |
| `news[]` | 清空 | 上届新闻归档 |
| `broadcasters[]` | 酌情保留或清空 | 若转播方延用上届阵容则保留调整，否则清空重建 |
| `notices[]` | 清空 | 上届公告归档 |
| `sponsors[]` | 酌情保留或清空 | 赞助商合同可能跨届 |

**合并顺序是关键**：必须先合 dev PR（`constants.js` 就位），再合 content PR（Agent 按新结构写数据）。否则新 phase 值无法通过校验。两个 PR 均由 CI 双向硬阻断保护——dev PR 改不了 data.js，content PR 改不了 constants.js。

> 赛季初始化由 Agent 通过标准 `content/*` PR 流程执行。运营人员只需向 Agent 提供新赛事信息，Agent 负责生成完整 data.js 并通过 CI 校验。

---

## 4. 权限体系

权限分层设计，从刚性到弹性逐层收束：

```
┌──────────────────────────────────────────────────┐
│ Layer 1: 分支级硬约束                                 │
│ GitHub Branch Rulesets                            │
│ 开发者绕不过，Agent 绕不过                              │
├──────────────────────────────────────────────────┤
│ Layer 2: 文件级硬约束                                  │
│ CODEOWNERS                                        │
│ 即使推到分支上，PR 也合不进去                             │
├──────────────────────────────────────────────────┤
│ Layer 3: Agent 软约束（最后一道）                       │
│ Skill 内置的操作边界                                  │
│ 在它犯错时被前两层拦下                                  │
└──────────────────────────────────────────────────┘
```

### 4.1 分支级保护（Rulesets）

**main 分支：**

| 规则 | 值 |
|------|----|
| 禁止直推 | 对所有人 |
| 要求 PR | 强制 |
| CI 通过 | 强制 |
| 合并前 rebase main | 强制 |
| 禁止 force push | 强制 |
| 禁止删除分支 | 强制 |

**feature/\*\* 规则集：**

| 规则 | 值 |
|------|----|
| 允许推送 | `@ffxiv/dev-team` 仅 |
| 禁止 force push | 强制 |

**content/\*\* 规则集：**

| 规则 | 值 |
|------|----|
| 允许推送 | Agent 的 service account 仅 |
| 禁止 force push | 强制 |

### 4.2 文件级保护（CODEOWNERS）

```codeowners
# 开发侧代码 — 开发者拥有
*.html           @ffxiv/dev-team
*.css            @ffxiv/dev-team
*.js             @ffxiv/dev-team    # data.js 除外，见下方
.github/**       @ffxiv/dev-team
schema/**        @ffxiv/dev-team
.pi/**           @ffxiv/dev-team
CLAUDE.md        @ffxiv/dev-team
README.md        @ffxiv/dev-team

# 数据层 — 运营侧拥有
data.js          @ffxiv/ops-agent
```

CODEOWNERS 在此项目中的角色是**跨轨变更的拦截器**，而非常规的审批机制：

- 当 `content/*` PR 的 diff 包含 `data.js` **之外**的文件时，CODEOWNERS 自动要求 `@ffxiv/dev-team` review——运营侧无法自行合入，PR 被阻塞
- 当 `feature/*` PR 修改了 `data.js` 的**数据值**（非结构变更）时，CODEOWNERS 自动要求 `@ffxiv/ops-agent` review——开发者无意中改数据时被拦截
- codeowner 本身不负责审批内容正确性——开发侧的 Code Review 由另一个开发者完成，运营侧的正确性由浏览器预览确认完成

这一层和 CI 校验（第 6 章）的分工：CODEOWNERS 管的是**文件所有权**（谁的文件被改了必须拉谁来看），CI 管的是**数据合法性和文件范围**（数据对不对、有没有越界改文件）。

### 4.3 完整权限矩阵

| 操作 | 开发者 | Agent (运营侧) | 约束类型 |
|------|--------|---------------|---------|
| Clone 仓库 | ✅ | ✅ | — |
| 创建 `feature/*` | ✅ | ❌ | Agent 自约束 |
| 创建 `content/*` | ❌ | ✅ | Agent 自约束 |
| Push to `feature/*` | ✅ | ❌ | Ruleset（硬） |
| Push to `content/*` | ❌ | ✅ | Ruleset（硬） |
| Push to `main` | ❌ | ❌ | Ruleset（硬），紧急回滚除外 |
| 编辑 HTML / CSS / JS / schema / constants.js | ✅ | ❌ | CODEOWNERS + CI |
| 编辑 `data.js` 值 | ❌ | ✅ | CODEOWNERS + CI |
| 编辑数据结构（schema/ + constants.js） | ✅ | ❌ | CODEOWNERS |
| PR 合入 main | ✅ (review 后) | ✅ (确认后) | CODEOWNERS + CI |
| Force push 任何分支 | ❌ | ❌ | Ruleset（硬） |
| 删除远程分支 | ✅ (仅 feature) | ❌ | Ruleset（硬） |
| 紧急回滚（revert push main） | ✅ (Admin 仅) | ❌ | 人为判断 + 团队通知 |

### 4.4 账号策略

**运营人员不需要 GitHub 账号。** Agent 使用独立的 service account（或 GitHub App token）操作 Git，权限范围通过 Ruleset 精确裁剪到：

- 读取仓库
- 在 `content/*` 下创建并推送分支
- 创建 PR（`content/*` → `main`）
- 收到运营确认后执行 merge（通过 Extension 合并门禁控制）

运营人员与 Git 平台隔离的好处：
- 运营无需学习 GitHub 操作，沟通全程在自然语言中完成
- 权限控制精确到 service account，不依赖运营人员的个人账号安全
- 更换运营人员时，无需管理 GitHub 账号权限变更

---

## 5. Agent 能力设计

### 5.1 运营交互全链路

运营人员的一条自然语言指令，在 Agent 系统中经过以下链路：

```
运营说话
    │
    ▼
Prompt Template ── 触发入口
    │  • 意图识别 —— 匹配到对应 Skill
    │
    ▼
Skill ── 执行工作流
    │  • 读取当前状态
    │  • 回显意图，向运营确认
    │  • 校验（Rules 层介入）
    │  • 编辑 data.js
    │  • 提交到 content/* 分支
    │
    ▼
Extension ── 硬约束
    │  • 预览链接自动构造
    │  • 合并门禁 —— 未收到运营确认则拒绝 merge
    │
    ▼
Rules ── 贯穿全程的质量约束
       • 写入前：结构完整性、逻辑一致性、边界值
       • 写入后：重新读取确认、语法检查
```

### 5.2 Prompt Templates（入口）

运营人员通过 `/指令` 或自然语言触发操作。Prompt Template 负责意图识别——将运营的自然语言匹配到正确的 Skill。每个 Prompt Template 对应一个 Skill，携带该 Skill 的触发规则和上下文提示。

> 模型路由（按操作复杂度选择不同模型）是上线后的成本优化手段。起步阶段统一使用 Sonnet 以降低 Agent 行为的不确定性。路由策略见附录 B。

### 5.3 Skills（执行工作流）

每种内容操作类型对应一个 Skill，携带完整的操作 SOP。Skill 内部的结构：

1. **读取当前状态** — 从 `data.js` 获取目标数据的当前值
2. **回显确认** — 将理解的意图回显给运营确认
3. **校验** — 触发 Rules 层检查
4. **写入** — 编辑 `data.js`
5. **提交** — push 到 `content/*` 分支
6. **等待确认** — 输出预览链接，等待运营回复
7. **合并** — 收到确认后 merge 到 main

项目所需的五个 Skill：

| Skill | 触发词 | 职责 |
|-------|--------|------|
| `update-team` | 更新队伍、修改进度、P几、血量、通关 | 修改队伍的 phase / bossHP / isLive / rank / players[] |
| `update-meta` | 赛事名称、时间、状态、开赛、结束 | 修改 meta 字段（eventName / status / startTime 等） |
| `add-news` | 速报、新闻、快讯、播报 | 在 news[] 头部插入新条目 |
| `update-broadcaster` | 转播方、直播间、添加转播、删除转播 | 增删改 broadcasters[] 中的条目 |
| `update-content` | 公告、赞助、更新公告、添加赞助 | 增删改 notices[] 和 sponsors[] |

数据层 6 个顶层域与 Skill 的覆盖关系：

| 数据域 | 对应 Skill | 说明 |
|--------|-----------|------|
| `meta` | `update-meta` | 赛事元信息，开赛/结束时切换状态 |
| `teams[]` | `update-team` | 队伍进度与配置 |
| `news[]` | `add-news` | 速报条目 |
| `broadcasters[]` | `update-broadcaster` | 转播方 |
| `notices[]` | `update-content` | 赛事公告 |
| `sponsors[]` | `update-content` | 赞助公示 |

`notices[]` 和 `sponsors[]` 合并为一个 Skill 而非各自独立——两者的操作模式一致（列表增删改，低频率），分开会导致 Skill 数量膨胀但无实际收益。

### 5.4 Extensions（硬约束层）

Skills 通过文本描述行为约束（"不收到确认不要合并"），但这种约束依赖 Agent 的记忆和执行质量。Extensions 将关键约束编码为**代码执行**——Agent 调用工具时，工具强制检查前置条件。

**合并门禁**

注册 `merge-content-branch` 工具，逻辑为：

- 检查当前 session 是否收到了运营者的合并确认
- 未确认 → 拒绝执行，返回 "Content PR 需要运营者在预览中确认后才能合并。请等待运营回复'合并'。"
- 已确认 → 执行 merge

效果：不是 Agent "应该记住"，而是 Agent 调工具时**工具强制拒绝**。

**预览链接自动构造**

注册 `get-preview-url` 工具，push 后自动根据当前分支名拼接 Cloudflare Pages 预览链接。URL 格式为分支别名：

```
https://<sanitized-branch>.ffxiv-race-stats.pages.dev
```

分支名净化规则：`/` → `-`，非字母数字字符 → `-`，全小写。

**关键限制：** Cloudflare Pages 分支别名截断到 **28 字符**。`content-` 前缀占 8 字符，因此 `content/` 后面的部分不得超过 20 字符。Agent 在创建分支时必须遵守此限制才能确保预览 URL 可推算。

示例：
- `content/update-t1-p5` → `content-update-t1-p5.ffxiv-race-stats.pages.dev`（18 字符，✅）
- `content/reorder-ranks` → `content-reorder-ranks.ffxiv-race-stats.pages.dev`（21 字符，✅）
- `content/reorder-ranks-clear-first` → `content-reorder-ranks-clear-first`（35 字符，❌ 截断）

### 5.5 Rules（内容质量约束）

Rules 在每次 `data.js` 写入操作前后自动生效。

**内容风格约束：**

- 所有面向用户的文本使用简体中文
- 术语一致性：阶段使用 `P1–P6, FINAL`，区域使用 `JP/NA/EU/OC/CN/KR`，职业使用官方三字母缩写
- 新闻正文 ≤ 50 字，时间格式 `YYYY-MM-DD HH:mm`
- 禁止编造运营未提供的真实数据

**数据完整性约束：**

写入前检查：

- `RACE_DATA` 包含全部六个顶层 key：`meta`、`teams`、`news`、`broadcasters`、`notices`、`sponsors`
- `meta.status` ∈ `{ "upcoming", "live", "ended" }`
- 每支队伍的 `players[]` 恰好 8 人
- `rank` 从 1 连续无重复无跳号
- `bossHP` ∈ [0, 100]，只能减少（进度不倒退）
- `phase` 只能前进不后退（按 `PHASE_ORDER` 顺序）
- `phase` 值在 `PHASE_ORDER` 白名单内
- `region` ∈ `{JP, NA, EU, OC, CN, KR}`
- `streaming` 和 `isLive` 为 boolean

写入后检查：

- 重新读取 `data.js`，确认写入内容与意图一致
- 语法可解析性检查
- 任一检查不通过 → 修复后重检 → 通过后才 push

---

## 6. CI 与质量保障

### 6.1 校验规则

CI（GitHub Actions）在每次 PR 时运行，作为独立于 Agent 的第二道机器防线。校验分为三个阶段：

**阶段 1 — Schema 结构校验（Ajv）：**

加载 `schema/` 目录中的 JSON Schema 文件，对 `RACE_DATA` 做结构校验（类型、必填、嵌套、数组长度）。这是数据契约的机器执行。

**阶段 2 — 值域交叉校验：**

从 `constants.js` 取白名单，交叉校验 phase ∈ PHASE_ORDER、region ∈ VALID_REGIONS、role ∈ VALID_ROLES、status ∈ VALID_STATUSES。

**阶段 3 — 业务规则：**

| 类别 | 规则 |
|------|------|
| **排名** | `rank` 无重复、无跳号、无越界 |
| **血量** | `bossHP` ∈ [0, 100] |
| **队伍人数** | 每队 `players[]` 恰好 8 人 |
| **直播** | `stream` URL 不为 `"#"` 占位符（提醒，不阻断） |
| **队伍名** | 不为 `[队伍名 X]` 占位符（提醒，不阻断） |

**文件范围检查（双向硬阻断）：**

| PR 分支 | 检查 |
|---------|------|
| `feature/*` / `fix/*` | diff 不得含 `data.js`（违规 → FAIL） |
| `content/*` | diff 必须仅含 `data.js`（违规 → FAIL） |

这一步确保两类角色在物理层面无法越界操作。与 CODEOWNERS 的分工：CI 是第一道自动门禁（直接 FAIL，不给合入机会），CODEOWNERS 是第二道审批兜底。

### 6.2 Agent 自我修正闭环

```
CI 检查
  ├── 通过 → PR 可合并
  └── 不通过
        │
        ▼
      Agent 读取 CI 错误日志
        │
        ▼
      Agent 诊断问题（语法错误？值越界？文件范围违规？）
        │
        ▼
      Agent 修正 data.js
        │
        ▼
      Agent commit --amend → push 同一 content/* 分支
        │  注：此为常规 push，非 force push。content/* 分支允许 Agent 的
        │      service account 推送，但禁止 force push（由 Ruleset 保证）
        │
        ▼
      预览链接自动更新 → CI 重跑
```

---

## 7. 部署

### 7.1 环境定义

| 环境 | 触发方式 | URL | 用途 |
|------|---------|-----|------|
| **Preview** | push 到 `feature/*` / `content/*` 分支 | `<sanitized-branch>.ffxiv-race-stats.pages.dev` | 开发自测 / 运营视觉确认 |
| **Production** | PR 合并到 `main` | `ffxiv-race-stats.pages.dev` | 对外服务 |

两层环境满足当前需求。Staging 环境（PR 合入 main 前汇总多轮变更的整体预演）在变更频率和并发度上升后再建设。

### 7.2 触发机制

Cloudflare Pages 连接 GitHub 仓库：
- push 到 `main` → 自动部署生产
- push 到任意分支 → 自动生成预览链接

无需构建命令——仓库根目录作为静态站点直接部署。

### 7.3 回滚机制

**常规回滚**（数据错误，非紧急）：

1. 开发者 `git revert` 出问题的 merge commit
2. 创建 `fix/revert-xxx` 分支
3. 走正常 PR 流程

**紧急回滚**（生产数据严重错误，需秒级恢复）：

见 3.5 节。由持有 Admin 权限的开发者执行，revert 后直推 main。

---

## 8. 目录结构规划

```
FFXIVRanking/
├── .pi/                         # PI Agent 配置
│   ├── SYSTEM.md                # Agent 角色定义
│   ├── prompts/                 # Prompt Templates — 运营触发入口
│   │   ├── update-team.md       #    触发 update-team skill
│   │   ├── update-meta.md       #    触发 update-meta skill
│   │   ├── add-news.md          #    触发 add-news skill
│   │   ├── update-broadcaster.md#    触发 update-broadcaster skill
│   │   ├── update-content.md    #    触发 update-content skill
│   │   └── check-data.md        #    数据校验 / 诊断
│   ├── skills/                  # Skills — 运营操作工作流
│   │   ├── update-team/
│   │   │   └── SKILL.md
│   │   ├── update-meta/
│   │   │   └── SKILL.md
│   │   ├── add-news/
│   │   │   └── SKILL.md
│   │   ├── update-broadcaster/
│   │   │   └── SKILL.md
│   │   └── update-content/
│   │       └── SKILL.md
│   ├── rules/                   # Rules — 质量约束
│   │   ├── content-style.md     #    中文风格、术语规范
│   │   └── data-integrity.md    #    数据完整性、边界值检查
│   └── extensions/              # Extensions — 硬约束（规划中）
│       ├── merge-gate.ts        #    合并确认门禁
│       └── preview-url.ts       #    预览链接自动构造
│
├── schema/                      # 数据契约
│   ├── root.schema.json         #    顶层结构 + $ref 聚合
│   ├── meta.schema.json         #    赛事元信息
│   ├── team.schema.json         #    队伍 + $ref player
│   ├── player.schema.json       #    单个玩家
│   ├── news.schema.json         #    赛事速报
│   └── broadcaster.schema.json  #    转播方
│
├── constants.js                 # 结构常量（PHASE_ORDER、白名单，开发者维护）
│
├── .github/
│   └── workflows/
│       └── validate.yml         # CI：三阶段校验 + 文件范围 + 双向硬阻断
│
├── package.json                 # CI 依赖（ajv，dev-only）
├── index.html                   # 启动页 / 排名总览
├── data.js                      # 数据层（运营侧唯一写入目标）
└── CLAUDE.md                    # 项目开发指引
```

---

## 附录 A：实现路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| **阶段 1** | 静态前端页面 + `data.js` 数据层 | ✅ 完成 |
| **阶段 2** | Skills + Rules + Prompt Templates 正式化 | ✅ 完成 |
| **阶段 3** | CI 校验层（GitHub Actions）+ Branch Protection 落地 | ✅ 完成 |
| **阶段 4** | Extensions（合并门禁 + 预览链接）+ CODEOWNERS | ✅ 完成 |
| **阶段 5** | Schema 驱动校验 + 文件拆分（constants.js / schema/ / data.js） | ✅ 完成 |
| **阶段 6** | 双向 CI 硬阻断（dev PR 禁改 data.js，content PR 禁改其他） | ✅ 完成 |

## 附录 B：模型路由（上线后优化）

Agent 起步阶段统一使用 Sonnet 模型，降低行为不确定性。上线运行稳定后，按操作复杂度引入模型路由以降低调用成本：

| 操作类型 | 复杂度 | 推荐模型 | thinking |
|----------|--------|---------|----------|
| 更新队伍进度 | 低（单字段修改） | Haiku | low |
| 添加新闻速报 | 低（单条插入） | Haiku | low |
| 更新转播方 | 低（单记录变更） | Haiku | low |
| 更新公告 / 赞助 | 低（单记录变更） | Haiku | low |
| 更新赛事元信息 | 中（多字段修改） | Sonnet | medium |
| 批量迁移历史数据 | 高（多记录对账） | Sonnet | high |
| 冲突修复（CI 挂） | 高（读日志、诊断、修正） | Sonnet | high |

引入时机：运营轨稳定运行 2–3 个赛事周期后，确认 Agent 行为一致、高频操作模式可预测。
