#!/usr/bin/env node

/**
 * data.js 校验脚本 — CI 在每次 PR 时运行。
 * 零依赖：只使用 Node.js 内置模块。
 *
 * 校验规则（来自 docs/operations-system-design.md §6.1）：
 *   通用：
 *     1. data.js 语法可解析
 *     2. RACE_DATA 包含全部六个顶层 key
 *     3. rank 无重复、无跳号、从 1 起始
 *     4. phase 值在 PHASE_ORDER 白名单内
 *     5. bossHP ∈ [0, 100]
 *     6. region ∈ {JP, NA, EU, OC, CN, KR}
 *     7. 每队 players[] 恰好 8 人
 *   提醒（不阻断）：
 *     8. stream URL 不为 "#" 占位符
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── 颜色输出 ──────────────────────────────────────────────
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`${RED}  ✗ ${msg}${RESET}`);
  errors++;
}

function warn(msg) {
  console.warn(`${YELLOW}  ⚠ ${msg}${RESET}`);
  warnings++;
}

function ok(msg) {
  console.log(`${GREEN}  ✓ ${msg}${RESET}`);
}

// ── 步骤 1：语法解析 ──────────────────────────────────────

console.log(`${BOLD}── 1. 语法解析 ──${RESET}`);

const dataJsPath = path.resolve(__dirname, "..", "data.js");

let raw;
try {
  raw = fs.readFileSync(dataJsPath, "utf-8");
  ok("data.js 读取成功");
} catch (e) {
  fail(`无法读取 data.js: ${e.message}`);
  process.exit(1);
}

// ── 步骤 2：沙箱执行 ──────────────────────────────────────

console.log(`\n${BOLD}── 2. 沙箱执行 ──${RESET}`);

// `const` 声明在 vm 沙箱中不会成为 context 属性，需要包装源码使其返回导出值。
const wrapped = raw + "\n;({ RACE_DATA, ROLE_COLORS, PHASE_ORDER });";

let RACE_DATA, PHASE_ORDER;

try {
  const script = new vm.Script(wrapped, { filename: "data.js" });
  const result = script.runInNewContext({ console });
  RACE_DATA = result.RACE_DATA;
  PHASE_ORDER = result.PHASE_ORDER;
  ok("data.js 在沙箱中执行成功");
} catch (e) {
  fail(`data.js 语法错误: ${e.message}`);
  process.exit(1);
}

if (!RACE_DATA || typeof RACE_DATA !== "object") {
  fail("RACE_DATA 不存在或不是对象");
  process.exit(1);
}

// ── 步骤 3：结构完整性 ───────────────────────────────────

console.log(`\n${BOLD}── 3. 结构完整性 ──${RESET}`);

const REQUIRED_KEYS = ["meta", "teams", "news", "broadcasters", "notices", "sponsors"];
const missing = REQUIRED_KEYS.filter((k) => !(k in RACE_DATA));
if (missing.length > 0) {
  missing.forEach((k) => fail(`缺少顶层 key: ${k}`));
} else {
  ok(`全部 ${REQUIRED_KEYS.length} 个顶层 key 存在`);
}

// ── 步骤 4：meta 校验 ────────────────────────────────────

console.log(`\n${BOLD}── 4. meta 校验 ──${RESET}`);

const VALID_STATUSES = ["upcoming", "live", "ended"];

if (RACE_DATA.meta) {
  if (!VALID_STATUSES.includes(RACE_DATA.meta.status)) {
    fail(`meta.status = "${RACE_DATA.meta.status}" 不在 [${VALID_STATUSES.join(", ")}] 中`);
  } else {
    ok(`meta.status = "${RACE_DATA.meta.status}"`);
  }
}

// ── 步骤 5：teams[] 校验 ─────────────────────────────────

console.log(`\n${BOLD}── 5. teams[] 校验 ──${RESET}`);

const VALID_REGIONS = ["JP", "NA", "EU", "OC", "CN", "KR"];
const VALID_ROLES = ["tank", "healer", "dps"];

if (!Array.isArray(RACE_DATA.teams)) {
  fail("teams 不是数组");
} else {
  const teams = RACE_DATA.teams;
  ok(`共 ${teams.length} 支队伍`);

  // 5a. rank 校验
  const ranks = teams.map((t) => t.rank).sort((a, b) => a - b);
  const expectedRanks = Array.from({ length: teams.length }, (_, i) => i + 1);
  const rankMismatch = ranks.some((r, i) => r !== expectedRanks[i]);
  if (rankMismatch) {
    fail("rank 存在重复或跳号");
  } else {
    ok("rank 1–" + teams.length + " 连续无跳号");
  }

  // 5b–5f: 逐队校验
  for (const team of teams) {
    const prefix = `[${team.name || team.id}]`;

    // bossHP
    if (typeof team.bossHP !== "number" || team.bossHP < 0 || team.bossHP > 100) {
      fail(`${prefix} bossHP = ${team.bossHP} 不在 [0, 100] 范围内`);
    }

    // phase
    if (PHASE_ORDER && Array.isArray(PHASE_ORDER)) {
      if (!PHASE_ORDER.includes(team.phase)) {
        fail(`${prefix} phase = "${team.phase}" 不在 PHASE_ORDER 白名单中`);
      }
    }

    // region
    if (!VALID_REGIONS.includes(team.region)) {
      fail(`${prefix} region = "${team.region}" 不在 [${VALID_REGIONS.join(", ")}] 中`);
    }

    // players[] 人数
    if (!Array.isArray(team.players)) {
      fail(`${prefix} players 不是数组`);
    } else {
      if (team.players.length !== 8) {
        fail(`${prefix} players[] 共 ${team.players.length} 人，应为 8 人`);
      }

      // 逐人校验
      for (const p of team.players) {
        if (!VALID_ROLES.includes(p.role)) {
          fail(`${prefix} 玩家 role = "${p.role}" 不在 [${VALID_ROLES.join(", ")}] 中`);
        }
        if (typeof p.streaming !== "boolean") {
          fail(`${prefix} 玩家 streaming 不是 boolean`);
        }
        if (typeof p.isLive !== "undefined" && typeof p.isLive !== "boolean") {
          fail(`${prefix} 玩家 isLive 不是 boolean`);
        }
      }
    }

    // isLive
    if (typeof team.isLive !== "boolean") {
      fail(`${prefix} isLive 不是 boolean`);
    }
  }

  // 只报告队伍级别的 ok，避免日志过长
  if (errors === 0 || (errors > 0 && errors <= warnings)) {
    const teamErrors = errors; // snapshot
    // 逐队校验已完成，汇总
  }
}

// ── 步骤 6：news[] 基本校验 ──────────────────────────────

console.log(`\n${BOLD}── 6. news[] 校验 ──${RESET}`);

if (!Array.isArray(RACE_DATA.news)) {
  fail("news 不是数组");
} else {
  ok(`共 ${RACE_DATA.news.length} 条新闻`);
  let newsIssues = 0;
  for (const item of RACE_DATA.news) {
    if (!item.id) { newsIssues++; fail(`新闻缺少 id`); break; }
  }
  if (newsIssues === 0) ok("所有新闻条目格式正常");
}

// ── 步骤 7：broadcasters[] 基本校验 ───────────────────────

console.log(`\n${BOLD}── 7. broadcasters[] 校验 ──${RESET}`);

if (!Array.isArray(RACE_DATA.broadcasters)) {
  fail("broadcasters 不是数组");
} else {
  ok(`共 ${RACE_DATA.broadcasters.length} 个转播方`);
}

// ── 步骤 8：提醒项（不阻断） ──────────────────────────────

console.log(`\n${BOLD}── 8. 提醒（不阻断 CI）──${RESET}`);

if (Array.isArray(RACE_DATA.teams)) {
  let placeholderCount = 0;
  let placeholderPlayerCount = 0;
  for (const team of RACE_DATA.teams) {
    if (team.name && (team.name.startsWith("[") || team.name.includes("队伍名"))) {
      placeholderCount++;
    }
    if (Array.isArray(team.players)) {
      for (const p of team.players) {
        if (p.stream === "#") placeholderPlayerCount++;
      }
    }
  }
  if (placeholderCount > 0) {
    warn(`${placeholderCount} 支队伍名称仍为占位符 [队伍名 X]`);
  }
  if (placeholderPlayerCount > 0 && RACE_DATA.meta && RACE_DATA.meta.status === "live") {
    warn(`${placeholderPlayerCount} 个直播链接仍为占位符 "#"，赛事已 LIVE`);
  }
}

// ── 结果汇总 ─────────────────────────────────────────────

console.log(`\n${BOLD}══════════════════════════════════════${RESET}`);
if (errors === 0) {
  console.log(`${GREEN}${BOLD}  校验通过 ✓${RESET}`);
  if (warnings > 0) {
    console.log(`${YELLOW}  ${warnings} 条提醒（不阻断）${RESET}`);
  }
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}  校验失败: ${errors} 条错误${RESET}`);
  if (warnings > 0) {
    console.log(`${YELLOW}  ${warnings} 条提醒${RESET}`);
  }
  process.exit(1);
}
