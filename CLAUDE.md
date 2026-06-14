# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FFXIV 高难首杀竞速年鉴 — a static web platform aggregating Final Fantasy XIV world-first raid race rankings, strategy guides, news, and live stream links. Currently in prototype phase with two static screens sharing a single in-memory data layer.

## Running / Viewing

No build step, no dependencies. Open `index.html` or `live.html` directly in a browser, or serve with any static HTTP server:

```bash
# Python (any version)
python -m http.server 8000

# Or just open directly
open index.html
```

There is no `package.json`, no bundler, no test runner, and no linter yet.

## Architecture

**Screen-file-first:** Each user-facing screen is its own HTML file. `index.html` is the launcher/overview (ranking TOP 10, news ticker, broadcaster sidebar). `live.html` is a dedicated, expanded live tracker with click-to-expand player detail rows.

**Data layer:** `data.js` defines a single global `RACE_DATA` object consumed by both screens. It is designed as a swappable module — replace this one file to switch from static placeholder data to a dynamic data source (CMS, API) without touching UI structure.

```
index.html ──┐
             ├── data.js (RACE_DATA + ROLE_COLORS + PHASE_ORDER)
live.html  ──┘
```

Both screens use IIFEs to render DOM from `RACE_DATA` on load. There is no framework, no routing, no shared JS modules beyond `data.js`.

### Data Schema (RACE_DATA)

| Key | Shape |
|-----|-------|
| `meta` | `{ eventName, edition, dungeon, boss, dataCenter, startTime, status }` — `status` is `"upcoming" \| "live" \| "ended"` |
| `teams[]` | `{ id, name, rank, bossHP, phase, region, isLive, players[] }` — each player has `{ job, role, stream, streaming }` |
| `news[]` | `{ id, time, title, urgent }` |
| `broadcasters[]` | `{ id, name, platform, url }` |

Helper constants: `ROLE_COLORS` maps `tank`/`healer`/`dps` to CSS color strings. `PHASE_ORDER` is an array of phase names for sorting/comparison.

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
