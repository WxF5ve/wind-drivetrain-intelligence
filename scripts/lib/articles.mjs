import { createHash } from "node:crypto";

const categoryRules = [
  ["白色蚀刻裂纹", ["白色蚀刻", "white etching", "wec"]],
  ["润滑", ["润滑", "lubric", "oil debris", "磨粒"]],
  ["状态监测", ["状态监测", "故障诊断", "振动", "condition monitoring", "fault diagnosis", "vibration", "scada", "predictive maintenance"]],
  ["轴承", ["轴承", "bearing", "main shaft"]],
  ["齿轮箱", ["齿轮箱", "gearbox", "gear mesh", "行星级", "齿轮"]],
  ["标准政策", ["标准", "政策", "认证", "standard", "regulation", "certification"]]
];

function containsKeyword(text, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  if (/^[a-z0-9 ]+$/.test(normalizedKeyword) && normalizedKeyword.length <= 4) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  }
  return text.includes(normalizedKeyword);
}

export function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeArticleId(url, title = "") {
  return createHash("sha1").update(`${url}|${title}`).digest("hex").slice(0, 12);
}

export function normalizeUrl(value = "") {
  try {
    const url = new URL(value);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
    ].forEach((parameter) => url.searchParams.delete(parameter));
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

export function resolveNewsUrl(value = "") {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("bing.com") && url.searchParams.get("url")) {
      return normalizeUrl(url.searchParams.get("url"));
    }
    return normalizeUrl(value);
  } catch {
    return value;
  }
}

export function relevanceScore(article, keywordWeights) {
  const text = `${article.title} ${article.snippet} ${(article.tags || []).join(" ")}`.toLowerCase();
  return Object.entries(keywordWeights).reduce((score, [keyword, weight]) => {
    return text.includes(keyword.toLowerCase()) ? score + Number(weight) : score;
  }, 0);
}

export function isDomainRelevant(article) {
  const text = `${article.title} ${article.snippet} ${(article.tags || []).join(" ")}`.toLowerCase();
  const windAnchors = ["风电", "风力发电", "风机", "wind turbine", "wind power", "wind energy"];
  const strongDrivetrainAnchors = [
    "齿轮箱",
    "齿轮",
    "轴承",
    "传动链",
    "主轴",
    "gearbox",
    "gear",
    "bearing",
    "drivetrain",
    "main shaft",
    "oil debris",
    "齿轮油",
    "磨粒"
  ];
  const weakDrivetrainAnchors = ["润滑", "lubric"];
  const specificWindAnchors = ["风力发电", "风机", "wind turbine"];
  const hasWindContext = windAnchors.some((keyword) => text.includes(keyword));
  const hasStrongDrivetrainContext = strongDrivetrainAnchors.some((keyword) => containsKeyword(text, keyword));
  const hasSpecificLubricationContext = specificWindAnchors.some((keyword) => text.includes(keyword)) &&
    weakDrivetrainAnchors.some((keyword) => text.includes(keyword));
  return hasWindContext && (hasStrongDrivetrainContext || hasSpecificLubricationContext);
}

export function inferCategory(article) {
  if (article.sourceType === "论文") return "学术论文";
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  const match = categoryRules.find(([, keywords]) =>
    keywords.some((keyword) => containsKeyword(text, keyword))
  );
  return match?.[0] || "行业资讯";
}

export function inferTags(article) {
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  const tags = [];
  for (const [category, keywords] of categoryRules) {
    if (keywords.some((keyword) => containsKeyword(text, keyword))) tags.push(category);
  }
  if (article.region) tags.push(article.region);
  if (article.sourceType) tags.push(article.sourceType);
  return [...new Set(tags)].slice(0, 5);
}

export function deduplicateArticles(articles) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return articles.filter((article) => {
    const normalizedUrl = normalizeUrl(article.url);
    const titleKey = cleanText(article.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (!normalizedUrl || !titleKey || seenUrls.has(normalizedUrl) || seenTitles.has(titleKey)) {
      return false;
    }
    seenUrls.add(normalizedUrl);
    seenTitles.add(titleKey);
    article.url = normalizedUrl;
    return true;
  });
}

export function createFallbackSummary(article) {
  const snippet = cleanText(article.snippet).replace(/^abstract[\s.:;-]*/i, "").trim();
  const title = cleanText(article.title);
  const comparableSnippet = snippet.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const comparableTitle = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const titleRemainder = snippet.startsWith(title)
    ? snippet.slice(title.length).replace(/^[,，:：\s-]+/, "")
    : "";
  const hasDistinctExcerpt = snippet.length >= 40 &&
    comparableSnippet !== comparableTitle &&
    !(titleRemainder && titleRemainder.length < 40);
  const firstSentence = snippet.split(/(?<=[。！？.!?])\s*/)[0] || snippet;
  const compact = firstSentence.slice(0, 150);
  return {
    summary: hasDistinctExcerpt && compact.length >= 24
      ? compact
      : `原始索引未提供可用摘要。资料主题为“${title.slice(0, 80)}”，请打开原文核对研究方法、数据和结论边界。`,
    keyPoints: [
      `来源：${article.source || "未知来源"}`,
      `主题：${inferCategory(article)}`,
      article.publishedAt ? `发布时间：${article.publishedAt.slice(0, 10)}` : "发布时间待确认"
    ],
    engineeringImpact: "建议结合具体机型、载荷谱和失效样本评估其工程适用性。",
    category: inferCategory(article),
    tags: inferTags(article)
  };
}

export function toPublicArticle(article, summaryData) {
  return {
    id: article.id || makeArticleId(article.url, article.title),
    title: cleanText(article.title),
    source: cleanText(article.source || "未知来源"),
    sourceType: article.sourceType || "行业资讯",
    region: article.region || "海外",
    language: article.language || "en",
    publishedAt: article.publishedAt || new Date().toISOString(),
    collectedAt: article.collectedAt || new Date().toISOString(),
    url: normalizeUrl(article.url),
    sourceUrl: normalizeUrl(article.sourceUrl || ""),
    sourceChannel: cleanText(article.sourceChannel || "网络公开来源"),
    linkType: article.linkType === "aggregator" ? "aggregator" : "publisher",
    category: summaryData.category || inferCategory(article),
    tags: summaryData.tags?.length ? summaryData.tags : inferTags(article),
    summary: cleanText(summaryData.summary),
    keyPoints: (summaryData.keyPoints || []).map(cleanText).filter(Boolean).slice(0, 4),
    engineeringImpact: cleanText(summaryData.engineeringImpact),
    readingMinutes: Math.max(2, Math.min(12, Math.round(cleanText(article.snippet).length / 240) + 2)),
    relevanceScore: Number(article.relevanceScore || 0)
  };
}
