import { parse } from "node-html-parser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { cleanText } from "./articles.mjs";

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
    await document.destroy();
  }
  return pages.join("\n").slice(0, maxCharacters);
}
