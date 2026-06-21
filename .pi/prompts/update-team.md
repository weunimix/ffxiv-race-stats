---
description: 更新队伍进度
argument-hint: "<队伍名|队伍ID> <阶段> <HP%>"
---

# 更新队伍进度

从 `data.js` 中定位目标队伍，更新其 `phase`、`bossHP`、`isLive` 字段。

## 操作流程

1. 读取当前 `data.js`
2. 根据队伍名或 ID 定位目标队伍
3. 确认修改内容：新 phase、新 HP、是否仍存活
4. 自检：
   - phase 必须在 `PHASE_ORDER` 白名单内（PHASE_ORDER 定义在 `constants.js`）
   - bossHP 在 0-100 区间，只能减少不能增加
   - 如果 HP 归零且 phase 为最终阶段，该队已通关
5. 推送到 `content/update-<队伍id>-<阶段>` 分支
6. 创建 PR（`gh pr create --base main`）
7. 告知运营预览链接 + PR 链接，等待确认
8. 收到确认后，CI 通过则 `gh pr merge --squash --delete-branch`
