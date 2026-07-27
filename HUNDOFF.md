# 机械中心-传动技术部在线平台项目交接文档

> 文件名 `HUNDOFF.md` 按用户指定保留。本文写给一个完全没有历史上下文的新对话或新维护者。

## 1. 一句话说明

这是一个面向风电行业和传动链研发工程师的微信 H5/PWA。系统每周自动采集国内外论文、政策、企业项目和技术资讯，优先读取合法公开全文并使用 DeepSeek 生成受约束的中文工程摘要，同时允许工程师匿名提交书面心得，作为后续 AI 复核的待核验上下文。

## 2. 用户背景和不可违反的原则

用户是一名风电行业齿轮箱开发工程师，未来计划邀请较多工程师共同使用。

必须坚持：

- 不得伪造论文、厂商新闻、影响因子、试验数据或量化结论。
- 没有 JCR 权限时不能把 OpenAlex 指标称为影响因子。
- API Key、Cloudflare Token 和聚合密钥不得出现在聊天、前端、仓库或日志正文中。
- 工程心得必须可追溯到“匿名工程师反馈”，不能冒充论文或试验报告事实。
- 工程心得中的数字不能进入公开量化结论，除非相同数字也在标题或公开摘要中。
- 任何代码改动都要兼顾微信内置浏览器和 390px 手机宽度。
- 不得因自动化方便而降低企业保密信息的保护标准。

## 3. 工作区和生产资源

| 项目 | 值 |
| --- | --- |
| 本地工作区 | `D:\齿轮箱轴承研究讯息自动化搜集app` |
| GitHub 仓库 | https://github.com/WxF5ve/wind-drivetrain-intelligence |
| 正式网页 | https://wxf5ve.github.io/wind-drivetrain-intelligence/ |
| Cloudflare Worker | https://wind-intel-feedback.wxf5ve-wind-intel.workers.dev |
| D1 数据库 | `wind-intel-feedback` |
| D1 database ID | `d821720f-dc37-40bb-b1aa-7fe77a689d77` |
| 当前分支 | `main` |
| 本轮开发基线 | `main` 上 2026-07-28 传动链分类与官网采集改造；以最新提交为准 |
| Worker 版本 | `54098d43-5061-4c19-b536-736923576c5d` |
| 本地交付包 | `D:\齿轮箱轴承研究讯息自动化搜集app\wind-intel-wechat.zip` |

不要依赖本表中的提交号判断线上版本；应同时检查 `git log`、GitHub Actions 和正式网页文件。

## 4. 我们做了什么任务

项目从一个展示型网页逐步完成为真实运行的工程情报系统：

