import { readFile, writeFile } from "node:fs/promises";
import { classifyArticle } from "./lib/articles.mjs";

const dataPath = new URL("../public/data/articles.json", import.meta.url);
const data = JSON.parse(await readFile(dataPath, "utf8"));

data.articles = (data.articles || []).map((article) => {
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
    industryCategory: classification.industryCategory
  };
});

const periodStart = new Date(data.period?.from || 0).getTime();
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
}

data.taxonomyVersion = 2;
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已迁移 ${data.articles.length} 条情报到传动链分类体系 v${data.taxonomyVersion}`);
