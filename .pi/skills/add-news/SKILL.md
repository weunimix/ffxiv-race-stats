---
name: add-news
description: >
  添加赛事速报。当运营要求发布新闻、速报、公告时触发。
  触发词：发速报、发布新闻、公告、快讯、播报。
---

# add-news

## 输入

运营自然语言，例如：
- "发一条速报：Neverland 世界首杀，用时 38 小时"
- "公告：服务器维护，明天下午 2 点恢复"

## 工作流

### Step 1: 提取信息

从运营输入中提取：
- `title`：简洁标题（≤50 字）
- `urgent`：是否标记为紧急（首杀/重大事件）
- `time`：自动生成当前时间

### Step 2: 确认

向运营确认：
```
"确认添加速报：
  标题：[提取的标题]
  时间：2026-06-15 18:30
  紧急：是/否
是否发布？"
```

### Step 3: 修改

在 `data.js` 的 `news[]` 数组头部插入新条目。

### Step 4: 提交到预览分支并创建 PR

**重要：此时只是推到 `content/*` 分支并创建 PR——生产站还不会变。**

```bash
git checkout -b content/add-news-<id>
git add data.js
git commit -m "content: add news - <标题>"
git push -u origin content/add-news-<id>
```

push 成功后，创建 PR：

```bash
gh pr create \
  --title "content: add news - <标题>" \
  --body "## 变更摘要

- **标题**: <标题>
- **时间**: <YYYY-MM-DD HH:mm>
- **紧急**: <是/否>

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