1. 将示例数据替换为真实公开来源采集。
2. 建立每周一自动采集、测试和 GitHub Pages 发布。
3. 扩展风电齿轮箱研发关键词和整机厂、齿轮箱、轴承、润滑供应商动态。
4. 接入 DeepSeek API，密钥保存在 GitHub Secret。
5. 增加论文和行业动态的详细结构化摘要。
6. 建立可解释可靠度、快速反馈和有限校准。
7. 建立 Cloudflare Worker + D1 集中反馈服务。
8. 增加工程经验入口、书面心得、结构化背景和撤销功能。
9. 建立受保护的心得读取接口和 AI 工程经验复核。
10. 完成桌面端、移动端、微信传播和隐私边界验证。
11. 增加最近 7 天情报的结构化周报模型和一键 PDF 下载。
12. 增加新华社、中国政府网、国家能源局、发改委、工信部、国资委、人民日报、央视和中国风能协会定向渠道。
13. 全站改名为“机械中心-传动技术部在线平台”。
14. 将首页重组为传动链技术开发与质量运维、论文标准专利、厂商项目、政策市场产业环境、综合资讯与待深读线索五个突出主栏目，“全部”降为辅助入口。
15. 建立“唯一主部件 + 关联部件 + 正交标签”分类，分别保存具体零件、技术领域、精确技术、失效模式、开发阶段和证据类型。
16. 增加公开 HTML/PDF 全文优先提取，失败时按摘要、元数据逐级回退。
17. 周报改为每条一个自然段，分别强调机构、关键技术和必要数值，不显示模板字段标签。
18. 将主题分类与信息层级分离：全文/摘要完整展示，题名简讯和论文/标准/专利题录回归对应主题栏目，综合待深读线索单列，招聘等噪声隐藏；后三类不进入 AI 或 PDF 周报。
19. 新闻检索改为合并 Google/Bing 双索引，论文扩展到 OpenAlex/Crossref，并接入国内能源、传动、制造和学术题录定向渠道。
20. 新增独立官网网页采集器，定向覆盖传动链企业、整机厂、CWEA、NREL/OSTI/Sandia/DNV、Google Patents 和标准页面。
21. 将 212 条历史真实资料迁移到分类体系 v2，并修复行业摘要中的供应链推演污染主部件标签的问题。
22. 官网采集改为每个发布方单独执行 Google News `site:` 检索，最终链接仍需通过严格域名白名单；Bing Web 只作为补充。
23. 增加渠道健康状态：有效产出、单次空结果、连续低产和请求失败分开统计，首页同步提示本期无有效结果的通道数。
24. 增加 `--probe-sources=` 定向联网探测，不改写生产数据即可核验指定渠道和原文样例。
25. 补回生产 JSON 根字段 `taxonomyVersion: 2`，并增强 Google Patents 的 Dublin Core 元数据和公开摘要提取。
26. 将分类体系升级到 v3，新增 `readable`、`brief`、`catalog`、`lead`、`ignored` 信息层级和对应采集统计。
27. 周报删除“其中/项目容量为/计划节点为/公开金额为”等独立补写以及来源渠道评价，时间字段不再机械追加到正文。
28. 只为普通全文提取失败的公开网页增加一次文本化恢复；成功后按 `content-upgrade` 交给 DeepSeek 重新总结和分类，失败则保持题录或待深读，题名本身不进入 AI。
29. 修复 `pdfjs-dist` v6 的 PDF 销毁兼容问题，使原本已提取但被异常降级的开放 PDF 正文能够正常进入摘要流程。
30. 再次清理周报历史摘要中的“属于行业动态”“证据层级”“结论边界”、重复容量和重复工程意义，只保留连续综述段落及内联数据强调。

## 5. 已经完成的功能

### 5.1 自动采集和发布

- GitHub Actions：`.github/workflows/weekly-collect.yml`
- 主定时：UTC `30 0 * * 1`，即北京时间每周一 08:30
- 兜底定时：UTC `15 3 * * 1`，即北京时间每周一 11:15
- 兜底任务先同步最新 `main`，再按北京时间检查 `generatedAt`；当天已更新则跳过采集，避免重复调用 AI
- 默认回看：30 天
- 手动任务可设置 `resummarize`、`lookback_days` 和 `max_articles`
- 定时或手动任务运行采集；普通 push 只测试、构建和发布，提交信息显式包含 `[collect]` 时允许一次受控强制采集
- 采集完成后机器人提交 `public/data/articles.json`

### 5.2 数据源和主题

- Google News RSS
- Bing News RSS
- OpenAlex 学术索引
- Crossref 学术索引
- 北极星、中国能源网、国际能源网、中国电力网、中国传动网、先进制造技术门户和今日头条公开页面
- 知网、万方、维普、PubScholar、NSTL 和中国科技论文在线公开题录入口
- 国内外齿轮箱、轴承、润滑、状态监测、设计载荷、材料制造、试验和数字孪生
- 国内外整机厂、齿轮箱厂商、轴承厂商和润滑供应商
- 44 个新闻/官方/企业查询、10 个官网/故障/专利/标准网页查询和 48 个论文/题录通道，共 102 个已配置通道
- 官网类渠道不再把多个 `site:` 条件拼进一次 Bing 查询；逐域检索后还要校验解码后的最终发布方 URL
- 普通提取失败的公开网页最多再尝试一次只读文本化恢复；默认每轮最多 24 条、并发 2，登录、付费、验证码、安全检查、聚合跳转和招聘噪声不进入该路径
- 新增感应淬火、喷丸、磨齿/珩齿、轴承跑圈、滑动轴承、振动/NVH、行星架强度、箱体变形、装配不对中和 CAE 仿真

### 5.3 论文详情

