# 集中反馈服务

该 Worker 接收四种资料反馈和一份匿名工程心得。心得正文限制为 20-1200 字，并附适用性、部件、失效模式、证据等级、功率区间和应用场景。页面明确要求用户不要填写姓名、邮箱、公司、项目、机组编号等保密信息；Worker 不主动保存 IP 地址。`article_id + client_id` 为唯一键，同一浏览器再次提交会覆盖旧内容。

部署需要 Cloudflare 账号：

1. 创建 D1 数据库 `wind-intel-feedback`。
2. 新数据库执行 `schema.sql`；现有数据库依次执行 `migrations` 中尚未应用的 SQL。
3. 将 `wrangler.toml.example` 复制为 `wrangler.toml`，填写数据库 ID 和 GitHub Pages 公开地址。
4. 部署 Worker。
5. 在 GitHub Actions variables 中设置：
   - `FEEDBACK_API_URL`：Worker 根地址。
   - `FEEDBACK_AGGREGATE_URL`：Worker 的 `/aggregates` 地址。
6. 生成至少 32 字符的随机密钥，在 Cloudflare 中保存为 Worker secret `AGGREGATE_TOKEN`，并将同一值保存为 GitHub Repository secret `FEEDBACK_AGGREGATE_TOKEN`。

前端提交失败时会保留本机反馈。每周采集器读取聚合结果；只有同一资料至少收到 5 份反馈时，才允许在 `-6` 至 `+6` 分范围内修正可靠度。

公开 `/aggregates` 只返回数量和结构化统计。只有携带正确 Bearer token 的每周采集任务能取得去标识化心得正文；正文不会写入 `public/data/articles.json`。至少两条独立心得新增或更新后才触发下一轮 AI 复核，单条心得不会直接影响公开结论。AI 输出会单独标记为工程经验复核，不能替代论文、试验报告或失效分析原始证据。

当前生产地址：`https://wind-intel-feedback.wxf5ve-wind-intel.workers.dev`
