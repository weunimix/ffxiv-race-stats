---
name: update-team
description: >
  更新队伍攻略进度。当运营要求修改某支队伍的 phase、bossHP、isLive 状态时触发。
  触发词：更新队伍、修改进度、打到P几、血量、通关、灭团、isLive。
---

# update-team

## 输入

运营自然语言，例如：
- "队伍1 打到 P5 了，血量 12%"
- "Neverland 已经通关了"
- "把 t3 的 isLive 改成 false"

## 工作流

### Step 1: 读取当前状态

读取 `data.js` → 定位目标队伍 → 返回当前 phase / bossHP / isLive

### Step 2: 确认意图

向运营确认理解：
```
"确认：将 [队伍名]（当前 P3 / HP 45.8%）更新为 P5 / HP 12.0%，是否正确？"
```

### Step 3: 校验

- phase 是否在 PHASE_ORDER 中？新 phase 是否 ≥ 当前 phase？
- bossHP 是否 ≤ 当前 HP？（进度不倒退）
- 如果 HP = 0 且 phase = FINAL：自动标记 isLive = false，该队已通关
- 如果 HP < 30 且 phase 仍为 P1：提请运营确认是否数据有误

### Step 4: 修改

直接编辑 `data.js` 中该队伍的对应字段。

### Step 5: 提交到预览分支并创建 PR

**重要：此时只是推到 `content/*` 分支并创建 PR——生产站 `ffxiv-race-stats.pages.dev` 还不会变。**

```bash
git checkout -b content/update-<队伍id>-<新phase>
git add data.js
git commit -m "content: 更新<队伍名> <当前phase>→<新phase> (HP <当前HP>%→<新HP>%)"
git push -u origin content/update-<队伍id>-<新phase>
```

push 成功后，创建 PR：

```bash
gh pr create \
  --title "content: 更新<队伍名> <当前phase>→<新phase> (HP <当前HP>%→<新HP>%)" \
  --body "## 变更摘要

- **队伍**: <队伍名> (#<队伍id>)
- **阶段**: <当前phase> → <新phase>
- **HP**: <当前HP>% → <新HP>%
- **isLive**: <true|false>

## 预览

预览链接将由 Cloudflare Pages 自动生成。

---
🤖 由 PI Agent 自动提交" \
  --base main
```

### Step 6: ⚠️ 输出合并提醒（必须执行，不可跳过）

PR 创建完成后，必须输出：

```
✅ PR 已创建：#<N> — https://github.com/<owner>/<repo>/pull/<N>
   预览链接：https://<净化后的分支名>.ffxiv-race-stats.pages.dev
   （分支名净化规则：/ → -，全小写，取前 28 字符）
   CI 校验：https://github.com/<owner>/<repo>/actions/runs/<run_id>

⚠️ 生产站 https://ffxiv-race-stats.pages.dev 还没有更新。
   请打开预览链接确认无误后，回复"合并"。
   我会用 Squash Merge 把改动合入 main 并自动部署到生产站。
```

**不收到运营回复"合并"，绝对不继续。**

### Step 7: 合并（收到运营确认后执行）

收到运营确认后，先确认 CI 已通过：

```bash
gh pr view <PR_NUMBER> --json state,statusCheckRollup
```

CI 通过后执行 Squash Merge：

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

如果 CI 未通过：
1. 读取 CI 错误日志：`gh run view <run_id> --log`
2. 诊断并修复 `data.js`
3. Commit + push 到同一 `content/*` 分支（PR 自动更新，CI 自动重跑）
4. 回到 Step 6，等待运营再次确认

合并成功后汇报：
```
✅ 已 Squash Merge 到 main，生产站即将更新：https://ffxiv-race-stats.pages.dev
```