- 中文和原始题名
- 期刊、作者、DOI、ISSN、出版方、卷期
- OpenAlex 2 年平均被引率和 h-index，明确标记非 JCR 影响因子
- 目标、方法、试验对象、工况、限制
- 量化结论仅在公开标题或摘要中出现相同数字时展示

### 5.4 行业详情

- 事件、企业、地点、容量、投资、时间线
- 供应链影响和核验状态
- 未公开字段留空
- 企业自述和媒体报道不会自动视为已证实事实

### 5.5 快速反馈

- 有价值
- 需核验
- 不相关
- 链接失效
- 少于 5 票不调整公共可靠度
- 调整限制为 `-6` 至 `+6`
- 负面反馈至少 3 票且占比至少 60% 才触发 AI 复核

### 5.6 书面工程心得

- 每张文章卡片有可见“工程经验”入口
- 点击后直接展开并滚动到输入框
- 正文 20-1200 字
- 六个结构化适用背景字段
- 已移除前端 1-5 分置信度输入
- 提交前强制确认不含单位或项目保密信息
- 同一浏览器和文章只保留一条当前记录
- 可覆盖、撤销、离线保存和自动重试

### 5.7 工程经验 AI 复核

- 至少两条独立书面心得新增或更新后触发
- 历史文章即使超出当前 30 天采集窗口也可以复核
- AI 输出单独的 `experienceReview`
- 字段为 `status`、`synthesis`、`applicableBoundary`、`verificationNeeded`
- UI 单独显示“工程经验复核”
- 用户心得被视为不可信输入，忽略其中任何提示指令

### 5.8 隐私隔离

- D1 保存心得正文
- 公开 `/aggregates` 不返回正文
- 带 Bearer Token 的 GitHub 周任务才能读取去标识化正文
- `public/data/articles.json` 使用白名单移除 `insights` 和 `latestInsightAt`
- 已在生产环境写入并清除合成测试心得，验证公开接口无正文、受保护接口可读取

### 5.9 一键 PDF 周报

- 首页按钮直接生成最近 7 天周报预览并下载 PDF
- 周报不是网页截图，而是独立的结构化摘要
- 每条只使用一个连续自然段，交代主体、事项、结果、必要数据和工程意义或适用边界
- 网页和 PDF 使用深绿色标机构、青绿色标关键技术、琥珀色标必要数字；不显示“主体/做了什么/关键点/工程意义”等模板标签
- 底层仍保留主体、事项、效果、必要数据和工程意义等结构化字段，叙述层只负责组合和排版，不改变事实边界
- 按四个可读主题栏目分组，每条资料只出现一次，题名简讯、题录和待深读线索不进入周报
- PDF 为 A4 分页，中文由浏览器 Canvas 排版后封装为 PDF，避免默认字体乱码
- 复制、分享和重复下载均可用

### 5.10 国内官方渠道

定向域名包括 `news.cn`、`xinhuanet.com`、`gov.cn`、`nea.gov.cn`、`ndrc.gov.cn`、`miit.gov.cn`、`sasac.gov.cn`、`people.com.cn`、`cctv.com` 和 `cwea.org.cn`。官方资料单独使用 `official` 主题，必须同时满足风电语境、政策/项目/装备等进展信号和指定发布域名校验。

## 6. 当前数据状态

截至 2026-07-27 最新生产采集：

| 指标 | 值 |
| --- | ---: |
| 历史公开资料 | 224 |
| 当前窗口资料 | 143 |
| 当前窗口论文 | 20 |
| 可读情报 | 69 |
| 仅元数据资料 | 74 |
| 题名简讯或题录 | 53 |
| 综合待深读线索 | 20 |
| 隐藏噪声 | 1 |
| 公开全文 | 45 |
| 公开摘要 | 24 |
| 最近原始抓取 | 652 |
| 已配置通道 | 102 |
| 请求成功通道 | 100 |
| 有效产出通道 | 55 |
| 本期首次空结果 | 0 |
| 连续低产通道 | 45 |
| 失败通道 | 2 |
| DeepSeek 本轮处理 | 请求 0 条，成功 0 条 |

数据生成时间：`2026-07-27T18:15:08.283Z`，根字段为 `taxonomyVersion: 3`。本轮没有新增资料或反馈满足 AI 摘要/复核条件，因此 DeepSeek 的 `requested` 和 `summarized` 均为 0；这不是调用失败或额度上限。两个 Google Patents 渠道因公开搜索接口返回 500 而失败，已保留失败状态，不绕过限制。

