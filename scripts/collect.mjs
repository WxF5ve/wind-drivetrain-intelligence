import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { GoogleDecoder } from "google-news-url-decoder";
import { parse } from "node-html-parser";
import {
  cleanText,
  createFallbackSummary,
  deduplicateArticles,
  isDomainRelevant,
  makeArticleId,
  relevanceScore,
  resolveNewsUrl,
  toPublicArticle
} from "./lib/articles.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const configPath = new URL("../config/sources.json", import.meta.url);
const outputPath = new URL("../public/data/articles.json", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const now = new Date();
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true
});
const googleDecoder = new GoogleDecoder();

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

function gdeltDate(value) {
  if (!value || !/^\d{8}T\d{6}Z$/.test(value)) return new Date().toISOString();
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
}

function abstractFromInvertedIndex(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter(Boolean).join(" ");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "wind-drivetrain-intelligence/0.1 (weekly engineering research digest)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "wind-drivetrain-intelligence/0.1 (weekly engineering research digest)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPublisherMetadata(url) {
  if (!/^https?:\/\//i.test(url) || new URL(url).hostname === "news.google.com") return {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; WindDrivetrainResearchBot/1.0; public metadata only)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return {};
    const html = await response.text();
    const root = parse(html.slice(0, 1500000));
    const title = cleanText(
      root.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      root.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ||
      root.querySelector("title")?.text ||
      ""
    );
    const selectors = [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]'
    ];
    let description = "";
    for (const selector of selectors) {
      const candidate = cleanText(root.querySelector(selector)?.getAttribute("content") || "");
      if (candidate.length >= 40) {
        description = candidate.slice(0, 1800);
        break;
      }
    }
    return { title, description, finalUrl: response.url };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function collectGdelt(source, lookbackDays) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `${source.query} sourcelang:${source.language}`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "50");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", `${lookbackDays}d`);

  const data = await fetchJson(url);
  return (data.articles || []).map((item) => ({
    id: makeArticleId(item.url, item.title),
    title: cleanText(item.title),
    snippet: cleanText(item.title),
    source: item.domain || source.label,
    sourceType: "行业资讯",
    region: source.region,
    language: source.language === "Chinese" ? "zh" : "en",
    publishedAt: gdeltDate(item.seendate),
    collectedAt: now.toISOString(),
    url: item.url,
    imageUrl: item.socialimage || "",
    sourceChannel: "GDELT",
    linkType: "publisher",
    linkVerified: false,
    evidence: { hasPublisherDescription: false }
  }));
}

function xmlText(value, fallback = "") {
  if (typeof value === "string") return cleanText(value);
  return cleanText(value?.["#text"] || fallback);
}

function googleNewsLocale(source) {
  if (source.language === "Chinese") {
    return { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" };
  }
  return { hl: "en-US", gl: "US", ceid: "US:en" };
}

function removeSourceSuffix(title, sourceName) {
  const cleanTitle = cleanText(title);
  if (!sourceName) return cleanTitle;
  const suffix = ` - ${sourceName}`;
  return cleanTitle.endsWith(suffix) ? cleanTitle.slice(0, -suffix.length).trim() : cleanTitle;
}

function titleTokens(value) {
  const normalized = cleanText(value).toLowerCase();
  const tokens = new Set(normalized.match(/[a-z0-9]{4,}/g) || []);
  for (const sequence of normalized.match(/[\p{Script=Han}]{2,}/gu) || []) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.add(sequence.slice(index, index + 2));
    }
  }
  return tokens;
}

function titleSimilarity(left, right) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function usefulPublisherDescription(description, title) {
  const cleanDescription = cleanText(description);
  const cleanTitle = cleanText(title);
  if (!cleanDescription) return "";
  if (cleanDescription.startsWith(cleanTitle)) {
    const remainder = cleanDescription.slice(cleanTitle.length).replace(/^[,，:：\s-]+/, "");
    if (remainder.length < 80 && (remainder.match(/[,，]/g) || []).length >= 3) return "";
  }
  return cleanDescription;
}

