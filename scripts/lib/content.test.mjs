import test from "node:test";
import assert from "node:assert/strict";

import { extractHtmlContent } from "./content.mjs";

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