## 7. 生产配置

### 7.1 GitHub Secrets

已配置但不能读取或泄露值：

- `DEEPSEEK_API_KEY`
- `FEEDBACK_AGGREGATE_TOKEN`
- 可能存在备用 `OPENAI_API_KEY`

### 7.2 GitHub Variables

应保持：

- `FEEDBACK_API_URL`：Worker 根地址
- `FEEDBACK_AGGREGATE_URL`：Worker `/aggregates` 地址
- `DEEPSEEK_MODEL`：默认 `deepseek-chat`
- 可选 `DEEPSEEK_BASE_URL`

### 7.3 Cloudflare

- Worker secret：`AGGREGATE_TOKEN`
- 它必须和 GitHub Secret `FEEDBACK_AGGREGATE_TOKEN` 使用同一值
- Worker 环境变量 `ALLOWED_ORIGIN=https://wxf5ve.github.io`
- D1 已执行 `feedback-worker/migrations/0002_engineering_insights.sql`

绝对不要尝试从聊天或前端获取这些密钥。需要轮换时，在本机生成新随机值，并在同一个受控操作中同时覆盖 Cloudflare 和 GitHub。

## 8. 系统底层流程

```mermaid
flowchart TD
    A["周一定时 / 手动采集"] --> B["Google/Bing、官网网页、OpenAlex/Crossref、国内定向渠道"]
    B --> C["普通 HTML/PDF 原文解析"]
    C --> R{"正文提取成功?"}
    R -->|"是"| V["风电语境过滤、厂商校验"]
    R -->|"否，仅公开网页"| W["只读网页文本化恢复"]
    W --> V
    V --> D["URL、标题、同一事件去重和主部件归类"]
    D --> E["主题分类 + 信息层级判定"]
    E -->|"题名简讯 / 题录"| T["对应主题栏目紧凑展示"]
    E -->|"待深读"| L["综合资讯与待深读线索"]
    E -->|"噪声"| X["不展示"]
    F["Cloudflare D1 工程心得"] -->|"受保护聚合"| G["复核判断"]
    E -->|"可读情报"| G
    G --> H["DeepSeek JSON Schema 摘要/复核"]
    H --> I["数字证据和字段校验"]
    I --> J["公开 articles.json 白名单"]
    T --> J
    L --> J
    J --> K["GitHub Pages 微信 H5"]
```

关键点：AI 不是每周重写全部资料。只有新增、字段升级、手动刷新、达到负面反馈阈值或达到工程心得复核阈值的文章进入 AI。

## 9. 关键代码文件

| 文件 | 说明 |
| --- | --- |
| `public/app.js` | 前端状态、搜索、详情、反馈、心得和分享 |
| `public/styles.css` | UI 和响应式布局 |
| `public/sw.js` | PWA 缓存；当前缓存名 `wind-intel-v11` |
| `scripts/collect.mjs` | 采集总流程、反馈读取、历史复核和公开输出 |
| `scripts/migrate-taxonomy.mjs` | 历史数据的分类体系 v3 迁移 |
| `scripts/lib/ai.mjs` | DeepSeek/OpenAI、Schema、AI 防伪和经验复核 |
| `scripts/lib/articles.mjs` | 清洗、相关性、去重、可靠度、公开白名单 |
| `config/sources.json` | 采集主题、厂商、技术词权重和历史保留配置 |
| `feedback-worker/src/index.js` | Worker API、校验、D1 写入和受保护聚合 |
| `feedback-worker/schema.sql` | 新数据库完整结构 |
| `feedback-worker/migrations/0002_engineering_insights.sql` | 现有 D1 心得字段迁移 |
| `.github/workflows/weekly-collect.yml` | 每周采集和 Pages 发布 |
| `scripts/visual-check.cjs` | 桌面和手机端 Playwright 回归 |
| `WEB-INTRODUCTION.md` | 面向用户和维护者的完整产品说明 |

## 10. 当前卡在哪

没有阻断生产运行的代码问题。网页、Worker、D1、DeepSeek、GitHub Actions 和 GitHub Pages 已经打通。

