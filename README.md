# FFXIV 高难首杀竞速年鉴

Final Fantasy XIV 世界首杀竞速排行聚合平台。追踪绝境/零式副本的首杀争夺战，提供队伍进度、选手直播、赛事速报一站式浏览。

## 当前进度

原型阶段，两个静态页面共享 `data.js` 数据层。规划中：PI Agent 驱动的运营工作流 + Cloudflare Pages 自动部署。

## 本地预览

无依赖，直接打开 HTML 文件或起一个静态服务器：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 设计文档

| 文档 | 内容 |
|------|------|
| [MVP 需求](docs/mvp-requirements.md) | 产品功能规划（7 页） |
| [Agent 后端设计](docs/agent-backend-design.md) | 双轨分支模型、CI 流水线、Agent 工作流 |
