import test from "node:test";
import assert from "node:assert/strict";

import { extractHtmlContent, extractReaderContent } from "./content.mjs";

test("HTML content extraction prefers article paragraphs over navigation and footer text", () => {
  const paragraph = "风电齿轮箱试验验证了行星架强度与齿轮箱振动之间的关系，并给出了可核验的载荷数据。";
  const html = `
    <html><head><title>传动链研究</title><meta name="description" content="公开摘要说明风电传动链试验进展与研究结论。"><meta name="citation_publication_date" content="2026-07-20"></head>
    <body><nav>首页 产品 联系方式</nav><article><h2>研究结果</h2><p>${paragraph}</p><p>${paragraph}第二组试验覆盖不同扭矩工况。</p><p>${paragraph}结论部分说明了工程边界。</p></article><footer>版权声明</footer></body></html>
  `;
  const result = extractHtmlContent(html);
  assert.equal(result.title, "传动链研究");
  assert.equal(result.publishedAt, "2026-07-20");
  assert.match(result.fullText, /行星架强度/);
  assert.doesNotMatch(result.fullText, /联系方式/);
});

test("Google Patents metadata and public abstract are extracted", () => {
  const html = `
    <html><head>
      <meta name="DC.title" content="Wind turbine gearbox bearing arrangement">
      <meta name="DC.description" content="A public patent abstract describing a wind turbine gearbox bearing arrangement and its load path.">
      <meta name="DC.date" content="2026-07-01">
    </head><body>
      <section itemprop="abstract"><h2>Abstract</h2>
        <p>The disclosed bearing arrangement supports a wind turbine gearbox planet carrier under combined radial and axial loads.</p>
        <p>The arrangement changes the load path and describes its application boundary for a multi-megawatt drivetrain.</p>
        <p>The patent text provides enough public detail for an engineering reader to understand the proposed configuration.</p>
      </section>
    </body></html>
  `;
  const result = extractHtmlContent(html);
  assert.equal(result.title, "Wind turbine gearbox bearing arrangement");
  assert.equal(result.publishedAt, "2026-07-01");
  assert.match(result.description, /public patent abstract/);
  assert.match(result.fullText, /planet carrier/);
});

test("public reader fallback keeps article text and removes recommendations", () => {
  const markdown = `
Title: 大唐海上风电项目关键施工节点

Markdown Content:
# 网站导航
[风电新闻](https://example.com/news) [项目](https://example.com/project)

# 大唐海上风电项目关键施工节点

来源：公开发布方
时间：2026-07-27

项目完成两回路定向钻管道回拖，长距离陆对海穿越施工按期完工，形成了可核查的阶段性成果。

海域点位水深26米，施工团队采用十三接一回拖工艺，解决了复杂水文和特殊地层下的安装难题。

### 特别声明
本文仅供参考。

### 相关推荐
另一个无关风电项目。
  `;
  const result = extractReaderContent(markdown, "大唐海上风电项目关键施工节点");
  assert.equal(result.publishedAt, "2026-07-27");
  assert.match(result.fullText, /十三接一回拖/);
  assert.doesNotMatch(result.fullText, /相关推荐|无关风电项目|网站导航/);
});

test("public reader fallback stops before publisher promotion and comment feeds", () => {
  const markdown = `
Title: 中核汇能与金风科技会谈

Markdown Content:
# 中核汇能与金风科技会谈

双方围绕新能源重点项目、技术创新、存量运维提质和海内外市场开发开展交流，并计划建立常态化沟通机制。

金风科技介绍了全产业链发展情况，中核汇能介绍了整体业务布局及十五五发展规划，双方明确将发挥产业资源优势开展合作。

风电资讯一手掌握，关注风电头条微信公众号
看资讯 / 读政策 / 找项目 / 推品牌
如因作品内容、版权和其它问题需要同本网联系，请致电400-8256-198。
[共 0 条 [查看全部]](https://example.com/comments)相关评论
##### 100万千瓦新能源项目可研及勘察设计中标
  `;
  const result = extractReaderContent(markdown, "中核汇能与金风科技会谈");
  assert.match(result.fullText, /常态化沟通机制/);
  assert.doesNotMatch(result.fullText, /微信公众号|找项目|相关评论|100万千瓦/);
});
