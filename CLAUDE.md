# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FFXIV 高难首杀竞速网站 — a static web platform aggregating Final Fantasy XIV world-first raid race rankings, strategy guides, news, and live stream links. Currently in prototype phase with two static screens sharing a single in-memory data layer.

Planned pipeline: Operations staff → PI Agent (template/validate) → GitHub → CI → Cloudflare Pages. The Agent handles content styling, data validation, and commit hygiene — operations staff never touch `data.js` directly.

Design docs live in `docs/`:
- `operations-system-design.md` — 双轨分支模型、权限体系、Agent 能力设计、CI 与质量保障

## Running / Viewing

No build step, no dependencies. Open `index.html` directly in a browser, or serve with any static HTTP server:

```bash
python -m http.server 8000
# Or open index.html directly
```

There is no `package.json`, no bundler, no test runner, and no linter yet.

## Deployment

**Cloudflare Pages** connected to this GitHub repo. Push to `main` → auto-deploy to production. Push to any branch → auto-generated preview URL.

| Environment | Trigger | URL |
|-------------|---------|-----|
| **Production** | PR merge to `main` | `ffxiv-race-stats.pages.dev` |
| **Preview** | Push to any branch | `*.ffxiv-race-stats.pages.dev` |

No build command needed — Cloudflare Pages serves the repo root as-is.

## Developer Workflow (CRITICAL)

**Violating these rules means your changes skip review and land directly on production — don't do it.**

### Before any change

1. Read [docs/operations-system-design.md](docs/operations-system-design.md) — understand the dual-track model, permission boundaries, and which files you are allowed to touch
2. Check you are **not** on `main`:
   ```bash
   git branch --show-current
   ```

### Starting work

**Never start from `main`.** Always create a branch:

```bash
git checkout main && git pull
git checkout -b feature/<verb>-<noun>    # new feature
git checkout -b fix/<what>               # bug fix
```

### Making changes

| Allowed | Forbidden |
|---------|-----------|
| `*.html` — page structure, content, styles | Direct edit of `main` branch |
| `*.css` — stylesheets (if/when external) | Push directly to `main` |
| `*.js` — schema/structure changes to `data.js`, new JS modules | Edit `data.js` **data values** (that's the ops track) |
| `.github/**` — CI workflows | Touch `content/*` branches |
| `schema/**` — JSON Schema | Force push to `feature/*` (squash instead) |
| `.pi/**` — Agent configuration | |
| `CLAUDE.md`, `README.md`, `docs/*.md` | |

When you need to change the **structure** of `data.js` (add fields, change types), follow the backward-compatibility rule in the operations design doc (§3.4). Don't change data values at the same time — do schema and values in separate PRs.

### Committing

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

### Before pushing

- [ ] You are on a `feature/*` or `fix/*` branch, not `main`
- [ ] Diff contains only files you're authorized to change
- [ ] No `data.js` **data values** accidentally changed
- [ ] Commit message follows the format above

### Merging to main

1. Push the branch → Cloudflare Pages auto-generates preview
2. Create a PR: `feature/*` → `main`
3. CI must pass
4. Another developer must approve (Code Review)
5. **Squash merge** — one clean commit on `main`

**Never self-merge without review.** Even for trivial fixes, create a PR. The only exception is emergency revert of a content merge commit — and that's done by a repo admin, not by you.

## Architecture

**Screen-file-first:** `index.html` is the single user-facing page — a launcher/overview with ranking table (TOP 15), news ticker, broadcaster sidebar, race timer, and sponsor widget.

**Data layer:** `data.js` defines a single global `RACE_DATA` object consumed by the page. It is designed as a swappable module — replace this one file to switch from static placeholder data to a dynamic data source (CMS, API) without touching UI structure.

```
index.html ─── data.js (RACE_DATA + ROLE_COLORS + PHASE_ORDER)
```

The page uses an IIFE to render DOM from `RACE_DATA` on load. There is no framework, no routing, no shared JS modules beyond `data.js`.

### Maintenance Boundary

```
运营维护（data.js 数据值）
├── meta        — eventName, status, startTime, registrationUrl …
├── teams[]     — 队伍进度 + 8 人配置 + 直播状态
├── news[]      — 速报条目
├── broadcasters[] — 转播方
├── notices[]   — 赛事公告
├── sponsors[]  — 赞助公示
└── PHASE_ORDER — 阶段定义

开发维护（页面代码）
├── HTML 结构   — 布局、导航、模块框架
├── CSS 样式    — token、响应式、动画
├── JS 逻辑     — 计时器、统计聚合、交互
├── data.js 结构 — schema 设计、字段约束（值由运营维护）
├── CI / Schema — 校验规则
└── .pi/**      — Agent 配置
```

**Never edit data values in `data.js` directly — that's the ops track.** When you need new fields or structural changes, see §3.4 of the operations design doc.

## Design System

**OKLCH token system** in `:root` of each HTML file. Six to ten CSS custom properties control the entire site theme:

| Token | Purpose |
|-------|---------|
| `--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent` | Light theme base |
| `--crt-bg`, `--crt-fg`, `--crt-glow`, `--crt-muted`, `--crt-border` | CRT terminal overlay (ranking table) |
| `--live`, `--warn`, `--success` | Semantic status colors |
| `--font-display`, `--font-body`, `--font-mono` | Font stacks (serif display, monospace body) |

Do not introduce new colors without adding them as tokens. Do not change the OKLCH color space without a deliberate migration.

**Typography:** Serif headings (`font-display`), monospace body (`font-body`). `clamp()` fluid type on `h1`. No external font dependencies — system font stacks only.

**Responsive breakpoints** (CSS media queries, progressively hide columns on narrow viewports):

| Width | Behavior |
|-------|----------|
| ≤960px | Hide job composition column |
| ≤860px | Hide HP column, compact status bar |
| ≤800px | Hide phase column |
| ≤680px | Hide live link column |
| ≤640px | Full mobile: stack layout, reduce padding |

Target viewport matrix (from DESIGN-MANIFEST.json): 360×800, 390×844, 430×932, 600×960, 820×1180, 1024×768, 1366×768, 1440×900, 1920×1080. No horizontal overflow at any breakpoint.

**Animations:** Staggered entry (`anim-entry` class + `setTimeout` sequencing), CSS `@keyframes` for scan-line CRT effect and LED blink, `requestAnimationFrame`-based count-up numbers, HP bar fill via CSS `transition` with `steps()` easing.

## Key Conventions

- **All text is Chinese (zh-CN).** UI labels, data placeholders, and comments are in Chinese. New UI strings should use Chinese.
- **Placeholder data uses bracket notation:** `[队伍名 1]`, `[当届赛事名称]`, `#` for URLs. Real data replaces these placeholders.
- **No external dependencies.** Any new library must be justified — the prototype ethos is zero-dependency vanilla web.
- **CSS is inline `<style>` blocks per HTML file.** There are no external stylesheets. If styles need sharing, extract tokens to a shared CSS file first — do not duplicate across files.
- **`data.js.bak`** is a stale backup. Ignore it; keep `data.js` as the single source of truth.
- **The design handoff** (`DESIGN-HANDOFF.md`, `DESIGN-MANIFEST.json`) is the visual contract. Match exported pixels and behavior before refactoring internals. Preserve the existing visual hierarchy, spacing rhythm, motion timing, and component states when implementing changes.