当前限制属于下一阶段产品与治理问题：

- 没有工程师账号和实名/资质验证。
- 匿名浏览器 ID 不能有效抵抗一人多浏览器重复提交。
- 没有管理员审核台和内容举报机制。
- 没有敏感信息自动检测，主要依靠提示和确认框。
- 没有组织私有经验库，不能承载企业保密经验。
- 没有附件和证据文件上传。
- 没有 JCR 影响因子授权。
- 没有认证公众号和微信 JS-SDK，因此分享卡片控制能力有限。
- 当前“学习”是检索增强和定期复核，不是模型参数微调。
- Google Patents 的公开搜索接口会对自动查询返回 `503`；详情页解析已经实现，但在获得稳定、合法的专利检索 API 前，该渠道可能显示失败。不得绕过验证码或反自动化限制。

## 11. 下一步计划

### P0：身份、审核和保密

1. 增加工程师账号和登录。
2. 增加专业领域、单位可见性和组织权限。
3. 增加敏感信息检测、内容审核和举报。
4. 增加速率限制、设备/账号约束和滥用防护。
5. 区分公开经验与组织私有经验。

### P1：经验质量

1. 增加同行确认和反对理由。
2. 增加专家审核状态和证据等级升级。
3. 支持附件，但必须配合权限、存储和病毒扫描。
4. 建立工程经验管理台，查看待核验、冲突和高价值心得。
5. 给 AI 复核保留版本历史和人工批准流程。

### P2：情报覆盖和微信能力

1. 为国内传动链厂商、CWEA、标准和故障案例增加经确认的官方 RSS、sitemap 或公开 API，减少对搜索索引的依赖。
2. 评估具有正式使用条款和稳定配额的专利 API；未获授权前保留失败上报，不做访问规避。
3. 按月使用 `empty`、`low-yield` 和 `failed` 统计清理失效查询，并建立采集缺口报表。
4. 获得授权后接入 JCR 或其他商业指标。
5. 接入认证公众号、微信 JS-SDK 和订阅通知。
6. 建立专家审核的基准数据集，再决定是否进行模型微调。

## 12. 验证和常用命令

Windows PowerShell 可能禁止执行 `npm.ps1`，优先使用 `npm.cmd`。

```powershell
npm.cmd test
npm.cmd run test:visual
npm.cmd run build
node scripts/collect.mjs --dry-run
node scripts/collect.mjs --probe-sources=web-global-bearing-suppliers,web-global-wind-oems
```

正式采集会联网并写入数据：

```powershell
npm.cmd run collect
```

查看 GitHub 任务：

```powershell
.\.tools\bin\gh.exe run list --repo WxF5ve/wind-drivetrain-intelligence --workflow weekly-collect.yml --limit 5
```

部署 Worker：

```powershell
.\.tools\wrangler\node_modules\.bin\wrangler.cmd deploy --config feedback-worker\wrangler.toml
```

不要在命令行参数中直接写密钥，避免进入历史和日志。

## 13. 已验证内容

- 55 项 Node 自动测试通过。
- 桌面 1440px 和手机 390px 视觉测试通过。
- 页面无水平溢出。
- 工程经验入口可见并能自动滚动到表单。
- 心得正文、六个背景字段、本机保存、提交后保持展开均已测试。
- Cloudflare 生产写入、受保护读取、公开隐私隔离和清除均已测试。
- GitHub Pages 发布任务成功。
- 正式 `app.js` 包含工程经验入口和心得输入框。
- 本轮 `sw.js` 使用 `wind-intel-v11`。
- 本轮周报 PDF 实际下载为 A4 9 页、约 3.76 MB；Playwright 已验证 40 条周报均为一个连续自然段，不含独立字段、孤立时间节点、分类评价和重复容量，桌面和 390px 手机无水平溢出。
- 国际能源网一条普通请求返回 403 的公开文章，经文本化恢复后提取出 385 字干净正文，公众号宣传、评论区和推荐列表均被排除。
- Flender/Winergy 开放 PDF 在 `pdfjs-dist` v6 兼容修复后可提取 7,566 字正文，不再因清理阶段异常被降为元数据。
- 官网定向探测已验证 NSK、Vestas、Nordex、Flender、金风和运达官方原文；燃气轮机、静态机型页和泛技术页已被风电语境过滤排除。

