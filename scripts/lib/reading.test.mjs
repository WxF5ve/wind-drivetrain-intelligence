import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReadingBrief, needsReadingBriefUpgrade, readingContent, readingHighlightSegments } from "../../public/lib/reading.mjs";
import { parseReadingBrief } from "./editorial.mjs";
import { toPublicArticle } from "./articles.mjs";

const brief = {
  version: 1,
  headline: "齿轮凸角参数影响齿根应力与啮合性能",
  paragraphs: [
    "研究采用计算模型评估刀具凸角参数与齿根应力的关系。在相同5°凸角下，凸角系数由0.01增至0.1时，应力由33.6增至40 N/mm²，重合度由1.276降至0.700。",
    "该结果来自特定齿轮算例，可用于联合校核刀具凸角、磨削余量及齿根圆角，应用时需结合实际材料和载荷谱。"
  ],
  highlights: ["40 N/mm²", "刀具凸角", "并不存在的高亮", ""]
};
const source = { title: "Gear root study", snippet: "5° 0.01 0.1 33.6 40 N/mm² 1.276 0.700 calculation", contentAccess: "fulltext" };

test("reading brief preserves paragraphs and technical boundaries with exact highlights", () => {
  const parsed = parseReadingBrief(brief, source);
  assert.equal(parsed.paragraphs.length, 2);
  assert.match(parsed.paragraphs[1], /特定齿轮算例/);
  assert.deepEqual(parsed.highlights, ["40 N/mm²", "刀具凸角"]);
  assert.equal(normalizeReadingBrief({ ...brief, version: 2 }), null);
});

test("writing examples and private feedback cannot supply numbers to a public reading brief", () => {
  assert.equal(parseReadingBrief({ ...brief, headline: "扭矩密度270 N·m/kg" }, source), null);
  assert.equal(parseReadingBrief(brief, { ...source, snippet: "Gear root stress studied", engineeringExperience: { text: source.snippet } }), null);
  assert.equal(parseReadingBrief(brief, { ...source, contentAccess: "metadata" }), null);
  assert.equal(parseReadingBrief(brief, { ...source, sourceEvidenceKind: "previous-summary" }), null);
});

test("source commentary and separate template fields do not become reading copy", () => {
  assert.equal(normalizeReadingBrief({ ...brief, paragraphs: [brief.paragraphs[0] + "关键数据：40 N/mm²。"] }), null);
  assert.equal(normalizeReadingBrief({ ...brief, paragraphs: [brief.paragraphs[0] + "该来源十分权威。"] }), null);
});

test("only a newly retrieved non-metadata source triggers editorial migration", () => {
  assert.equal(needsReadingBriefUpgrade({}, source), true);
  assert.equal(needsReadingBriefUpgrade({ readingBrief: brief }, source), false);
  assert.equal(needsReadingBriefUpgrade({}, { ...source, contentAccess: "metadata" }), false);
  assert.equal(needsReadingBriefUpgrade({}, { ...source, snippet: "" }), false);
});

test("legacy articles remain readable without regenerating claims or duplicating a paragraph", () => {
  const legacy = { title: "原题", summary: "保持原始摘要。", engineeringImpact: "保持原始摘要。" };
  assert.deepEqual(readingContent(legacy).paragraphs, ["保持原始摘要。"]);
  assert.equal(readingContent({ ...legacy, readingBrief: brief }).version, 1);
  assert.equal(readingContent({ ...legacy, readingBrief: brief, evidence: { contentAccess: "metadata" } }).version, 0);
});

test("inline highlighting keeps numerical units, text, emoji, and HTML unmodified", () => {
  const body = "试验🧪应力40 N/mm²，扭矩密度270 N·m/kg，准确率95%，42CrMo4材料。<img src=x>刀具凸角";
  const segments = readingHighlightSegments(body, { highlights: ["刀具凸角"] });
  assert.equal(segments.map((segment) => segment.text).join(""), body);
  assert.deepEqual(segments.filter((segment) => segment.role === "data").map((segment) => segment.text), ["40 N/mm²", "270 N·m/kg", "95%"]);
});

test("public export keeps the validated reading brief but never its source excerpt", () => {
  const article = toPublicArticle({ ...source, id: "test", source: "test", sourceType: "论文", publishedAt: "2026-10-15T00:00:00Z", url: "https://example.com" }, {
    summary: brief.paragraphs[0], readingBrief: brief
  });
  assert.equal(article.readingBrief.paragraphs.length, 2);
  assert.equal(article.snippet, undefined);
  assert.equal(toPublicArticle({ ...source, contentAccess: "metadata" }, { readingBrief: brief }).readingBrief, null);
});
