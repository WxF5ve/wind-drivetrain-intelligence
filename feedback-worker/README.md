# 集中反馈服务

该 Worker 只接收四种结构化反馈，不收集姓名、邮箱、评论正文或 IP 地址。`article_id + client_id` 为唯一键，同一浏览器再次反馈会覆盖旧选择，避免重复计票。

部署需要 Cloudflare 账号：

1. 创建 D1 数据库 `wind-intel-feedback`。
2. 执行 `schema.sql`。
3. 将 `wrangler.toml.example` 复制为 `wrangler.toml`，填写数据库 ID 和 GitHub Pages 公开地址。
4. 部署 Worker。
5. 在 GitHub Actions variables 中设置：
   - `FEEDBACK_API_URL`：Worker 根地址。
   - `FEEDBACK_AGGREGATE_URL`：Worker 的 `/aggregates` 地址。

前端提交失败时会保留本机反馈。每周采集器读取聚合结果；只有同一资料至少收到 5 份反馈时，才允许在 `-6` 至 `+6` 分范围内修正可靠度。

当前生产地址：`https://wind-intel-feedback.wxf5ve-wind-intel.workers.dev`