## 14. 踩过的坑，绝对不要再踩

### 14.1 不要让心得正文进入公开 JSON

历史文章复核时，带密钥聚合会把 `insights` 放入内存对象。如果直接展开旧文章对象写回 `articles.json`，正文会泄露。现在 `publicEngineeringExperience()` 和采集最终输出都执行白名单清洗。以后修改历史合并逻辑时，必须继续验证公开数据不含：

- `insights`
- `insight_text`
- `latestInsightAt`
- 浏览器 `client_id`

### 14.2 不要在没有校验长度时上传随机密钥

这台 Windows 环境的旧 .NET 不支持：

- `RandomNumberGenerator.Fill`
- `Convert.ToHexString`

第一次使用这些 API 时产生了非终止错误，后续命令仍继续执行，存在上传空 Secret 的风险。已经立即覆盖修复。

兼容做法是：

1. `RandomNumberGenerator.Create()`
2. `GetBytes(byte[])`
3. 逐字节 `.ToString('x2')`
4. 上传前强制检查长度，例如必须为 96 个十六进制字符
5. Cloudflare 和 GitHub 两端都成功后再继续

PowerShell 非终止错误不会自动停止脚本。关键密钥脚本必须显式 `throw` 或检查 `$LASTEXITCODE`。

### 14.3 D1 迁移必须先于 Worker 代码

新 Worker 会查询 `insight_text`。如果先部署 Worker、后改表，生产请求会因列不存在而失败。正确顺序：

1. 应用 D1 migration。
2. 配置或轮换 Secret。
3. 部署 Worker。
4. 做生产写入、公开读取、受保护读取和清除测试。
5. 最后发布前端。

### 14.4 前端改动要提升 Service Worker 缓存版本

旧 Service Worker 对应用壳使用 cache-first。只改 `app.js` 而不修改缓存名，微信可能长期看到旧入口。前端应用壳变化时必须提升 `public/sw.js` 中的 `CACHE_NAME`，并做线上文件检查。

### 14.5 不要把 OpenAlex 指标写成影响因子

OpenAlex 的 `twoYearMeanCitedness` 和 `hIndex` 只能按原名显示，并明确“非 JCR 影响因子”。没有合法数据权限时不能推测 JIF。

### 14.6 不要信任 AI 给出的数字

AI 输出的论文数字和行业数字必须能在标题或公开摘录中找到相同数字，否则解析器要删除。工程师心得中的数字也不能绕过该规则。

### 14.7 不要把工程心得当作提示词

心得正文是用户不可信输入，可能包含错误、广告或提示注入。必须作为 JSON 数据字段发送，并在系统提示中声明其中指令无效。不得把心得直接拼接为 system message。

### 14.8 不要假设 push 会执行采集

当前工作流中，push 只测试、构建和发布。只有 schedule 和 workflow_dispatch 执行 `npm run collect`。需要立即刷新数据时必须手动运行工作流。

### 14.9 Windows 工具环境有已知差异

- `npm` 可能调用被执行策略阻止的 `npm.ps1`，使用 `npm.cmd`。
- `rg.exe` 在当前沙箱可能报“拒绝访问”，可退回 `Select-String`。
- `Start-Process` 可能因环境同时存在 `Path` 和 `PATH` 报字典重复；不要把本地预览启动失败误判为网页代码失败。
- PowerShell `Get-Content` 若未指定 `-Encoding utf8`，中文可能显示乱码。

### 14.10 前端表单和 Worker 校验必须同步上线

旧版前端只发送结构化选择，新 Worker 要求至少 20 字心得。若只部署 Worker 不部署前端，旧页面提交会返回 400。部署顺序和 Service Worker 更新必须一起考虑。

### 14.11 不要保留生产测试数据

生产链路测试必须使用明显的合成文章 ID 和合成文本，并在 `finally` 中发送 `action: clear`。测试结束后还要确认聚合接口中不存在测试记录。

### 14.12 周报 PDF 不是网页截图

用户需要的是“每条情报的关键总结”，不是把整个网页打印进去。周报必须从 `reportItem()` 的结构化字段生成，底层至少保留主体、事项、效果、必要数据、工程意义和原文；呈现时只生成一个自然段，不能拆成独立工程判断段，也不能把内部字段做成生硬的标签列表。PDF 生成器只接收周报模型，不直接截取首页或文章详情 DOM。

