import test from "node:test";
import assert from "node:assert/strict";
import {
  assessReliability,
  cleanText,
  createFallbackSummary,
  deduplicateArticles,
  inferCategory,
  inferTags,
  isDomainRelevant,
  isIndustryRelevant,
  normalizeUrl,
  relevanceScore,
  resolveNewsUrl
} from "./articles.mjs";

const reliabilityConfig = {
  authorityDomains: {
    primary: ["nrel.gov", "energy.gov"],
    industry: ["dnv.com", "skf.com"],
    media: ["qq.com", "sina.com.cn"]
  },
  minimumFeedback: 5
};

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

test("deduplicateArticles merges coverage of the same manufacturer event", () => {
  const articles = [
    {
      title: "Nordex secures three wind turbine orders in the United States totaling 484 MW",
      url: "https://example.com/one",
      queryTopic: "industry",
      publishedAt: "2026-07-01T00:00:00Z"
    },
    {
      title: "Nordex Group secures new US orders totalling 484 MW",
      url: "https://example.org/two",
      queryTopic: "industry",
      publishedAt: "2026-07-01T08:00:00Z"
    }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("deduplicateArticles merges same-capacity coverage with different locations wording", () => {
  const articles = [
    {
      title: "Vestas secures 40 MW wind turbine order for Reken Hulsterholt project in Germany",
      url: "https://example.com/one",
      queryTopic: "industry",
      matchTerms: ["Vestas"],
      publishedAt: "2026-07-01T00:00:00Z"
    },
    {
      title: "Vestas wins 40-MW wind turbine order in North Rhine-Westphalia",
      url: "https://example.org/two",
      queryTopic: "industry",
      matchTerms: ["Vestas"],
      publishedAt: "2026-07-02T00:00:00Z"
    }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("deduplicateArticles keeps distinct tenders with different capacities", () => {
  const articles = [
    { title: "中标：1261.5MW风电项目开标", url: "https://example.com/a", queryTopic: "industry" },
    { title: "中标：643.25MW风电项目公示", url: "https://example.com/b", queryTopic: "industry" }
  ];
  assert.equal(deduplicateArticles(articles).length, 2);
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

test("manufacturer intelligence keeps its own category and context tags", async () => {
  const { toPublicArticle } = await import("./articles.mjs");
  const article = toPublicArticle({
    title: "Vestas announces a new offshore wind order",
    snippet: "Vestas announced a new offshore wind turbine order and manufacturing expansion.",
    source: "Publisher",
    sourceType: "行业资讯",
    sourceChannel: "Google News RSS",
    queryTopic: "industry",
    contextTags: ["整机厂商", "海外"],
    region: "海外",
    url: "https://example.com/vestas",
    linkType: "publisher"
  }, createFallbackSummary({
    title: "Vestas announces a new offshore wind order",
    snippet: "Vestas announced a new offshore wind turbine order and manufacturing expansion.",
    source: "Publisher",
    sourceType: "行业资讯",
    queryTopic: "industry",
    contextTags: ["整机厂商"],
    region: "海外"
  }));
  assert.equal(article.category, "厂商动态");
  assert.equal(article.intelligenceType, "industry");
  assert.equal(article.tags.includes("整机厂商"), true);
});

test("manufacturer intelligence requires exact entities, wind context, and progress", () => {
  assert.equal(isIndustryRelevant({
    title: "Vestas secures a 200 MW order",
    snippet: "New turbine delivery for an offshore wind project.",
    queryTopic: "industry",
    matchTerms: ["Vestas"],
    contextTags: ["整机厂商"]
  }), true);
  assert.equal(isIndustryRelevant({
    title: "NTN satellite transmission milestone",
    snippet: "A 3GPP communications test.",
    queryTopic: "industry",
    matchTerms: ["NTN"],
    contextTags: ["轴承厂商"]
  }), false);
  assert.equal(isIndustryRelevant({
    title: "Timken India secures bearing licenses",
    snippet: "Industrial bearing certification update.",
    queryTopic: "industry",
    matchTerms: ["Timken"],
    contextTags: ["轴承厂商"]
  }), false);
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
  assert.equal(typeof article.reliability.score, "number");
});

test("peer-reviewed DOI records score above unsupported company claims", () => {
  const paper = assessReliability({
    title: "Wind turbine gearbox vibration study",
    snippet: "A detailed abstract describing methods, datasets, validation, limitations, and measured results for a wind turbine drivetrain experiment.".repeat(2),
    source: "Scientific Reports",
    sourceType: "论文",
    sourceChannel: "OpenAlex",
    publishedAt: new Date().toISOString(),
    url: "https://doi.org/10.1000/example",
    linkType: "publisher",
    linkVerified: true,
    evidence: { doi: "https://doi.org/10.1000/example", hasAbstract: true, publicationType: "article" }
  }, reliabilityConfig);
  const claim = assessReliability({
    title: "公司表示主要产品涵盖风电主轴轴承",
    snippet: "",
    source: "腾讯新闻",
    sourceType: "行业资讯",
    sourceChannel: "Google News RSS",
    publishedAt: new Date().toISOString(),
    url: "https://news.qq.com/example",
    linkType: "publisher",
    linkVerified: true
  }, reliabilityConfig);
  assert.ok(paper.score >= 80);
  assert.ok(claim.score < paper.score);
  assert.match(claim.limitations.join(" "), /企业自述/);
});

test("small feedback samples do not change reliability", () => {
  const base = {
    title: "Wind turbine gearbox report",
    snippet: "A sufficiently detailed publisher description with methods and stated limitations for engineering review.",
    source: "Technical publisher",
    sourceType: "行业资讯",
    sourceChannel: "RSS",
    publishedAt: new Date().toISOString(),
    url: "https://example.com/report",
    linkType: "publisher",
    linkVerified: true
  };
  const withoutFeedback = assessReliability(base, reliabilityConfig);
  const withSmallSample = assessReliability({ ...base, feedbackAggregate: { useful: 4 } }, reliabilityConfig);
  assert.equal(withSmallSample.score, withoutFeedback.score);
});