async function collectGoogleNews(source, lookbackDays) {
  const locale = googleNewsLocale(source);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${source.googleQuery || source.query} when:${lookbackDays}d`);
  url.searchParams.set("hl", locale.hl);
  url.searchParams.set("gl", locale.gl);
  url.searchParams.set("ceid", locale.ceid);

  const xml = await fetchText(url);
  const parsed = xmlParser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const cutoff = now.getTime() - lookbackDays * 86400000;
  const recentItems = items
    .map((item) => ({ item, publishedAt: new Date(item.pubDate || now) }))
    .filter(({ publishedAt }) => !Number.isNaN(publishedAt.getTime()) && publishedAt.getTime() >= cutoff)
    .filter(({ item }) => {
      const sourceName = xmlText(item.source, source.label);
      return isDomainRelevant({
        title: removeSourceSuffix(item.title, sourceName),
        snippet: cleanText(item.description || "")
      });
    })
    .slice(0, Number(source.maxRecords || 30));

  const decodedLinks = [];
  for (const { item } of recentItems) {
    try {
      decodedLinks.push(await googleDecoder.decode(item.link));
    } catch (error) {
      decodedLinks.push({ status: false, message: error.message });
    }
    await delay(120);
  }

  const articles = recentItems.map(({ item, publishedAt }, index) => {
    const sourceName = xmlText(item.source, source.label);
    const decoded = decodedLinks[index];
    const hasPublisherLink = decoded?.status && /^https?:\/\//i.test(decoded.decoded_url || "");
    const articleUrl = hasPublisherLink ? decoded.decoded_url : item.link;
    const sourceUrl = typeof item.source === "object" ? item.source?.["@_url"] || "" : "";
    const title = removeSourceSuffix(item.title, sourceName);
    return {
      id: makeArticleId(articleUrl, title),
      title,
      snippet: cleanText(item.description || title),
      source: sourceName,
      sourceType: "行业资讯",
      region: source.region,
      language: source.language === "Chinese" ? "zh" : "en",
      publishedAt: publishedAt.toISOString(),
      collectedAt: now.toISOString(),
      url: articleUrl,
      sourceUrl,
      imageUrl: "",
      sourceChannel: "Google News RSS",
      linkType: hasPublisherLink ? "publisher" : "aggregator",
      linkVerified: false,
      evidence: { hasPublisherDescription: false }
    };
  });

  return Promise.all(articles.map(async (article) => {
    if (article.linkType !== "publisher") return article;
    const metadata = await fetchPublisherMetadata(article.url);
    if (metadata.title && titleSimilarity(article.title, metadata.title) < 0.18) {
      console.warn(`  原文标题校验未通过，保留聚合跳转: ${article.title}`);
      const originalItem = recentItems.find(({ item }) => removeSourceSuffix(item.title, article.source) === article.title)?.item;
      return {
        ...article,
        url: originalItem?.link || article.url,
        snippet: cleanText(originalItem?.description || article.title),
        linkType: "aggregator",
        linkVerified: false,
        evidence: { hasPublisherDescription: false }
      };
    }
    const description = usefulPublisherDescription(metadata.description, article.title);
    return {
      ...article,
      url: metadata.finalUrl || article.url,
      snippet: description || article.snippet,
      linkVerified: Boolean(metadata.finalUrl),
      evidence: { hasPublisherDescription: Boolean(description) }
    };
  }));
}

async function collectBingNews(source, lookbackDays) {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", source.query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", source.language === "Chinese" ? "zh-Hans" : "en-US");

  const xml = await fetchText(url);
  const parsed = xmlParser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const cutoff = now.getTime() - lookbackDays * 86400000;

  return items
    .map((item) => {
      const publishedAt = new Date(item.pubDate || now);
      const originalUrl = resolveNewsUrl(item.link);
      return {
        id: makeArticleId(originalUrl, item.title),
        title: cleanText(item.title),
        snippet: cleanText(item.description),
        source: cleanText(item.Source || source.label),
        sourceType: "行业资讯",
        region: source.region,
        language: source.language === "Chinese" ? "zh" : "en",
        publishedAt: publishedAt.toISOString(),
        collectedAt: now.toISOString(),
        url: originalUrl,
        imageUrl: "",
        sourceChannel: "Bing News RSS",
        linkType: "publisher",
        linkVerified: false,
        evidence: { hasPublisherDescription: cleanText(item.description).length >= 70 }
      };
    })
    .filter((article) => new Date(article.publishedAt).getTime() >= cutoff);
}

async function collectNews(source, lookbackDays) {
  const attempts = [
    ["Google News RSS", collectGoogleNews],
    ["Bing News RSS", collectBingNews]
  ];
  if (process.env.ENABLE_GDELT === "1") attempts.push(["GDELT", collectGdelt]);
  const errors = [];
  for (const [provider, collector] of attempts) {
    try {
      const articles = await collector(source, lookbackDays);
      if (articles.length) return articles;
      errors.push(`${provider}: 最近 ${lookbackDays} 天无结果`);
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }
  console.warn(`  ${source.label} 未获得新闻结果（${errors.join("；")}）`);
  return [];
}

async function collectOpenAlex(source, lookbackDays) {
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - lookbackDays);

  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", source.query);
  url.searchParams.set("filter", `from_publication_date:${fromDate.toISOString().slice(0, 10)}`);
  url.searchParams.set("sort", "publication_date:desc");
  url.searchParams.set("per-page", "30");

  const data = await fetchJson(url);
  return (data.results || [])
    .map((item) => {
      const location = item.primary_location || {};
      const sourceName = location.source?.display_name || "OpenAlex";
      const urlValue = item.doi || location.landing_page_url || item.id;
      const authors = (item.authorships || [])
        .slice(0, 4)
        .map((authorship) => authorship.author?.display_name)
        .filter(Boolean)
        .join(", ");
      const abstract = abstractFromInvertedIndex(item.abstract_inverted_index);
      return {
        id: makeArticleId(urlValue, item.title),
        title: cleanText(item.title),
        snippet: cleanText([abstract, authors ? `Authors: ${authors}` : ""].filter(Boolean).join(" ")),
        source: sourceName,
        sourceType: "论文",
        region: source.region,
        language: item.language || "en",
        publishedAt: `${item.publication_date || now.toISOString().slice(0, 10)}T00:00:00Z`,
        collectedAt: now.toISOString(),
        url: urlValue,
        imageUrl: "",
        sourceChannel: "OpenAlex",
        linkType: "publisher",
        linkVerified: Boolean(item.doi),
        evidence: {
          hasAbstract: Boolean(abstract),
          doi: item.doi || "",
          authorsCount: (item.authorships || []).length,
          citedByCount: Number(item.cited_by_count || 0),
          publicationType: item.type === "preprint" ? "preprint" : item.type || "article"
        }
      };
    })
    .filter((item) => item.title && item.url);
}

function extractOutputText(responseData) {
  if (typeof responseData.output_text === "string") return responseData.output_text;
  for (const output of responseData.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

async function summarizeWithOpenAI(articles) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !articles.length) return new Map();

  const model = process.env.OPENAI_MODEL || "gpt-5.6-mini";
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            summary: { type: "string" },
            keyPoints: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 3
            },
            engineeringImpact: { type: "string" },
            category: {
              type: "string",
              enum: ["齿轮箱", "轴承", "润滑", "状态监测", "白色蚀刻裂纹", "标准政策", "学术论文", "行业资讯"]
            },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5
            }
          },
          required: ["id", "summary", "keyPoints", "engineeringImpact", "category", "tags"]
        }
      }
    },
    required: ["articles"]
  };

  const inputArticles = articles.map((article) => ({
    id: article.id,
    title: article.title,
    source: article.source,
    sourceType: article.sourceType,
    publishedAt: article.publishedAt,
    snippet: cleanText(article.snippet).slice(0, 1800)
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: [
        "你是风电齿轮箱与轴承研发情报分析助手。",
        "仅依据给定标题和原始摘录总结，不得补造试验数据、结论或来源。",
        "所有输出使用简洁中文，保留必要的英文缩写、标准号、材料名和故障机理术语。",
        "summary 用 60-110 个汉字说明研究或资讯做了什么以及结论边界。",
        "keyPoints 给出三条可核查的信息；engineeringImpact 说明对设计、验证、运维或供应链的潜在意义，并明确需要进一步验证之处。",
        "论文统一归入“学术论文”，其余按最相关技术主题分类。"
      ].join("\n"),
      input: JSON.stringify(inputArticles),
      text: {
        format: {
          type: "json_schema",
          name: "wind_drivetrain_weekly_summary",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI summary failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = extractOutputText(data);
  if (!text) throw new Error("OpenAI summary returned no output text");
  const parsed = JSON.parse(text);
  return new Map((parsed.articles || []).map((item) => [item.id, item]));
}

async function summarizeInBatches(articles, batchSize = 8) {
  const summaries = new Map();
  for (let index = 0; index < articles.length; index += batchSize) {
    const batch = articles.slice(index, index + batchSize);
    const batchSummaries = await summarizeWithOpenAI(batch);
    batchSummaries.forEach((value, key) => summaries.set(key, value));
  }
  return summaries;
}

function buildWeeklyBrief(articles, lookbackDays, usedAi, archiveCount) {
  const counts = new Map();
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) || 0) + 1);
  }
  const leadingCategories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
  const domesticCount = articles.filter((article) => article.region === "国内").length;
  const paperCount = articles.filter((article) => article.sourceType === "论文").length;

  return {
    title: leadingCategories.length
      ? `本周聚焦：${leadingCategories.join("、")}`
      : "本周暂无新增高相关资料",
    summary: articles.length
      ? `过去 ${lookbackDays} 天共筛选 ${articles.length} 条高相关资料，其中国内 ${domesticCount} 条、论文 ${paperCount} 篇。资料库累计保留 ${archiveCount} 条可追溯记录，工程结论仍需回到原文核对适用机型与载荷边界。`
      : `过去 ${lookbackDays} 天未发现满足相关性阈值的新资料；资料库仍保留 ${archiveCount} 条历史记录供检索。`,
    signals: articles.slice(0, 3).map((article) => article.title),
    metrics: {
      total: articles.length,
      domestic: domesticCount,
      overseas: articles.length - domesticCount,
      papers: paperCount
    },
    summaryMode: usedAi ? "AI 结构化摘要" : articles.length ? "原文索引摘要" : "本周无新增"
  };
}

function sourceIdentity(article) {
  try {
    return new URL(article.sourceUrl || article.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return cleanText(article.source).toLowerCase();
  }
}

function findCorroboratingSources(article, pool) {
  const identity = sourceIdentity(article);
  const sources = new Set();
  for (const candidate of pool) {
    const candidateIdentity = sourceIdentity(candidate);
    if (!candidateIdentity || candidateIdentity === identity) continue;
    if (titleSimilarity(article.title, candidate.title) >= 0.55) {
      sources.add(cleanText(candidate.source || candidateIdentity));
    }
  }
  return [...sources].slice(0, 6);
}

function feedbackArticleMap(payload) {
  if (Array.isArray(payload?.articles)) {
    return new Map(payload.articles.map((item) => [item.articleId || item.id, item]));
  }
  return new Map(Object.entries(payload?.articles || payload || {}));
}

async function loadFeedbackAggregates() {
  const localPath = new URL("../public/data/feedback-aggregates.json", import.meta.url);
  let payload = await readJson(localPath, { generatedAt: null, articles: {} });
  const endpoint = process.env.FEEDBACK_AGGREGATE_URL;
  if (endpoint) {
    try {
      payload = await fetchJson(endpoint);
      console.log("已载入集中用户反馈汇总。");
    } catch (error) {
      console.warn(`集中反馈暂时不可用，继续使用本地汇总: ${error.message}`);
    }
  }
  return { payload, map: feedbackArticleMap(payload) };
}

async function main() {
  const config = await readJson(configPath, {});
  const previous = await readJson(outputPath, { articles: [] });
  const lookbackDays = Number(process.env.COLLECT_LOOKBACK_DAYS || config.lookbackDays || 8);
  const maxArticles = Number(process.env.COLLECT_MAX_ARTICLES || config.maxArticles || 36);
  const historyMaxArticles = Number(process.env.HISTORY_MAX_ARTICLES || config.historyMaxArticles || 160);
  const historyRetentionDays = Number(process.env.HISTORY_RETENTION_DAYS || config.historyRetentionDays || 365);
  const keywordWeights = config.relevanceKeywords || {};
  const reliabilityConfig = config.reliability || {};
  const feedbackAggregates = await loadFeedbackAggregates();

  const newsJobs = (config.newsQueries || []).map((source) => ({
      id: source.id,
      label: source.label,
      type: "news",
      run: () => collectNews(source, lookbackDays)
    }));
  const researchJobs = (config.researchQueries || []).map((source) => ({
      id: source.id,
      label: source.label,
      type: "research",
      run: () => collectOpenAlex(source, lookbackDays)
    }));
  const jobs = [...newsJobs, ...researchJobs];

  console.log(`开始采集 ${jobs.length} 个数据通道，回看 ${lookbackDays} 天...`);
  const newsResults = [];
  for (const job of newsJobs) {
    try {
      newsResults.push({ status: "fulfilled", value: await job.run() });
    } catch (reason) {
      newsResults.push({ status: "rejected", reason });
    }
    await delay(1800);
  }
  const researchResults = await Promise.allSettled(researchJobs.map((job) => job.run()));
  const results = [...newsResults, ...researchResults];
  const rawArticles = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`✓ ${jobs[index].label}: ${result.value.length} 条`);
      rawArticles.push(...result.value);
    } else {
      console.warn(`× ${jobs[index].label}: ${result.reason?.message || result.reason}`);
    }
  });

  const relevantRawArticles = rawArticles.filter(isDomainRelevant);
  const candidates = deduplicateArticles(relevantRawArticles)
    .map((article) => ({
      ...article,
      relevanceScore: relevanceScore(article, keywordWeights),
      corroboratingSources: findCorroboratingSources(article, relevantRawArticles),
      feedbackAggregate: feedbackAggregates.map.get(article.id) || {},
      reliabilityConfig
    }))
    .filter((article) => article.relevanceScore >= Number(config.minimumRelevanceScore || 3))
    .sort((a, b) => {
      const dateDifference = new Date(b.publishedAt) - new Date(a.publishedAt);
      return dateDifference || b.relevanceScore - a.relevanceScore;
    })
    .slice(0, maxArticles);

  const previousIsLive = process.env.COLLECT_RESET_HISTORY !== "1" &&
    previous.collectionStatus?.dataMode === "live" &&
    !previous.collectionStatus?.demo;
  const previousArticles = previousIsLive ? previous.articles || [] : [];
  const previousByUrl = new Map(previousArticles.map((article) => [article.url, article]));
  const needsSummary = candidates.filter((article) => !previousByUrl.has(article.url));
  let aiSummaries = new Map();

  if (process.env.OPENAI_API_KEY && needsSummary.length) {
    try {
      console.log(`使用 ${process.env.OPENAI_MODEL || "gpt-5.6-mini"} 总结 ${needsSummary.length} 条新增资料...`);
      aiSummaries = await summarizeInBatches(needsSummary);
    } catch (error) {
      console.warn(error.message);
      console.warn("本次改用规则摘要，采集结果仍会保存。");
    }
  } else {
    console.log("未配置 OPENAI_API_KEY，本次使用规则摘要。");
  }

  const currentArticles = candidates.map((article) => {
    const existing = previousByUrl.get(article.url);
    const summaryData = existing
      ? {
          summary: existing.summary,
          keyPoints: existing.keyPoints,
          engineeringImpact: existing.engineeringImpact,
          category: existing.category,
          tags: existing.tags
        }
      : aiSummaries.get(article.id) || createFallbackSummary(article);
    return toPublicArticle(
      article,
      summaryData
    );
  });

  const historyCutoff = now.getTime() - historyRetentionDays * 86400000;
  const articles = deduplicateArticles([...currentArticles, ...previousArticles])
    .filter((article) => new Date(article.publishedAt).getTime() >= historyCutoff)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, historyMaxArticles);

  const channelResults = results.map((result, index) => ({
    id: jobs[index].id,
    label: jobs[index].label,
    type: jobs[index].type,
    status: result.status === "fulfilled" ? "ok" : "failed",
    fetched: result.status === "fulfilled" ? result.value.length : 0,
    error: result.status === "rejected" ? cleanText(result.reason?.message || result.reason).slice(0, 180) : ""
  }));

  const payload = {
    app: "风传智研",
    generatedAt: now.toISOString(),
    period: {
      from: new Date(now.getTime() - lookbackDays * 86400000).toISOString(),
      to: now.toISOString()
    },
    collectionStatus: {
      dataMode: "live",
      demo: false,
      channels: jobs.length,
      succeeded: results.filter((result) => result.status === "fulfilled").length,
      failed: results.filter((result) => result.status === "rejected").length,
      rawFetched: rawArticles.length,
      currentCount: currentArticles.length,
      archiveCount: articles.length,
      sources: channelResults
    },
    reliabilityMethod: {
      version: "1.0",
      minimumFeedback: Number(reliabilityConfig.minimumFeedback || 5),
      note: "可靠度评估来源质量、证据完整度和可追溯性，不等同于事实已经证实。"
    },
    feedbackStatus: {
      aggregateGeneratedAt: feedbackAggregates.payload?.generatedAt || null,
      centralized: Boolean(process.env.FEEDBACK_AGGREGATE_URL)
    },
    weeklyBrief: buildWeeklyBrief(currentArticles, lookbackDays, aiSummaries.size > 0, articles.length),
    articles
  };

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`已写入本周 ${currentArticles.length} 条、资料库 ${articles.length} 条: ${fileURLToPath(outputPath).replace(projectRoot, "")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