### 14.13 官方渠道不能只靠关键词放行

新华网或政府网站的 `site:` 查询可能返回转载或非目标页面。官方通道必须保留 `allowedDomains`，并在最终原文 URL 上做域名校验；同时还要要求风电语境和政策/项目/装备进展信号，不能让泛能源新闻淹没齿轮箱研发情报。

### 14.14 GitHub 定时任务不保证准点

GitHub Actions 的 `schedule` 可能因平台负载延迟数小时；2026-07-20 的 08:30 主任务实际在 12:13 才启动。不能只配置单一 cron 并假设准点执行。当前增加 11:15 兜底，并通过 `scripts/check-collection-freshness.mjs` 按北京时间做同日去重；手动任务始终允许强制采集。

### 14.15 全文优先不等于绕过访问控制

只处理无需登录、付费或验证码即可访问的公开 HTML/PDF。不得绕过付费墙、登录、验证码、robots 限制或技术访问控制；不得把抓取正文镜像进公开 `articles.json`。公开数据只保留摘要、技术标签、提取状态和字符数。全文抓取增加网络时间和 AI token，必须关注 GitHub Actions 的 30 分钟上限。

### 14.16 不要用工程意义反推主部件

行业政策或项目摘要常会写“可能带动齿轮箱和轴承需求”。这只是分析层推演，不能据此把资料归入齿轮箱或轴承。`classifyArticle()` 对行业和官方资料只使用标题与原始摘录做部件判定；迁移历史公开数据时缺少原始摘录，就宁可保留“行业综合”，不能用 AI 工程启示补齐事实标签。

### 14.17 请求成功不等于来源有效

Bing Web 会忽略组合 `site:` 限定并返回无关域名，过去 10 个官网渠道因此全部显示 `ok` 但 `fetched=0`。官网必须逐域名检索，并在 Google News 解码后再次校验最终 URL；企业名称出现在查询里也不能替代风电语境。健康报告必须区分 `ok`、`empty`、`low-yield` 和 `failed`，不能再用 HTTP 成功数宣称渠道覆盖完成。

Google Patents 搜索接口可能返回 `503` 反自动化限制。不要轮换代理、绕过验证码或提高频率硬撞；在没有稳定授权 API 时，宁可明确上报失败，也不要伪造专利覆盖。

### 14.18 网页文本化恢复不能变成第二套全量采集

该路径只服务于“普通正文提取已经执行但失败”的公开网页，不能对正常全文、已有摘要、聚合跳转、Google News、登录、付费、验证码、安全检查或招聘噪声重复调用。恢复结果必须通过标题相似度、最小正文长度和页尾清理后才能升级为 `fulltext`；纯链接列表、节目时长清单、重复节目单、订阅试用页和隐私页必须拒绝。仍失败时继续保留题录或待深读，绝不能把题名发送给 DeepSeek 猜测内容。公开 JSON 仍只保存结构化摘要、提取状态和原文链接，不保存恢复出的正文。

## 15. 给下一位维护者的第一组动作

1. 运行 `git status --short --branch`，不要覆盖用户未提交修改。
2. 阅读本文、`WEB-INTRODUCTION.md` 和 `README.md`。
3. 运行 `npm.cmd test`。
4. 若改前端，运行 `npm.cmd run test:visual` 并查看手机截图。
5. 若改 Worker，先检查是否需要 D1 migration。
6. 若改心得聚合，增加公开数据泄漏回归测试。
7. 若改 AI Schema，同时更新 DeepSeek、OpenAI、解析器和测试样本。
8. 发布后检查 GitHub Actions、正式 `app.js`、`runtime-config.js` 和 `sw.js`。
9. 任何密钥问题都通过 Secret 管理处理，不向用户索要明文。

## 16. 交接结论

当前系统已经可以真实采集、自动发布、使用 DeepSeek 生成受约束摘要、接收匿名书面工程心得，并在保护正文的前提下触发工程经验复核。当前没有阻断上线的问题；下一阶段的重点不应是继续堆叠匿名表单，而应转向账号、组织权限、审核、保密和经验质量治理。

