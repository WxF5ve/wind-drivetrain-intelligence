import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { GoogleDecoder } from "google-news-url-decoder";
import {
  classifyArticle,
  cleanText,
  createFallbackSummary,
  deduplicateArticles,
  isDomainRelevant,
  isOfficialRelevant,
  isIndustryRelevant,
  makeArticleId,
  publicEngineeringExperience,
  recalibratePublishedArticle,
  relevanceScore,
  resolveNewsUrl,
  toPublicArticle
} from "./lib/articles.mjs";
import {
  extractHtmlContent,
  extractPdfText,
  extractReaderContent,
  MIN_FULLTEXT_CHARACTERS,
  readerContentIsRestricted,
  readerSummaryIndicatesNonArticle
} from "./lib/content.mjs";
import {
  experienceNeedsAiReview,
  feedbackNeedsAiReview,
  resolveAiProvider,
  summarizeInBatches
} from "./lib/ai.mjs";
import {
  buildDomainNewsQueries,
  classifyChannelResult,
  isAllowedPublisherUrl
} from "./lib/sources.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const configPath = new URL("../config/sources.json", import.meta.url);
const outputPath = new URL("../public/data/articles.json", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const probeArgument = process.argv.find((argument) => argument.startsWith("--probe-sources="));
const probeSourceIds = new Set(
  String(probeArgument?.split("=").slice(1).join("=") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const forceAiSummary = process.argv.includes("--resummarize") ||
  /^(?:1|true|yes)$/i.test(String(process.env.AI_RESUMMARIZE_EXISTING || ""));
const now = new Date();
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true
});
const googleDecoder = new GoogleDecoder();
const readerFallbackBaseUrl = String(process.env.READER_FALLBACK_BASE_URL || "https://r.jina.ai/").replace(/\/+$/, "");

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

async function fetchJson(url, retries = 2, extraHeaders = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "wind-drivetrain-intelligence/0.1 (weekly engineering research digest)",
          ...extraHeaders
        },
        signal: controller.signal
      });
      if (response.ok) return response.json();
      if (attempt === retries || (response.status !== 429 && response.status < 500)) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
      await delay(Math.max(retryAfter, 2500 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("JSON request failed after retries");
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
  if (!/^https?:\/\//i.test(url) || new URL(url).hostname === "news.google.com") {
    return { contentFailureReason: "没有可直接访问的发布方地址" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf",
        "User-Agent": "Mozilla/5.0 (compatible; MechanicalCenterDrivetrainBot/1.0; public engineering intelligence)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) return { contentFailureReason: `发布方返回 HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 15_000_000) return { contentFailureReason: "公开文件超过采集大小限制" };
    if (contentType.includes("application/pdf") || /\.pdf(?:$|\?)/i.test(response.url)) {
      const fullText = await extractPdfText(await response.arrayBuffer());
      return {
        title: "",
        description: "",
        fullText,
        finalUrl: response.url,
        contentAccess: fullText.length >= MIN_FULLTEXT_CHARACTERS ? "fulltext" : "metadata",
        contentSource: fullText.length >= MIN_FULLTEXT_CHARACTERS ? "open-access-pdf" : "metadata",
        extractedCharacters: fullText.length,
        contentFailureReason: fullText.length >= MIN_FULLTEXT_CHARACTERS ? "" : "PDF 没有足够可提取文本"
      };
    }
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return { contentFailureReason: "发布方返回了暂不支持的内容格式" };
    }
    const content = extractHtmlContent(await response.text());
    const contentAccess = content.fullText.length >= MIN_FULLTEXT_CHARACTERS
      ? "fulltext"
      : content.description.length >= 40
        ? "abstract"
        : "metadata";
    return {
      ...content,
      finalUrl: response.url,
      contentAccess,
      contentSource: contentAccess === "fulltext" ? "publisher-html" : contentAccess === "abstract" ? "publisher-description" : "metadata",
      extractedCharacters: content.fullText.length,
      contentFailureReason: contentAccess === "fulltext" ? "" : "公开页面没有足够正文"
    };
  } catch (error) {
    return {
      contentFailureReason: error?.name === "AbortError" ? "公开页面请求超时" : "公开页面读取失败"
    };
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
    contentAccess: "metadata",
    evidence: { hasPublisherDescription: false },
    ...sourceContext(source)
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

function sourceContext(source) {
  return {
    queryTopic: source.topic === "industry" || source.topic === "official" ? source.topic : "technical",
    matchTerms: Array.isArray(source.matchTerms) ? source.matchTerms : [],
    contextTags: Array.isArray(source.contextTags) ? source.contextTags : [],
    allowedDomains: Array.isArray(source.allowedDomains) ? source.allowedDomains : [],
    directSource: Boolean(source.directSource),
    ...(source.sourceType ? { sourceType: source.sourceType } : {})
  };
}

async function fetchReaderContent(url, expectedTitle) {
  if (!readerFallbackBaseUrl || !/^https?:\/\//i.test(url) || /\.(?:pdf|docx?|xlsx?)(?:$|\?)/i.test(url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${readerFallbackBaseUrl}/${url}`, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "MechanicalCenterDrivetrainBot/1.0 (public engineering intelligence)"
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const markdown = await response.text();
    if (readerContentIsRestricted(markdown)) return null;
    const content = extractReaderContent(markdown, expectedTitle);
    if (content.fullText.length < MIN_FULLTEXT_CHARACTERS) return null;
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isCandidateRelevant(article) {
  return isDomainRelevant(article) || isIndustryRelevant(article) || isOfficialRelevant(article);
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
      return isCandidateRelevant({
        title: removeSourceSuffix(item.title, sourceName),
        snippet: cleanText(item.description || ""),
        ...sourceContext(source)
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
      contentAccess: "metadata",
      evidence: { hasPublisherDescription: false },
      ...sourceContext(source)
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
        contentAccess: "metadata",
        contentFailureReason: "原文标题与聚合题录不一致",
        contentAttempts: 1,
        contentFetched: true,
        evidence: { hasPublisherDescription: false }
      };
    }
    const description = usefulPublisherDescription(metadata.description, article.title);
    return {
      ...article,
      url: metadata.finalUrl || article.url,
      snippet: metadata.fullText || description || article.snippet,
      linkVerified: Boolean(metadata.finalUrl),
      contentAccess: metadata.contentAccess || (description ? "abstract" : "metadata"),
      contentSource: metadata.contentSource || "",
      extractedCharacters: Number(metadata.extractedCharacters || 0),
      contentFailureReason: metadata.contentFailureReason || "",
      contentAttempts: 1,
      contentFetched: true,
      evidence: { hasPublisherDescription: Boolean(description) }
    };
  }));
}

async function collectDomainNews(source, lookbackDays) {
  const domainQueries = buildDomainNewsQueries(source);
  if (!domainQueries.length) throw new Error("官网通道缺少 searchTerms 或 allowedDomains");

  const maxRecords = Math.max(1, Number(source.maxRecords || 12));
  const perDomainLimit = Math.max(2, Math.ceil(maxRecords / domainQueries.length));
  const collected = [];
  const errors = [];

  for (const { domain, query } of domainQueries) {
    try {
      const articles = await collectGoogleNews({
        ...source,
        googleQuery: query,
        maxRecords: perDomainLimit
      }, lookbackDays);
      collected.push(...articles
        .filter((article) => article.linkType === "publisher")
        .filter((article) => isAllowedPublisherUrl(article.url, [domain]))
        .map((article) => ({
          ...article,
          sourceChannel: "Google News 官网单域定向",
          directSource: true
        })));
    } catch (error) {
      errors.push(`${domain}: ${error.message}`);
    }
    await delay(250);
  }

  if (source.bingSupplement !== false) {
    try {
      collected.push(...await collectWebIndex(source, lookbackDays));
    } catch (error) {
      errors.push(`Bing Web 补充: ${error.message}`);
    }
  }

  const articles = deduplicateArticles(collected)
    .filter((article) => isAllowedPublisherUrl(article.url, source.allowedDomains))
    .slice(0, maxRecords);
  if (!articles.length && errors.length === domainQueries.length + 1) {
    throw new Error(errors.join("；"));
  }
  return articles;
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
        contentAccess: cleanText(item.description).length >= 70 ? "abstract" : "metadata",
        evidence: { hasPublisherDescription: cleanText(item.description).length >= 70 },
        ...sourceContext(source)
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
  const collected = [];
  for (const [provider, collector] of attempts) {
    try {
      const articles = await collector(source, lookbackDays);
      if (articles.length) collected.push(...articles);
      else errors.push(`${provider}: 最近 ${lookbackDays} 天无结果`);
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }
  if (!collected.length) console.warn(`  ${source.label} 未获得新闻结果（${errors.join("；")}）`);
  return deduplicateArticles(collected);
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
      const authorNames = (item.authorships || [])
        .slice(0, 8)
        .map((authorship) => authorship.author?.display_name)
        .filter(Boolean);
      const abstract = abstractFromInvertedIndex(item.abstract_inverted_index);
      const journal = location.source || {};
      const biblio = item.biblio || {};
      const openAccessLocation = item.best_oa_location || (item.locations || []).find((candidate) => candidate?.is_oa) || {};
      const fullTextUrls = [...new Set([
        openAccessLocation.pdf_url,
        openAccessLocation.landing_page_url,
        ...(item.locations || [])
          .filter((candidate) => candidate?.is_oa)
          .flatMap((candidate) => [candidate.pdf_url, candidate.landing_page_url]),
        location.landing_page_url,
        item.doi
      ].filter((candidate) => /^https?:\/\//i.test(candidate || "")))];
      return {
        id: makeArticleId(urlValue, item.title),
        title: cleanText(item.title),
        snippet: cleanText([abstract, authorNames.length ? `Authors: ${authorNames.join(", ")}` : ""].filter(Boolean).join(" ")),
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
        contentAccess: abstract ? "abstract" : "metadata",
        contentSource: abstract ? "openalex-abstract" : "metadata",
        extractedCharacters: abstract.length,
        fullTextUrl: fullTextUrls[0] || "",
        fullTextUrls,
        contentFailureReason: fullTextUrls.length ? "" : "未发现合法公开全文地址",
        evidence: {
          hasAbstract: Boolean(abstract),
          doi: item.doi || "",
          authorsCount: (item.authorships || []).length,
          authors: authorNames,
          citedByCount: Number(item.cited_by_count || 0),
          publicationType: item.type === "preprint" ? "preprint" : item.type || "article",
          journal: sourceName,
          sourceId: journal.id || "",
          issnL: journal.issn_l || "",
          issns: Array.isArray(journal.issn) ? journal.issn : [],
          publisher: journal.host_organization_name || "",
          volume: biblio.volume || "",
          issue: biblio.issue || "",
          firstPage: biblio.first_page || "",
          lastPage: biblio.last_page || "",
          isOpenAccess: Boolean(item.open_access?.is_oa),
          isInDoaj: Boolean(journal.is_in_doaj)
        },
        ...sourceContext(source)
      };
    })
    .filter((item) => item.title && item.url);
}

function publishedDateFromParts(...values) {
  for (const value of values) {
    const parts = value?.["date-parts"]?.[0];
    if (!Array.isArray(parts) || !parts[0]) continue;
    const [year, month = 1, day = 1] = parts.map(Number);
    const date = new Date(Date.UTC(year, Math.max(0, month - 1), Math.max(1, day)));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return now.toISOString();
}

async function collectCrossref(source, lookbackDays) {
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - lookbackDays);
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", source.query);
  url.searchParams.set("filter", `from-pub-date:${fromDate.toISOString().slice(0, 10)}`);
  url.searchParams.set("sort", "published");
  url.searchParams.set("order", "desc");
  url.searchParams.set("rows", String(source.maxRecords || 20));

  const data = await fetchJson(url, 2, { Accept: "application/json" });
  return (data.message?.items || []).map((item) => {
    const title = cleanText(item.title?.[0] || "");
    const abstract = cleanText(item.abstract || "");
    const doi = cleanText(item.DOI || "");
    const articleUrl = cleanText(item.URL || (doi ? `https://doi.org/${doi}` : ""));
    const fullTextUrls = [...new Set([
      ...(item.link || []).map((link) => link.URL),
      articleUrl
    ].filter((candidate) => /^https?:\/\//i.test(candidate || "")))];
    const authors = (item.author || [])
      .slice(0, 8)
      .map((author) => cleanText([author.given, author.family].filter(Boolean).join(" ")))
      .filter(Boolean);
    const pages = cleanText(item.page || "").split("-");
    return {
      id: makeArticleId(articleUrl, title),
      title,
      snippet: abstract,
      source: cleanText(item["container-title"]?.[0] || item.publisher || "Crossref"),
      sourceType: "论文",
      region: source.region,
      language: item.language || (source.region === "国内" ? "zh" : "en"),
      publishedAt: publishedDateFromParts(item.published, item["published-print"], item["published-online"], item.issued),
      collectedAt: now.toISOString(),
      url: articleUrl,
      sourceChannel: "Crossref",
      linkType: "publisher",
      linkVerified: Boolean(doi),
      contentAccess: abstract ? "abstract" : "metadata",
      contentSource: abstract ? "crossref-abstract" : "metadata",
      extractedCharacters: abstract.length,
      fullTextUrl: fullTextUrls[0] || "",
      fullTextUrls,
      contentFailureReason: fullTextUrls.length ? "" : "未发现合法公开全文地址",
      evidence: {
        hasAbstract: Boolean(abstract),
        doi,
        authorsCount: (item.author || []).length,
        authors,
        citedByCount: Number(item["is-referenced-by-count"] || 0),
        publicationType: cleanText(item.type || "article"),
        journal: cleanText(item["container-title"]?.[0] || ""),
        issnL: cleanText(item.ISSN?.[0] || ""),
        issns: (item.ISSN || []).slice(0, 4),
        publisher: cleanText(item.publisher || ""),
        volume: cleanText(item.volume || ""),
        issue: cleanText(item.issue || ""),
        firstPage: pages[0] || "",
        lastPage: pages[1] || "",
        isOpenAccess: (item.link || []).some((link) => /pdf|unspecified/i.test(link["content-type"] || "")),
        isInDoaj: false
      },
      ...sourceContext(source)
    };
  }).filter((item) => item.title && item.url);
}

async function collectSemanticScholar(source, lookbackDays) {
  const fromYear = new Date(now.getTime() - lookbackDays * 86400000).getUTCFullYear();
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", source.query);
  url.searchParams.set("limit", String(source.maxRecords || 20));
  url.searchParams.set("year", `${fromYear}-`);
  url.searchParams.set("fields", "title,abstract,authors,publicationDate,venue,journal,externalIds,url,openAccessPdf,citationCount,publicationTypes");
  const data = await fetchJson(url);
  const cutoff = now.getTime() - lookbackDays * 86400000;
  return (data.data || []).map((item) => {
    const doi = cleanText(item.externalIds?.DOI || "");
    const articleUrl = doi ? `https://doi.org/${doi}` : cleanText(item.url || "");
    const openPdf = cleanText(item.openAccessPdf?.url || "");
    const fullTextUrls = [...new Set([openPdf, articleUrl].filter((candidate) => /^https?:\/\//i.test(candidate || "")))];
    const abstract = cleanText(item.abstract || "");
    const publishedAt = item.publicationDate ? `${item.publicationDate}T00:00:00Z` : now.toISOString();
    const authors = (item.authors || []).slice(0, 8).map((author) => cleanText(author.name || "")).filter(Boolean);
    return {
      id: makeArticleId(articleUrl, item.title),
      title: cleanText(item.title || ""),
      snippet: abstract,
      source: cleanText(item.journal?.name || item.venue || "Semantic Scholar"),
      sourceType: "论文",
      region: source.region,
      language: source.region === "国内" ? "zh" : "en",
      publishedAt,
      collectedAt: now.toISOString(),
      url: articleUrl,
      sourceChannel: "Semantic Scholar",
      linkType: "publisher",
      linkVerified: Boolean(doi),
      contentAccess: abstract ? "abstract" : "metadata",
      contentSource: abstract ? "semantic-scholar-abstract" : "metadata",
      extractedCharacters: abstract.length,
      fullTextUrl: fullTextUrls[0] || "",
      fullTextUrls,
      contentFailureReason: openPdf ? "" : "未发现合法公开全文地址",
      evidence: {
        hasAbstract: Boolean(abstract),
        doi,
        authorsCount: (item.authors || []).length,
        authors,
        citedByCount: Number(item.citationCount || 0),
        publicationType: cleanText(item.publicationTypes?.[0] || "article"),
        journal: cleanText(item.journal?.name || item.venue || ""),
        issnL: "",
        issns: [],
        publisher: "",
        volume: cleanText(item.journal?.volume || ""),
        issue: cleanText(item.journal?.pages || ""),
        firstPage: "",
        lastPage: "",
        isOpenAccess: Boolean(openPdf),
        isInDoaj: false
      },
      ...sourceContext(source)
    };
  }).filter((item) => {
    const published = new Date(item.publishedAt).getTime();
    return item.title && item.url && Number.isFinite(published) && published >= cutoff;
  });
}

async function collectWebIndex(source, lookbackDays) {
  const cutoff = now.getTime() - lookbackDays * 86400000;
  const fromDate = new Date(cutoff).toISOString().slice(0, 10);
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", `${source.query} after:${fromDate}`);
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", "zh-Hans");
  const parsed = xmlParser.parse(await fetchText(url));
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, Number(source.maxRecords || 8));
  const articles = [];
  for (const item of items) {
    const articleUrl = cleanText(item.link || "");
    if (source.allowedDomains?.length && !isAllowedPublisherUrl(articleUrl, source.allowedDomains)) continue;
    const metadata = await fetchPublisherMetadata(articleUrl);
    const published = new Date(metadata.publishedAt || "");
    const publishedAt = Number.isNaN(published.getTime()) ? now.toISOString() : published.toISOString();
    const description = usefulPublisherDescription(metadata.description || item.description, item.title);
    let sourceName = source.label;
    try {
      sourceName = new URL(metadata.finalUrl || articleUrl).hostname.replace(/^www\./, "");
    } catch {}
    articles.push({
      id: makeArticleId(articleUrl, item.title),
      title: cleanText(item.title || metadata.title || ""),
      snippet: metadata.fullText || description || "",
      source: sourceName,
      sourceType: source.sourceType || "论文",
      region: source.region || "国内",
      language: source.language === "English" ? "en" : "zh",
      publishedAt,
      collectedAt: now.toISOString(),
      url: metadata.finalUrl || articleUrl,
      sourceChannel: source.sourceType === "论文" || !source.sourceType ? "Bing Web 学术题录" : "Bing Web 官网定向",
      linkType: "publisher",
      linkVerified: Boolean(metadata.finalUrl),
      contentAccess: metadata.contentAccess || (description ? "abstract" : "metadata"),
      contentSource: metadata.contentSource || (description ? "publisher-description" : "metadata"),
      extractedCharacters: Number(metadata.extractedCharacters || 0),
      contentFailureReason: metadata.contentFailureReason || "",
      contentAttempts: 1,
      contentFetched: true,
      evidence: {
        hasAbstract: Boolean(description),
        hasPublisherDescription: Boolean(description),
        publishedDateEstimated: Number.isNaN(published.getTime()),
        doi: "",
        authorsCount: 0,
        authors: [],
        journal: source.sourceType === "论文" || !source.sourceType ? sourceName : "",
        isOpenAccess: metadata.contentAccess === "fulltext"
      },
      ...sourceContext(source)
    });
    await delay(250);
  }
  return articles.filter((item) => item.title && item.url && isCandidateRelevant(item));
}

async function collectGooglePatents(source, lookbackDays) {
  const cutoff = now.getTime() - lookbackDays * 86400000;
  const publicationDate = new Date(cutoff).toISOString().slice(0, 10).replaceAll("-", "");
  const patentQueries = (Array.isArray(source.patentQueries) ? source.patentQueries : [source.patentQuery])
    .map(cleanText)
    .filter(Boolean);
  if (!patentQueries.length) throw new Error("专利通道缺少 patentQueries");

  const collectedRecords = [];
  const errors = [];
  for (const patentQuery of patentQueries) {
    const nestedQuery = new URLSearchParams();
    nestedQuery.set("q", patentQuery);
    nestedQuery.set("after", `publication:${publicationDate}`);
    if (source.patentCountry) nestedQuery.set("country", source.patentCountry);

    const url = new URL("https://patents.google.com/xhr/query");
    url.searchParams.set("url", nestedQuery.toString());
    url.searchParams.set("exp", "");
    try {
      const data = await fetchJson(url, 1, {
        Accept: "application/json",
        Referer: "https://patents.google.com/",
        "User-Agent": "Mozilla/5.0 (compatible; MechanicalCenterDrivetrainBot/1.0; public patent index)"
      });
      const clusters = Array.isArray(data?.results?.cluster) ? data.results.cluster : [];
      collectedRecords.push(...clusters
        .flatMap((cluster) => Array.isArray(cluster?.result) ? cluster.result : cluster?.result ? [cluster.result] : []));
    } catch (error) {
      errors.push(`${patentQuery}: ${error.message}`);
    }
    await delay(600);
  }
  if (!collectedRecords.length && errors.length === patentQueries.length) {
    throw new Error(errors.join("；"));
  }

  const seenPatents = new Set();
  const records = collectedRecords
    .map((result) => ({ result, patent: result?.patent || {} }))
    .filter(({ patent }) => patent.title && patent.publication_date)
    .filter(({ result }) => {
      const key = cleanText(result.id || "");
      if (!key || seenPatents.has(key)) return false;
      seenPatents.add(key);
      return true;
    })
    .filter(({ patent }) => {
      const published = new Date(`${patent.publication_date}T00:00:00Z`).getTime();
      return Number.isFinite(published) && published >= cutoff;
    })
    .slice(0, Math.max(1, Number(source.maxRecords || 12)));

  const articles = [];
  for (const { result, patent } of records) {
    const patentPath = String(result.id || "").replace(/^\/+/, "");
    const articleUrl = new URL(patentPath, "https://patents.google.com/").toString();
    if (!isAllowedPublisherUrl(articleUrl, source.allowedDomains)) continue;
    const metadata = await fetchPublisherMetadata(articleUrl);
    const indexSnippet = cleanText(patent.snippet || "");
    const description = usefulPublisherDescription(metadata.description || indexSnippet, patent.title);
    const snippet = metadata.fullText || description || indexSnippet;
    const assignee = cleanText(patent.assignee || "");
    const inventor = cleanText(patent.inventor || "");
    articles.push({
      id: makeArticleId(articleUrl, patent.title),
      title: cleanText(patent.title),
      snippet,
      source: assignee || "Google Patents",
      sourceType: "专利",
      region: source.region || "海外",
      language: source.language === "Chinese" ? "zh" : cleanText(patent.language || "en"),
      publishedAt: new Date(`${patent.publication_date}T00:00:00Z`).toISOString(),
      collectedAt: now.toISOString(),
      url: metadata.finalUrl || articleUrl,
      sourceUrl: "https://patents.google.com/",
      imageUrl: "",
      sourceChannel: "Google Patents 公开检索",
      linkType: "publisher",
      linkVerified: Boolean(metadata.finalUrl),
      contentAccess: metadata.contentAccess || (description.length >= 70 ? "abstract" : "metadata"),
      contentSource: metadata.contentSource || (description ? "patent-index" : "metadata"),
      extractedCharacters: Number(metadata.extractedCharacters || 0),
      contentFailureReason: metadata.contentFailureReason || "",
      contentAttempts: 1,
      contentFetched: true,
      evidence: {
        hasAbstract: Boolean(metadata.fullText || description.length >= 70),
        hasPublisherDescription: Boolean(description),
        publicationType: "patent",
        journal: cleanText(patent.publication_number || ""),
        publisher: assignee,
        authors: inventor ? [inventor] : [],
        authorsCount: inventor ? 1 : 0,
        isOpenAccess: metadata.contentAccess === "fulltext",
        priorityDate: cleanText(patent.priority_date || ""),
        filingDate: cleanText(patent.filing_date || "")
      },
      ...sourceContext(source)
    });
    await delay(200);
  }
  return articles.filter((article) => isCandidateRelevant(article));
}

async function enrichPublicFullText(articles) {
  const limit = Math.max(0, Number(process.env.FULLTEXT_MAX_ARTICLES || 75));
  const concurrency = Math.max(1, Math.min(5, Number(process.env.FULLTEXT_CONCURRENCY || 3)));
  const targets = articles
    .map((article) => ({
      article,
      targetUrls: [...new Set(
        (article.sourceType === "论文"
          ? [...(article.fullTextUrls || []), article.fullTextUrl, article.url]
          : [article.url]
        ).filter((url) => /^https?:\/\//i.test(url || ""))
      )].slice(0, 4)
    }))
    .filter(({ article, targetUrls }) =>
      !article.contentFetched &&
      article.contentAccess !== "fulltext" &&
      targetUrls.length
    )
    .slice(0, limit);
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const { article, targetUrls } = targets[cursor++];
      let lastFailure = article.contentFailureReason || "";
      for (const targetUrl of targetUrls) {
        const content = await fetchPublisherMetadata(targetUrl);
        article.contentAttempts = Number(article.contentAttempts || 0) + 1;
        if (content.title && titleSimilarity(article.title, content.title) < 0.18) {
          lastFailure = "公开页面标题与题录不一致";
          await delay(180);
          continue;
        }
        const description = usefulPublisherDescription(content.description, article.title);
        if (content.fullText?.length >= MIN_FULLTEXT_CHARACTERS) {
          article.snippet = content.fullText;
          article.contentAccess = "fulltext";
          article.contentSource = content.contentSource;
          article.extractedCharacters = content.extractedCharacters;
          article.contentFailureReason = "";
          if (article.sourceType !== "论文" && content.finalUrl) article.url = content.finalUrl;
          article.linkVerified = true;
          break;
        }
        if (description && cleanText(article.snippet).length < description.length) {
          article.snippet = description;
          article.contentAccess = "abstract";
          article.contentSource = content.contentSource || "publisher-description";
          article.evidence = { ...article.evidence, hasPublisherDescription: true };
        }
        lastFailure = content.contentFailureReason || lastFailure;
        await delay(180);
      }
      article.contentFetched = true;
      if (article.contentAccess !== "fulltext") article.contentFailureReason = lastFailure || "未获得合法公开全文";
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  const fullTextCount = articles.filter((article) => article.contentAccess === "fulltext").length;
  console.log(`公开全文提取：${fullTextCount} 条全文，补充尝试 ${targets.length} 条，并发 ${concurrency}`);
}

async function enrichReaderFullText(articles) {
  const limit = Math.max(0, Number(process.env.READER_FALLBACK_MAX_ARTICLES || 24));
  const concurrency = Math.max(1, Math.min(3, Number(process.env.READER_FALLBACK_CONCURRENCY || 2)));
  const targets = articles
    .filter((article) =>
      article.contentAccess === "metadata" &&
      article.contentFetched &&
      Number(article.contentAttempts || 0) > 0 &&
      article.linkType !== "aggregator" &&
      /^https?:\/\//i.test(article.url || "") &&
      !/news\.google\.com/i.test(article.url || "") &&
      classifyArticle(article).informationLevel !== "ignored"
    )
    .slice(0, limit);
  let cursor = 0;
  let recovered = 0;
  async function worker() {
    while (cursor < targets.length) {
      const article = targets[cursor++];
      const content = await fetchReaderContent(article.url, article.title);
      article.contentAttempts = Number(article.contentAttempts || 0) + 1;
      if (!content || (content.title && titleSimilarity(article.title, content.title) < 0.18)) continue;
      article.snippet = content.fullText;
      article.contentAccess = "fulltext";
      article.contentSource = "public-web-reader";
      article.extractedCharacters = content.fullText.length;
      article.contentFailureReason = "";
      article.contentFetched = true;
      article.linkVerified = true;
      recovered += 1;
      await delay(180);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  console.log(`公开网页文本化回退：尝试 ${targets.length} 条，恢复 ${recovered} 条正文`);
  return recovered;
}

async function enrichOpenAlexSourceMetrics(articles) {
  const sourceCache = new Map();
  for (const article of articles.filter((item) => item.sourceType === "论文")) {
    const sourceId = cleanText(article.evidence?.sourceId || "");
    const shortId = sourceId.match(/\/([A-Z]\d+)$/i)?.[1];
    if (!shortId) continue;
    if (!sourceCache.has(shortId)) {
      try {
        const metrics = await fetchJson(`https://api.openalex.org/sources/${shortId}`);
        sourceCache.set(shortId, metrics);
      } catch (error) {
        console.warn(`  OpenAlex 期刊指标获取失败 ${shortId}: ${error.message}`);
        sourceCache.set(shortId, null);
      }
      await delay(450);
    }
    const source = sourceCache.get(shortId);
    if (!source) continue;
    const stats = source.summary_stats || {};
    article.evidence = {
      ...article.evidence,
      publisher: article.evidence.publisher || source.host_organization_name || "",
      issnL: article.evidence.issnL || source.issn_l || "",
      issns: article.evidence.issns?.length ? article.evidence.issns : source.issn || [],
      isInDoaj: Boolean(article.evidence.isInDoaj || source.is_in_doaj),
      sourceMetrics: {
        provider: "OpenAlex",
        metricName: "2年平均被引率",
        twoYearMeanCitedness: Number(stats["2yr_mean_citedness"] || 0),
        hIndex: Number(stats.h_index || 0),
        i10Index: Number(stats.i10_index || 0),
        worksCount: Number(source.works_count || 0),
        citedByCount: Number(source.cited_by_count || 0),
        updatedAt: now.toISOString()
      }
    };
  }
}

function buildWeeklyBrief(articles, lookbackDays, usedAi, archiveCount) {
  const readableArticles = articles.filter((article) => article.evidence?.contentAccess !== "metadata");
  const briefCount = articles.filter((article) => ["brief", "catalog"].includes(article.informationLevel)).length;
  const clueCount = articles.filter((article) => article.informationLevel === "lead").length;
  const counts = new Map();
  for (const article of readableArticles) {
    const topics = [article.primarySection || article.componentCategory || article.category];
    for (const topic of new Set(topics.filter(Boolean))) counts.set(topic, (counts.get(topic) || 0) + 1);
  }
  const leadingTopics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);
  const domesticCount = readableArticles.filter((article) => article.region === "国内").length;
  const paperCount = readableArticles.filter((article) => article.sourceType === "论文").length;
  const fullTextCount = readableArticles.filter((article) => article.evidence?.contentAccess === "fulltext").length;

  return {
    title: leadingTopics.length
      ? `本周聚焦：${leadingTopics.join("、")}`
      : "本周暂无新增高相关资料",
    summary: readableArticles.length
      ? `过去 ${lookbackDays} 天共筛选 ${readableArticles.length} 条可读情报，其中国内 ${domesticCount} 条、论文 ${paperCount} 篇，${fullTextCount} 条已提取公开全文${briefCount ? `；另有 ${briefCount} 条题名简讯或论文题录已归入对应主栏目` : ""}${clueCount ? `，${clueCount} 条综合资讯等待深读` : ""}。资料库累计保留 ${archiveCount} 条可追溯记录，工程结论仍需回到原文核对适用机型与载荷边界。`
      : `过去 ${lookbackDays} 天未发现满足相关性阈值的新资料；资料库仍保留 ${archiveCount} 条历史记录供检索。`,
    signals: readableArticles.slice(0, 3).map((article) => article.title),
    metrics: {
      total: readableArticles.length,
      domestic: domesticCount,
      overseas: readableArticles.length - domesticCount,
      papers: paperCount,
      briefs: briefCount,
      clues: clueCount
    },
    summaryMode: usedAi ? "全文优先 · AI 结构化" : readableArticles.length ? "全文优先 · 规则摘要" : "本周无新增"
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

function needsDetailedSummaryUpgrade(article) {
  if (!cleanText(article?.titleZh || "")) return true;
  if (article?.sourceType === "论文" && !article.paperDetails) return true;
  if (article?.intelligenceType === "industry" && !article.industryDetails) return true;
  return false;
}

function contentAccessRank(value) {
  return { metadata: 0, abstract: 1, fulltext: 2 }[value] ?? 0;
}

function hasContentUpgrade(existing, current) {
  return contentAccessRank(current?.contentAccess) > contentAccessRank(existing?.evidence?.contentAccess);
}

function downgradeInvalidReaderRecovery(article) {
  if (
    article.evidence?.contentSource !== "public-web-reader" ||
    !readerSummaryIndicatesNonArticle(`${article.summary || ""} ${(article.keyPoints || []).join(" ")}`)
  ) {
    return article;
  }
  return {
    ...article,
    evidence: {
      ...article.evidence,
      contentAccess: "metadata",
      contentSource: "",
      extractedCharacters: 0,
      hasAbstract: false,
      isOpenAccess: false
    }
  };
}

async function loadFeedbackAggregates() {
  const localPath = new URL("../public/data/feedback-aggregates.json", import.meta.url);
  let payload = await readJson(localPath, { generatedAt: null, articles: {} });
  const endpoint = process.env.FEEDBACK_AGGREGATE_URL;
  let loadedFromEndpoint = false;
  if (endpoint) {
    try {
      const token = String(process.env.FEEDBACK_AGGREGATE_TOKEN || "");
      payload = await fetchJson(endpoint, 2, token ? { Authorization: `Bearer ${token}` } : {});
      loadedFromEndpoint = true;
      console.log("已载入集中用户反馈汇总。");
    } catch (error) {
      console.warn(`集中反馈暂时不可用，继续使用本地汇总: ${error.message}`);
    }
  }
  return { payload, map: feedbackArticleMap(payload), loadedFromEndpoint };
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
  const sourceSelected = (id) => !probeSourceIds.size || probeSourceIds.has(id);

  const newsJobs = (config.newsQueries || []).filter((source) => sourceSelected(source.id)).map((source) => ({
      id: source.id,
      label: source.label,
      type: "news",
      run: () => collectNews(source, lookbackDays)
    }));
  const researchCollectors = {
    openalex: { label: "OpenAlex", run: collectOpenAlex },
    crossref: { label: "Crossref", run: collectCrossref },
    "semantic-scholar": { label: "Semantic Scholar", run: collectSemanticScholar },
    "academic-web": { label: "国内公开题录", run: collectWebIndex }
  };
  const webCollectors = {
    "domain-news": collectDomainNews,
    "google-patents": collectGooglePatents,
    "bing-web": collectWebIndex
  };
  const webJobs = (config.webQueries || []).filter((source) => sourceSelected(source.id)).map((source) => {
    const collector = webCollectors[source.collector || "bing-web"];
    return {
      id: source.id,
      label: source.label,
      type: "web",
      run: () => {
        if (!collector) throw new Error(`未知网页采集器: ${source.collector}`);
        return collector(source, lookbackDays);
      }
    };
  });
  const researchJobs = (config.researchQueries || []).flatMap((source) =>
    (source.providers || ["openalex", "crossref"]).flatMap((provider) => {
      const collector = researchCollectors[provider];
      const jobId = `${source.id}-${provider}`;
      if (!collector || (!sourceSelected(source.id) && !sourceSelected(jobId))) return [];
      return [{
        id: jobId,
        label: `${source.label} · ${collector.label}`,
        type: "research",
        run: () => collector.run(source, lookbackDays)
      }];
    })
  );
  const jobs = [...newsJobs, ...webJobs, ...researchJobs];

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
  const webResults = [];
  for (const job of webJobs) {
    try {
      webResults.push({ status: "fulfilled", value: await job.run() });
    } catch (reason) {
      webResults.push({ status: "rejected", reason });
    }
    await delay(900);
  }
  const researchResults = [];
  for (const job of researchJobs) {
    try {
      researchResults.push({ status: "fulfilled", value: await job.run() });
    } catch (reason) {
      researchResults.push({ status: "rejected", reason });
    }
    await delay(1200);
  }
  const results = [...newsResults, ...webResults, ...researchResults];
  const rawArticles = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`✓ ${jobs[index].label}: ${result.value.length} 条`);
      rawArticles.push(...result.value);
    } else {
      console.warn(`× ${jobs[index].label}: ${result.reason?.message || result.reason}`);
    }
  });

  if (probeSourceIds.size) {
    console.log(JSON.stringify({
      generatedAt: now.toISOString(),
      lookbackDays,
      channels: results.map((result, index) => {
        const health = classifyChannelResult(result);
        return {
          id: jobs[index].id,
          label: jobs[index].label,
          ...health,
          fetched: result.status === "fulfilled" ? result.value.length : 0,
          error: result.status === "rejected" ? cleanText(result.reason?.message || result.reason) : ""
        };
      }),
      samples: rawArticles.slice(0, 20).map((article) => ({
        title: article.title,
        source: article.source,
        sourceType: article.sourceType,
        publishedAt: article.publishedAt,
        url: article.url,
        contentAccess: article.contentAccess
      }))
    }, null, 2));
    return;
  }

  const relevantRawArticles = rawArticles.filter(isCandidateRelevant);
  const minimumFeedback = Number(reliabilityConfig.minimumFeedback || 5);
  const previousIsLive = process.env.COLLECT_RESET_HISTORY !== "1" &&
    previous.collectionStatus?.dataMode === "live" &&
    !previous.collectionStatus?.demo;
  const previousArticles = (previousIsLive ? previous.articles || [] : []).map((article) => {
    const normalized = downgradeInvalidReaderRecovery(article);
    const aggregate = feedbackAggregates.map.get(article.id);
    const calibrated = recalibratePublishedArticle(
      normalized,
      aggregate ||
        (feedbackAggregates.loadedFromEndpoint ? {} : normalized.feedbackAggregate || {}),
      minimumFeedback
    );
    return {
      ...calibrated,
      ...classifyArticle(calibrated),
      engineeringExperience: aggregate?.experience || article.engineeringExperience || {}
    };
  });
  const previousByUrl = new Map(previousArticles.map((article) => [article.url, article]));
  const candidates = deduplicateArticles([...relevantRawArticles].sort((left, right) =>
    Number(right.queryTopic === "industry" || right.queryTopic === "official") -
    Number(left.queryTopic === "industry" || left.queryTopic === "official")
  ))
    .map((article) => {
      const aggregate = feedbackAggregates.map.get(article.id) || {};
      return {
        ...article,
        relevanceScore: relevanceScore(article, keywordWeights) +
          (article.queryTopic === "industry"
            ? Number(config.industryRelevanceBoost || 3)
            : article.queryTopic === "official"
              ? Number(config.officialRelevanceBoost || 4)
              : 0),
        corroboratingSources: findCorroboratingSources(article, relevantRawArticles),
        feedbackAggregate: aggregate,
        engineeringExperience: aggregate.experience || {},
        reliabilityConfig
      };
    })
    .filter((article) => article.relevanceScore >= Number(config.minimumRelevanceScore || 3))
    .sort((a, b) => {
      const dateDifference = new Date(b.publishedAt) - new Date(a.publishedAt);
      return dateDifference || b.relevanceScore - a.relevanceScore;
    })
    .slice(0, maxArticles);

  await enrichPublicFullText(candidates);
  await enrichReaderFullText(candidates);
  await enrichOpenAlexSourceMetrics(candidates);

  const aiProvider = resolveAiProvider(process.env);
  const aiReasons = new Map();
  const needsSummary = candidates.flatMap((article) => {
    if (article.contentAccess === "metadata") return [];
    const existing = previousByUrl.get(article.url);
    let reason = "";
    if (!existing) reason = "new";
    else if (hasContentUpgrade(existing, article)) reason = "content-upgrade";
    else if (needsDetailedSummaryUpgrade(existing)) reason = "schema-upgrade";
    else if (forceAiSummary) reason = "manual-refresh";
    else if (feedbackNeedsAiReview(article.feedbackAggregate, existing.aiAnalysis, minimumFeedback)) {
      reason = "feedback-review";
    } else if (experienceNeedsAiReview(article.engineeringExperience, existing.aiAnalysis, 2)) {
      reason = "experience-review";
    }
    if (!reason) return [];
    aiReasons.set(article.id, reason);
    return [{
      ...article,
      previousSummary: existing?.summary || "",
      aiReviewReason: reason
    }];
  });
  const candidateIds = new Set(candidates.map((article) => article.id));
  for (const existing of previousArticles) {
    if (candidateIds.has(existing.id)) continue;
    if (existing.evidence?.contentAccess === "metadata") continue;
    let reason = "";
    if (needsDetailedSummaryUpgrade(existing)) reason = "historical-schema-upgrade";
    else if (feedbackNeedsAiReview(existing.feedbackAggregate, existing.aiAnalysis, minimumFeedback)) {
      reason = "feedback-review";
    } else if (experienceNeedsAiReview(existing.engineeringExperience, existing.aiAnalysis, 2)) {
      reason = "experience-review";
    }
    if (!reason) continue;
    aiReasons.set(existing.id, reason);
    needsSummary.push({
      ...existing,
      queryTopic: existing.intelligenceType === "industry" || existing.intelligenceType === "official"
        ? existing.intelligenceType
        : "technical",
      snippet: cleanText(`${existing.summary || ""} ${(existing.keyPoints || []).join(" ")}`).slice(0, 1800),
      previousSummary: existing.summary || "",
      feedbackAggregate: existing.feedbackAggregate || {},
      engineeringExperience: existing.engineeringExperience || {},
      aiReviewReason: reason
    });
  }
  let aiSummaries = new Map();

  if (aiProvider && needsSummary.length) {
    try {
      const feedbackReviewCount = [...aiReasons.values()].filter((reason) => reason === "feedback-review").length;
      const experienceReviewCount = [...aiReasons.values()].filter((reason) => reason === "experience-review").length;
      console.log(`使用 ${aiProvider.label} ${aiProvider.model} 分析 ${needsSummary.length} 条资料，其中反馈复核 ${feedbackReviewCount} 条、工程经验复核 ${experienceReviewCount} 条...`);
      aiSummaries = await summarizeInBatches(aiProvider, needsSummary, {
        onBatchError: (error, batchNumber) => {
          console.warn(`AI 摘要第 ${batchNumber} 批失败，保留该批公开摘要: ${error.message}`);
        }
      });
    } catch (error) {
      console.warn(error.message);
      console.warn("本次改用规则摘要，采集结果仍会保存。");
    }
  } else if (needsSummary.length) {
    console.log("未配置可用 AI API Key，本次使用发布方公开摘要或明确的缺失提示。");
  } else {
    console.log("本轮没有需要新增或复核的 AI 摘要。");
  }

  const currentArticles = candidates.map((article) => {
    const existing = previousByUrl.get(article.url);
    const generatedSummary = aiSummaries.get(article.id);
    const summaryData = generatedSummary
      ? generatedSummary
      : existing
      ? {
          titleZh: existing.titleZh,
          summary: existing.summary,
          keyPoints: existing.keyPoints,
          engineeringImpact: existing.engineeringImpact,
          category: existing.category,
          tags: existing.tags,
          paperDetails: existing.paperDetails,
          industryDetails: existing.industryDetails,
          experienceReview: existing.experienceReview
        }
      : createFallbackSummary(article);
    const publicArticle = toPublicArticle(
      article,
      summaryData
    );
    if (generatedSummary) {
      publicArticle.aiAnalysis = {
        provider: aiProvider.id,
        model: aiProvider.model,
        generatedAt: now.toISOString(),
        reason: aiReasons.get(article.id) || "new",
        feedbackTotalAtAnalysis: Number(article.feedbackAggregate?.total || 0),
        experienceTotalAtAnalysis: Number(article.engineeringExperience?.total || 0),
        experienceWrittenTotalAtAnalysis: Number(article.engineeringExperience?.writtenTotal || 0),
        experienceLatestAtAnalysis: String(article.engineeringExperience?.latestInsightAt || "")
      };
    } else if (existing?.aiAnalysis) {
      publicArticle.aiAnalysis = existing.aiAnalysis;
    }
    return publicArticle;
  });

  const updatedPreviousArticles = previousArticles.map((article) => {
    const generatedSummary = aiSummaries.get(article.id);
    if (!generatedSummary || candidateIds.has(article.id)) {
      return !article.titleZh && /[\p{Script=Han}]/u.test(article.title || "")
        ? { ...article, titleZh: article.title }
        : article;
    }
    return {
      ...article,
      titleZh: generatedSummary.titleZh,
      summary: generatedSummary.summary,
      keyPoints: generatedSummary.keyPoints,
      engineeringImpact: generatedSummary.engineeringImpact,
      category: article.intelligenceType === "industry" ? "厂商动态" : generatedSummary.category,
      tags: generatedSummary.tags,
      paperDetails: generatedSummary.paperDetails,
      industryDetails: generatedSummary.industryDetails,
      experienceReview: generatedSummary.experienceReview,
      aiAnalysis: {
        provider: aiProvider.id,
        model: aiProvider.model,
        generatedAt: now.toISOString(),
        reason: aiReasons.get(article.id) || "historical-schema-upgrade",
        feedbackTotalAtAnalysis: Number(article.feedbackAggregate?.total || 0),
        experienceTotalAtAnalysis: Number(article.engineeringExperience?.total || 0),
        experienceWrittenTotalAtAnalysis: Number(article.engineeringExperience?.writtenTotal || 0),
        experienceLatestAtAnalysis: String(article.engineeringExperience?.latestInsightAt || "")
      }
    };
  });

  const historyCutoff = now.getTime() - historyRetentionDays * 86400000;
  const articles = deduplicateArticles([...currentArticles, ...updatedPreviousArticles])
    .filter((article) => new Date(article.publishedAt).getTime() >= historyCutoff)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, historyMaxArticles)
    .map((article) => ({
      ...article,
      engineeringExperience: publicEngineeringExperience(article.engineeringExperience)
    }));

  const previousChannels = new Map(
    (previous.collectionStatus?.sources || []).map((channel) => [channel.id, channel])
  );
  const channelResults = results.map((result, index) => {
    const health = classifyChannelResult(result, previousChannels.get(jobs[index].id));
    return {
      id: jobs[index].id,
      label: jobs[index].label,
      type: jobs[index].type,
      ...health,
      fetched: result.status === "fulfilled" ? result.value.length : 0,
      error: result.status === "rejected" ? cleanText(result.reason?.message || result.reason).slice(0, 180) : ""
    };
  });

  const payload = {
    app: "机械中心-传动技术部在线平台",
    taxonomyVersion: 3,
    generatedAt: now.toISOString(),
    period: {
      from: new Date(now.getTime() - lookbackDays * 86400000).toISOString(),
      to: now.toISOString()
    },
    collectionStatus: {
      dataMode: "live",
      demo: false,
      channels: jobs.length,
      succeeded: channelResults.filter((channel) => channel.requestStatus === "ok").length,
      productive: channelResults.filter((channel) => channel.status === "ok").length,
      empty: channelResults.filter((channel) => channel.status === "empty").length,
      lowYield: channelResults.filter((channel) => channel.status === "low-yield").length,
      failed: channelResults.filter((channel) => channel.status === "failed").length,
      rawFetched: rawArticles.length,
      currentCount: currentArticles.length,
      readableCount: currentArticles.filter((article) => article.evidence?.contentAccess !== "metadata").length,
      metadataCount: currentArticles.filter((article) => article.evidence?.contentAccess === "metadata").length,
      briefCount: currentArticles.filter((article) => ["brief", "catalog"].includes(article.informationLevel)).length,
      clueCount: currentArticles.filter((article) => article.informationLevel === "lead").length,
      ignoredCount: currentArticles.filter((article) => article.informationLevel === "ignored").length,
      fullTextCount: currentArticles.filter((article) => article.evidence?.contentAccess === "fulltext").length,
      abstractCount: currentArticles.filter((article) => article.evidence?.contentAccess === "abstract").length,
      readerRecoveredCount: currentArticles.filter((article) => article.evidence?.contentSource === "public-web-reader").length,
      archiveCount: articles.length,
      ai: {
        provider: aiProvider?.id || "none",
        model: aiProvider?.model || "",
        requested: needsSummary.length,
        summarized: aiSummaries.size,
        feedbackReviews: [...aiReasons.values()].filter((reason) => reason === "feedback-review").length,
        experienceReviews: [...aiReasons.values()].filter((reason) => reason === "experience-review").length
      },
      sources: channelResults
    },
    reliabilityMethod: {
      version: "1.0",
      minimumFeedback: Number(reliabilityConfig.minimumFeedback || 5),
      note: "可靠度评估来源质量、证据完整度和可追溯性，不等同于事实已经证实。"
    },
    feedbackStatus: {
      aggregateGeneratedAt: feedbackAggregates.payload?.generatedAt || null,
      centralized: feedbackAggregates.loadedFromEndpoint
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
