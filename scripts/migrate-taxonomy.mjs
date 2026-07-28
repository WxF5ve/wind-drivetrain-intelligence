import { readFile, writeFile } from "node:fs/promises";
import { classifyArticle, isDomainRelevant } from "./lib/articles.mjs";

const dataPath = new URL("../public/data/articles.json", import.meta.url);
const data = JSON.parse(await readFile(dataPath, "utf8"));

const migratedArticles = (data.articles || []).map((article) => {
  const classification = classifyArticle({
    ...article,
    queryTopic: article.intelligenceType || "technical",
    contextTags: article.tags || []
  });
  return {
    ...article,
    primarySection: classification.primarySection,
    sections: classification.sections,
    componentCategory: classification.componentCategory,
    drivetrainComponent: classification.drivetrainComponent,
    drivetrainComponents: classification.drivetrainComponents,
    componentTags: classification.componentTags,
    technicalDomains: classification.technicalDomains,
    technicalTags: classification.technicalTags,
    failureModes: classification.failureModes,
    developmentStages: classification.developmentStages,
    evidenceTypes: classification.evidenceTypes,
    industryCategory: classification.industryCategory,
    informationLevel: classification.informationLevel
  };
});

data.articles = migratedArticles.filter((article) =>
  article.intelligenceType !== "technical" || isDomainRelevant(article)
);

const periodStart = new Date(data.period?.from || 0).getTime();
const periodEnd = new Date(data.period?.to || data.generatedAt || Date.now()).getTime();
const lookbackDays = Math.max(1, Math.round((periodEnd - periodStart) / 86400000));
const currentArticles = data.articles.filter((article) => new Date(article.publishedAt).getTime() >= periodStart);
const currentReadable = data.articles.filter((article) =>
  article.evidence?.contentAccess !== "metadata" && new Date(article.publishedAt).getTime() >= periodStart
);
const sectionCounts = new Map();
for (const article of currentReadable) {
  sectionCounts.set(article.primarySection, (sectionCounts.get(article.primarySection) || 0) + 1);
}
const leadingSections = [...sectionCounts.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 3)
  .map(([section]) => section);
if (data.weeklyBrief && leadingSections.length) {
  data.weeklyBrief.title = `本周聚焦：${leadingSections.join("、")}`;
  const domesticCount = currentReadable.filter((article) => article.region === "国内").length;
  const paperCount = currentReadable.filter((article) => article.sourceType === "论文").length;
  const fullTextCount = currentReadable.filter((article) => article.evidence?.contentAccess === "fulltext").length;
  const briefCount = currentArticles.filter((article) => ["brief", "catalog"].includes(article.informationLevel)).length;
  const clueCount = currentArticles.filter((article) => article.informationLevel === "lead").length;
  data.weeklyBrief.summary = currentReadable.length
    ? `过去 ${lookbackDays} 天共筛选 ${currentReadable.length} 条可读情报，其中国内 ${domesticCount} 条、论文 ${paperCount} 篇，${fullTextCount} 条已提取公开全文${briefCount ? `；另有 ${briefCount} 条题名简讯或论文题录已归入对应主栏目` : ""}${clueCount ? `，${clueCount} 条综合资讯待进一步阅读` : ""}。资料库累计保留 ${data.articles.length} 条可追溯记录。`
    : `过去 ${lookbackDays} 天未发现满足相关性阈值的新资料；资料库仍保留 ${data.articles.length} 条历史记录供检索。`;
  data.weeklyBrief.metrics = {
    total: currentReadable.length,
    domestic: domesticCount,
    overseas: currentReadable.length - domesticCount,
    papers: paperCount,
    briefs: briefCount,
    clues: clueCount
  };
  data.weeklyBrief.signals = currentReadable.slice(0, 3).map((article) => article.title);
}

data.taxonomyVersion = 4;
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已迁移 ${data.articles.length} 条情报到传动链分类体系 v${data.taxonomyVersion}`);
