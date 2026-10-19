export const READING_BRIEF_VERSION = 1;

const text = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const FIELD_LABEL = /(?:关键数据|关键点|工程意义|时间节点|项目容量|信息来源)[：:]/;
const SOURCE_COMMENTARY = /(?:来源|渠道|媒体).{0,12}(?:权威|可靠|级别)|(?:信息|资料)(?:有限|不足)|未(?:披露|提供|说明|给出)/;

export function normalizeReadingBrief(value) {
  if (!value || value.version !== READING_BRIEF_VERSION || !Array.isArray(value.paragraphs)) return null;
  const headline = text(value.headline);
  const paragraphs = value.paragraphs.map(text).filter(Boolean);
  const body = paragraphs.join(" ");
  if (!headline || headline.length > 150 || paragraphs.length < 1 || paragraphs.length > 2 ||
      body.length < 40 || body.length > 1200 || FIELD_LABEL.test(body) || SOURCE_COMMENTARY.test(body)) return null;
  const highlights = [...new Set((Array.isArray(value.highlights) ? value.highlights : []).map(text))]
    .filter((term) => term.length >= 2 && term.length <= 48 && body.includes(term)).slice(0, 8);
  return { version: READING_BRIEF_VERSION, headline, paragraphs, highlights };
}

export function needsReadingBriefUpgrade(existing, source) {
  return Boolean(source?.snippet && source.contentAccess !== "metadata" && source.sourceEvidenceKind !== "previous-summary" &&
    !normalizeReadingBrief(existing?.readingBrief));
}

// These legacy paragraphs are only displayed, never treated as new source evidence.
export function readingContent(article, cleanLegacy = text) {
  const metadataOnly = (article.contentAccess || article.evidence?.contentAccess) === "metadata";
  const brief = metadataOnly ? null : normalizeReadingBrief(article.readingBrief);
  if (brief) return brief;
  const summary = text(cleanLegacy(article.summary));
  const impact = text(cleanLegacy(article.engineeringImpact));
  const signature = (value) => value.replace(/[\s\p{P}]/gu, "");
  const first = signature(summary);
  const second = signature(impact);
  const paragraphs = summary ? [summary] : [];
  if (!metadataOnly && second && !first.includes(second) && !second.includes(first)) paragraphs.push(impact);
  return { version: 0, headline: text(article.titleZh || article.title), paragraphs, highlights: [] };
}

export function readingHighlightSegments(value, { highlights = [], technologies = [], organizations = [] } = {}) {
  const narrative = String(value || "");
  const roles = Array(narrative.length).fill("body");
  const apply = (start, length, role) => {
    for (let index = start; index < start + length; index += 1) {
      if (roles[index] === "body") roles[index] = role;
    }
  };
  // Keep units with values; avoid coloring digits embedded in a model/material name.
  const quantities = /(?<![A-Za-z0-9])\d+(?:[,.]\d+)*(?:\s*[~～–-]\s*\d+(?:\.\d+)?)?\s*(?:N[·.\s]?m\/kg|Nm\/kg|N\/mm[²2]|MPa|GPa|kN[·.\s]?m|N[·.\s]?m|MW|GW|kW|kN|rpm|r\/min|mm|μm|µm|万元|亿元|万千瓦|千瓦|兆瓦|个百分点|%|％|°C|℃|°|倍|台|套|小时|个|项)(?![A-Za-z])/giu;
  for (const match of narrative.matchAll(quantities)) apply(match.index, match[0].length, "data");
  for (const [terms, role] of [[highlights, "technology"], [technologies, "technology"], [organizations, "organization"]]) {
    for (const term of [...new Set(terms.map(text).filter((item) => item.length >= 2))].sort((a, b) => b.length - a.length).slice(0, 12)) {
      let start = narrative.indexOf(term);
      if (start >= 0) apply(start, term.length, role);
    }
  }
  const segments = [];
  // UTF-16 indexing matches RegExp.index, including text containing astral characters.
  for (let index = 0; index < narrative.length; index += 1) {
    const previous = segments.at(-1);
    if (previous?.role === roles[index]) previous.text += narrative[index];
    else segments.push({ text: narrative[index], role: roles[index] });
  }
  return segments;
}
