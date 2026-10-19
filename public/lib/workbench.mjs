export const COMPONENT_NODES = [
  { name: "主轴", icon: "move-horizontal", lane: "main" },
  { name: "主轴承", icon: "circle-dot", lane: "main" },
  { name: "齿轮箱", icon: "settings", lane: "main" },
  { name: "联轴器", icon: "link", lane: "main" },
  { name: "发电机", icon: "zap", lane: "main" },
  { name: "齿轮", icon: "cog", lane: "gearbox" },
  { name: "齿轮箱轴承", icon: "circle-dot", lane: "gearbox" },
  { name: "行星架", icon: "orbit", lane: "gearbox" },
  { name: "箱体", icon: "box", lane: "gearbox" },
  { name: "滑动轴承", icon: "disc-3", lane: "gearbox" },
  { name: "锁紧盘", icon: "disc", lane: "support" },
  { name: "润滑系统", icon: "droplets", lane: "support" },
  { name: "冷却与密封", icon: "thermometer", lane: "support" },
  { name: "制动器", icon: "octagon-pause", lane: "support" },
  { name: "变桨齿轮箱", icon: "rotate-3d", lane: "support" }
];

export function safeWebUrl(value) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}

export function withinWindow(article, end, days) {
  const date = new Date(article.publishedAt).getTime();
  const until = new Date(end).getTime();
  return !article.evidence?.publishedDateEstimated && Number.isFinite(date) && date <= until && date >= until - days * 86400000;
}

export function isReadable(article) {
  return article.informationLevel === "readable" && ["abstract", "fulltext"].includes(article.evidence?.contentAccess);
}

export function scopeArticles(articles, { end, days = 7, component = "全部部件", components, readableOnly = false }) {
  return articles.filter((article) => article.informationLevel !== "ignored" && withinWindow(article, end, days) &&
    (!readableOnly || isReadable(article)) && (component === "全部部件" || components(article).includes(component)))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || a.id.localeCompare(b.id));
}

export function commonComponents(articles, components) {
  if (!articles.length) return [];
  return components(articles[0]).filter((value) => articles.every((article) => components(article).includes(value)));
}

export function addComparison(selected, candidate, components) {
  if (selected.some((a) => a.id === candidate.id)) return { items: selected.filter((a) => a.id !== candidate.id) };
  if (!isReadable(candidate)) return { items: selected, error: "仅可对照已有正文摘要的资料" };
  if (selected.length >= 4) return { items: selected, error: "最多同时对照4条资料" };
  if (selected.length && !commonComponents([...selected, candidate], components).length) {
    return { items: selected, error: "请选择至少有一个相同部件标签的资料" };
  }
  return { items: [...selected, candidate] };
}

const compact = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((s) => s.trim()))];

export function comparisonFields(article) {
  const paper = article.paperDetails || {};
  const industry = article.industryDetails || {};
  const findings = (paper.quantitativeFindings || []).map((q) => ({
    label: q.metric || "", value: `${q.value || ""}${q.unit || ""}`,
    context: compact([q.comparison, q.conditions]).join("；")
  }));
  const facts = (industry.quantitativeFacts || []).map((q) => typeof q === "string"
    ? { label: "", value: q, context: "" }
    : { label: q.metric || q.label || "", value: `${q.value || ""}${q.unit || ""}`, context: q.context || q.conditions || "" });
  return {
    object: paper.testObject || industry.companies?.join("、") || "",
    method: paper.methods || compact(article.technicalTags || []).join("、"),
    process: compact([...(article.technicalTags || []), ...(article.tags || [])]).filter((s) => /材料|Cr|钢|铸|淬火|渗碳|磨削|喷丸|热处理|涂层|表面/.test(s)).join("、"),
    conditions: paper.operatingConditions || article.aiWind?.evidenceScope || "",
    stage: compact([...(article.developmentStages || []), ...(article.evidenceTypes || []), industry.eventType || ""]).join("、"),
    findings: [...findings, ...facts].filter((q) => q.value),
    implication: article.engineeringImpact || ""
  };
}

export function presentationArticles(articles, options) {
  const priority = (article) => ["传动链技术开发与质量运维", "论文、标准与专利"].includes(article.primarySection) ? 2 : article.primarySection === "厂商与项目动态" ? 1 : 0;
  const candidates = scopeArticles(articles, { ...options, readableOnly: true })
    .sort((a, b) => priority(b) - priority(a) || new Date(b.publishedAt) - new Date(a.publishedAt));
  const buckets = new Map();
  for (const article of candidates) {
    const key = options.components(article)[0] || "传动链整体";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(article);
  }
  // Select across components, then keep each component's articles together in the deck.
  const chosen = [];
  for (let round = 0; chosen.length < 6 && round < 6; round++) {
    for (const bucket of buckets.values()) {
      if (bucket[round] && chosen.length < 6) chosen.push(bucket[round]);
    }
  }
  const order = new Map([...buckets.keys()].map((key, index) => [key, index]));
  return chosen.sort((a, b) => order.get(options.components(a)[0] || "传动链整体") - order.get(options.components(b)[0] || "传动链整体"));
}
