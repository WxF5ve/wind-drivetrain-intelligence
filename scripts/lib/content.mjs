import { parse } from "node-html-parser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { cleanText } from "./articles.mjs";

export const MIN_FULLTEXT_CHARACTERS = 320;

const boilerplatePattern = /^(相关阅读|相关推荐|责任编辑|免责声明|版权声明|返回首页|点击查看|来源[:：]|编辑[:：]|记者[:：]|advertisement|related articles|read more|copyright)/i;

function uniqueParagraphs(nodes) {
  const seen = new Set();
  const paragraphs = [];
  for (const node of nodes) {
    const text = cleanText(node.text || node.innerText || "");
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 160);
    if (text.length < 28 || boilerplatePattern.test(text) || seen.has(key)) continue;
    seen.add(key);
    paragraphs.push(text);
  }
  return paragraphs;
}

export function extractHtmlContent(html, maxCharacters = 14000) {
  const root = parse(String(html || "").slice(0, 3_000_000));
  root.querySelectorAll("script, style, noscript, nav, footer, form, iframe, svg, canvas, aside")
    .forEach((node) => node.remove());
  const title = cleanText(
    root.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    root.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ||
    root.querySelector('meta[name="DC.title"]')?.getAttribute("content") ||
    root.querySelector("title")?.text ||
    ""
  );
  const descriptionSelectors = [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
    'meta[name="DC.description"]'
  ];
  let description = "";
  for (const selector of descriptionSelectors) {
    const candidate = cleanText(root.querySelector(selector)?.getAttribute("content") || "");
    if (candidate.length >= 40) {
      description = candidate.slice(0, 1800);
      break;
    }
  }
  const publishedAt = cleanText(
    root.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
    root.querySelector('meta[name="citation_publication_date"]')?.getAttribute("content") ||
    root.querySelector('meta[name="citation_date"]')?.getAttribute("content") ||
    root.querySelector('meta[name="date"]')?.getAttribute("content") ||
    root.querySelector('meta[name="DC.date"]')?.getAttribute("content") ||
    ""
  );
  const selectors = [
    '[itemprop="abstract"]',
    '[itemprop="articleBody"]', "article", ".article-content", ".article-body", ".articleText",
    ".post-content", ".entry-content", ".news-content", ".content-detail", ".TRS_Editor", "main"
  ];
  const candidates = [];
  for (const selector of selectors) {
    for (const node of root.querySelectorAll(selector)) {
      const paragraphs = uniqueParagraphs(node.querySelectorAll("p, h2, h3, li"));
      const text = paragraphs.join("\n");
      if (text.length >= 120) candidates.push({ text, score: text.length + paragraphs.length * 80 });
    }
  }
  if (!candidates.length) {
    const body = root.querySelector("body") || root;
    const paragraphs = uniqueParagraphs(body.querySelectorAll("p"));
    const text = paragraphs.join("\n");
    if (text.length >= 240) candidates.push({ text, score: text.length });
  }
  const fullText = candidates.sort((left, right) => right.score - left.score)[0]?.text.slice(0, maxCharacters) || "";
  return { title, description, fullText, publishedAt };
}

function normalizedReaderTitle(value) {
  return cleanText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function readerLineText(value) {
  return cleanText(String(value || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/[*_]{1,3}/g, ""));
}

function isReaderArticleEnd(raw, text) {
  if (/^#{1,6}\s*(?:特别声明|相关推荐|相关内容|延伸阅读|更多推荐|免责声明|版权声明|Comments?|Related)/i.test(raw)) {
    return true;
  }
  return /^(?:风电资讯一手掌握|看资讯\s*\/|如因作品内容|联系方式[:：]?\s*\d|\[?共\s*\d+\s*条|相关评论|匿名发表|当前已经输入|京ICP备|ICP备|增值电信业务许可证|京公网安备|公网安备)/i.test(text);
}

export function extractReaderContent(markdown, expectedTitle = "", maxCharacters = 14000) {
  const source = String(markdown || "").slice(0, 1_000_000);
  const lines = source.split(/\r?\n/);
  const title = cleanText(lines.find((line) => /^Title:\s*/i.test(line))?.replace(/^Title:\s*/i, "") || expectedTitle);
  const expectedKey = normalizedReaderTitle(expectedTitle || title.replace(/\s*[-|]\s*[^-|]+$/, ""));
  const headings = lines
    .map((line, index) => ({ line, index, text: readerLineText(line) }))
    .filter(({ line, text }) => /^#{1,3}\s+/.test(line) && text);
  const heading = headings
    .map((item) => {
      const key = normalizedReaderTitle(item.text);
      const score = expectedKey && (key === expectedKey ? 3 : key.includes(expectedKey) || expectedKey.includes(key) ? 2 : 0);
      return { ...item, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)[0];
  if (!heading?.score) return { title, description: "", fullText: "", publishedAt: "" };

  const paragraphs = [];
  let publishedAt = "";
  for (let index = heading.index + 1; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    const text = readerLineText(raw);
    if (isReaderArticleEnd(raw, text)) break;
    if (!publishedAt) publishedAt = raw.match(/(?:时间|日期|发布时间)[:：]\s*(20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?)/)?.[1] || "";
    if (!raw || /^!\[/.test(raw) || /connect\.qq|share(?:qq|weibo)|javascript:|\/api\/share/i.test(raw)) continue;
    if (/^_?关键词[:：]/.test(raw) || /^https?:\/\//i.test(raw)) continue;
    const linkCount = (raw.match(/\]\(/g) || []).length;
    if (linkCount >= 3 || (linkCount && raw.length < 80)) continue;
    if (/^(?:来源|时间|日期|发布时间|作者|编辑|记者|关键词)[:：]/.test(text)) continue;
    if (text.length < 20 || boilerplatePattern.test(text)) continue;
    paragraphs.push(text);
    if (paragraphs.join("\n").length >= maxCharacters) break;
  }
  const fullText = [...new Set(paragraphs)].join("\n").slice(0, maxCharacters);
  return {
    title,
    description: paragraphs[0]?.slice(0, 1800) || "",
    fullText,
    publishedAt
  };
}

export async function extractPdfText(data, options = {}) {
  const maxPages = Math.max(1, Number(options.maxPages || 80));
  const maxCharacters = Math.max(1000, Number(options.maxCharacters || 14000));
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const task = getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const document = await task.promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, maxPages); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = cleanText(content.items.map((item) => item.str || "").join(" "));
      if (text.length >= 40) pages.push(text);
      if (pages.join("\n").length >= maxCharacters) break;
    }
  } finally {
    if (typeof document.destroy === "function") await document.destroy();
    else if (typeof task.destroy === "function") await task.destroy();
  }
  return pages.join("\n").slice(0, maxCharacters);
}
