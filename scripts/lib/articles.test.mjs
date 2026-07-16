import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  createFallbackSummary,
  deduplicateArticles,
  inferCategory,
  inferTags,
  isDomainRelevant,
  normalizeUrl,
  relevanceScore,
  resolveNewsUrl
} from "./articles.mjs";

test("cleanText removes markup and compacts whitespace", () => {
  assert.equal(cleanText("<p>齿轮箱&nbsp; 轴承</p>"), "齿轮箱 轴承");
});

test("normalizeUrl removes tracking parameters", () => {
  assert.equal(
    normalizeUrl("https://example.com/report?id=1&utm_source=mail#chapter"),
    "https://example.com/report?id=1"
  );
});

test("resolveNewsUrl extracts the publisher URL from Bing RSS links", () => {
  const bingUrl =
    "https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fwind-report%3Futm_source%3Dbing";
  assert.equal(resolveNewsUrl(bingUrl), "https://example.com/wind-report");
});

test("fallback summary explains when an index has no usable abstract", () => {
  const summary = createFallbackSummary({
    title: "Wind turbine drivetrain health monitoring",
    snippet: "Abstract.",
    source: "OpenAlex",
    sourceType: "论文",
    region: "海外",
    publishedAt: "2026-07-06T00:00:00Z"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("fallback summary does not present a repeated title as an abstract", () => {
  const summary = createFallbackSummary({
    title: "Wind turbine gearbox reliability update",
    snippet: "Wind turbine gearbox reliability update",
    source: "Publisher",
    sourceType: "行业资讯",
    region: "海外"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("fallback summary rejects a title followed only by a publisher name", () => {
  const summary = createFallbackSummary({
    title: "风电齿轮箱行业更新与轴承趋势",
    snippet: "风电齿轮箱行业更新与轴承趋势 某新闻网站",
    source: "某新闻网站",
    sourceType: "行业资讯",
    region: "国内"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("deduplicateArticles removes matching URLs and titles", () => {
  const articles = [
    { title: "Wind gearbox bearing study", url: "https://example.com/a?utm_source=x" },
    { title: "Another title", url: "https://example.com/a" },
    { title: "Wind gearbox bearing study", url: "https://example.com/b" }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("relevance and category recognize drivetrain terms", () => {
  const article = { title: "Wind turbine gearbox bearing condition monitoring", snippet: "" };
  const score = relevanceScore(article, { "wind turbine": 2, gearbox: 4, bearing: 4 });
  assert.equal(score, 10);
  assert.equal(inferCategory(article), "状态监测");
  assert.equal(isDomainRelevant(article), true);
  assert.equal(
    isDomainRelevant({ title: "Elevator bearing fault diagnosis", snippet: "" }),
    false
  );
  assert.equal(
    isDomainRelevant({ title: "润滑油市场被 AI、储能和风电重塑", snippet: "" }),
    false
  );
  assert.equal(
    isDomainRelevant({ title: "风机齿轮箱润滑状态监测", snippet: "" }),
    true
  );
});

test("WECS is not mislabeled as a white etching crack acronym", () => {
  const tags = inferTags({
    title: "Torsional vibrations in wind energy conversion systems (WECS)",
    snippet: "Wind turbine shaft vibration control"
  });
  assert.equal(tags.includes("白色蚀刻裂纹"), false);
  assert.equal(tags.includes("状态监测"), true);
});

test("public articles expose provenance without carrying source snippets", async () => {
  const { toPublicArticle } = await import("./articles.mjs");
  const article = toPublicArticle(
    {
      title: "Wind turbine gearbox reliability update",
      snippet: "A short source excerpt.",
      source: "Publisher",
      sourceType: "行业资讯",
      region: "海外",
      url: "https://example.com/article?utm_source=rss",
      sourceUrl: "https://example.com/",
      sourceChannel: "Google News RSS",
      linkType: "publisher"
    },
    {
      summary: "可核查摘要",
      keyPoints: ["来源明确"],
      engineeringImpact: "需要结合机型验证",
      category: "齿轮箱",
      tags: ["齿轮箱"]
    }
  );
  assert.equal(article.url, "https://example.com/article");
  assert.equal(article.sourceChannel, "Google News RSS");
  assert.equal(article.linkType, "publisher");
  assert.equal("snippet" in article, false);
});
