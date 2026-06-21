---
name: add-broadcaster
description: >
  管理赛事转播方。当运营要求添加、更新、删除转播方时触发。
  触发词：转播方、添加转播、删除转播、更新直播间、broadcaster。
---

# add-broadcaster

## 输入

运营自然语言，例如：
- "添加转播方：老陈 bilibili https://live.bilibili.com/12345"
- "删除转播方 青豆"
- "更新转播方 老陈 的直播间地址"

## 工作流

### Step 1: 读取当前广播列表

从 `data.js` 获取 `broadcasters[]` 当前内容。

### Step 2: 确认操作

向运营确认：
```
"确认 [添加/删除/更新] 转播方：
  名称：[name]
  平台：[platform]
  链接：[url]
是否执行？"
```

### Step 3: 校验

- `platform` ∈ `{ bilibili, douyu, huya, twitch, youtube }`
- `url` 格式正确（以 `https://` 开头）
- 添加时：`id` 基于最大已有 id + 1
- 无重复名称

### Step 4: 提交到预览分支并创建 PR

**重要：此时只是推到 `content/*` 分支并创建 PR——生产站还不会变。**

```bash
git checkout -b content/update-broadcaster-<名称>
git add data.js
git commit -m "content: update broadcaster - <名称>"
git push -u origin content/update-broadcaster-<名称>
```

push 成功后，创建 PR：

```bash
gh pr create \
  --title "content: update broadcaster - <名称>" \
  --body "## 变更摘要

- **操作**: <添加/删除/更新>
- **转播方**: <名称>
- **平台**: <platform>
- **链接**: <url>

## 预览

预览链接将由 Cloudflare Pages 自动生成。

---
🤖 由 PI Agent 自动提交" \
  --base main
```

### Step 5: ⚠️ 输出合并提醒（必须执行，不可跳过）

PR 创建完成后，必须输出：

```
✅ PR 已创建：#<N> — https://github.com/<owner>/<repo>/pull/<N>
   预览链接：https://<commit>.ffxiv-race-stats.pages.dev
   CI 校验：https://github.com/<owner>/<repo>/actions/runs/<run_id>

⚠️ 生产站 https://ffxiv-race-stats.pages.dev 还没有更新。
   请打开预览链接确认无误后，回复"合并"。
   我会用 Squash Merge 把改动合入 main 并自动部署到生产站。
```

**不收到运营回复"合并"，绝对不继续。**

### Step 6: 合并（收到运营确认后执行）

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
4. 回到 Step 5，等待运营再次确认

合并成功后汇报：
```
✅ 已 Squash Merge 到 main，生产站即将更新：https://ffxiv-race-stats.pages.dev
```
