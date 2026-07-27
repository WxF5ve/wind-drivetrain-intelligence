import test from "node:test";
import assert from "node:assert/strict";

import { extractHtmlContent } from "./content.mjs";

test("HTML content extraction prefers article paragraphs over navigation and footer text", () => {
  const paragraph = "风电齿轮箱试验验证了行星架强度与齿轮箱振动之间的关系，并给出了可核验的载荷数据。";
  const html = `
    <html><head><title>传动链研究</title><meta name="description" content="公开摘要说明风电传动链试验进展与研究结论。"></head>
    <body><nav>首页 产品 联系方式</nav><article><h2>研究结果</h2><p>${paragraph}</p><p>${paragraph}第二组试验覆盖不同扭矩工况。</p><p>${paragraph}结论部分说明了工程边界。</p></article><footer>版权声明</footer></body></html>
  `;
  const result = extractHtmlContent(html);
  assert.equal(result.title, "传动链研究");
  assert.match(result.fullText, /行星架强度/);
  assert.doesNotMatch(result.fullText, /联系方式/);
});
