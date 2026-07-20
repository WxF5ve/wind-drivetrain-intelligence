# 微信上线与自动更新

这个项目交付的是微信可直接打开的 H5/PWA。微信传播需要一个公网 HTTPS 地址；`localhost` 和局域网地址只能用于本机测试。

## 推荐方案：GitHub Pages

GitHub Pages 与仓库中的工作流已经打通。首次设置完成后，每周一 08:30（北京时间）会自动采集、测试并发布。

1. 在 GitHub 新建一个公开仓库，例如 `wind-intel`，不要勾选自动创建 README。
2. 在本项目目录执行：

```powershell
git init
git branch -M main
git add .
git commit -m "feat: publish wind drivetrain intelligence"
git remote add origin https://github.com/你的用户名/wind-intel.git
git push -u origin main
```

3. 打开仓库 `Settings > Pages`，将 `Source` 设为 `GitHub Actions`。
4. 打开仓库 `Actions`，手动运行一次 `Collect and publish wind drivetrain intelligence`。
5. 成功后访问 `https://你的用户名.github.io/wind-intel/`，将此链接发送到微信好友、群聊或朋友圈。

当前项目已经发布到：`https://wxf5ve.github.io/wind-drivetrain-intelligence/`

## DeepSeek AI 中文摘要

没有 API 密钥时，系统使用发布方公开摘要或明确提示“原始索引未提供可用摘要”，不会补造结论。需要 DeepSeek 结构化中文工程摘要时：

1. 在 GitHub 仓库打开 `Settings > Secrets and variables > Actions`。
2. 新建 Repository secret：`DEEPSEEK_API_KEY`。
3. 可选新建 Repository variable：`DEEPSEEK_MODEL`，默认值为 `deepseek-chat`。

密钥只放在 GitHub Secret 中，不要写进网页、数据文件或聊天消息。每周任务只总结新增资料；达到反馈阈值的争议资料会触发 AI 复核，并保留复核原因和反馈快照。

## 临时发布

也可以先运行 `npm run build`，把 `dist` 目录上传到 Cloudflare Pages Direct Upload。这个方式能立即获得 HTTPS 链接，但每周自动更新仍建议使用 GitHub 仓库连接或当前 GitHub Pages 工作流。

## 微信分享边界

普通 HTTPS 页面可直接在微信打开并使用右上角菜单传播，页面也提供整站和单条资讯分享按钮。若要强制指定好友/朋友圈卡片标题、描述和封面，需要已认证公众号、已备案的 JS 接口安全域名及微信 JS-SDK 签名服务；这些身份资料不能由静态网页代替。

面向中国大陆长期公开运营时，建议使用自有域名和境内云服务，并根据实际业务完成 ICP 备案及数据合规检查。

## 可靠度与反馈

页面会显示可解释可靠度，不将自动评分等同于事实确认。反馈服务当前部署在 `https://wind-intel-feedback.wxf5ve-wind-intel.workers.dev`，保存文章 ID、匿名浏览器 ID、四类反馈、工程心得、适用背景和更新时间。同一浏览器对同一文章只保留最新一份心得。

心得正文不会进入公开网页数据。Cloudflare Worker secret `AGGREGATE_TOKEN` 必须与 GitHub Repository secret `FEEDBACK_AGGREGATE_TOKEN` 使用同一随机值；只有每周采集任务可读取去标识化的心得正文。公开 `/aggregates` 请求只能看到数量和结构化统计。
