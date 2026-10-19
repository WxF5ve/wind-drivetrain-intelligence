import { isAllowedPublisherUrl } from "./sources.mjs";

const REUSED = {
  secwind: ["web-cn-wind-oems"], goldwind: ["web-cn-wind-oems"], mingyang: ["web-cn-wind-oems"],
  vestas: ["web-global-wind-oems"], siemens_gamesa: ["web-global-wind-oems"], ge_vernova: ["web-global-wind-oems"],
  skf: ["web-global-bearing-suppliers"], schaeffler: ["web-global-bearing-suppliers"],
  cnea_wind: ["web-cwea-drivetrain"], iop: ["web-iop-science-drivetrain"],
  google_patents: ["web-cn-drivetrain-patents", "web-global-drivetrain-patents"]
};
const JOURNAL_TERMS = {
  ieee_iot: '"Internet of Things"', mdpi_machines: '"Machines"', mdpi_energies: '"Energies"',
  mdpi_sensors: '"Sensors"', mdpi_lubricants: '"Lubricants"', emerald_ilt: '"Industrial Lubrication and Tribology"',
  wiley_qre: '("Quality and Reliability Engineering" OR bearing OR gearbox)',
  elsevier_mech: '("Mechanical Systems and Signal Processing" OR "Tribology" OR "Wear" OR "Engineering Applications of Artificial Intelligence")',
  oae_ir: '"Intelligence" "Robotics"'
};
const JOURNAL_NAMES = {
  mdpi_machines: ["Machines"], mdpi_energies: ["Energies"], mdpi_sensors: ["Sensors"], mdpi_lubricants: ["Lubricants"],
  ieee_iot: ["IEEE Internet of Things Journal"], emerald_ilt: ["Industrial Lubrication and Tribology"],
  elsevier_mech: ["Mechanical Systems and Signal Processing", "Tribology International", "Wear", "Engineering Applications of Artificial Intelligence"],
  oae_ir: ["Intelligence & Robotics", "Intelligence and Robotics"]
};

export function registryPlan(registry, config) {
  const existingIds = new Set([...(config.webQueries || []), ...(config.newsQueries || [])].map((s) => s.id));
  return registry.sources.map((entry) => {
    const domains = [...new Set(entry.urls.map((url) => new URL(url).hostname.replace(/^www\./, "")))];
    if (entry.id === "windey") domains.push("windeyenergy.com");
    if (entry.id === "nrel") domains.push("nrel.gov");
    let channelIds = (REUSED[entry.id] || []).filter((id) => existingIds.has(id));
    if (entry.id === "crossref") channelIds = (config.researchQueries || [])
      .filter((s) => (s.providers || ["openalex", "crossref"]).includes("crossref")).map((s) => `${s.id}-crossref`);
    const isPaper = entry.group === "学术与数据";
    const isPatent = entry.group === "知识产权";
    const isStandard = entry.group === "标准与规则";
    const isIndustry = ["企业与产品", "公告与投资披露", "采购与现场运维"].includes(entry.group);
    const cn = entry.region === "国内";
    const terms = cn
      ? '(风电 OR 风力发电) (齿轮箱 OR 齿轮 OR 轴承 OR 主轴 OR 传动链 OR 变桨 OR 润滑 OR 检修)'
      : '("wind turbine" OR "wind energy") (gearbox OR bearing OR drivetrain OR gear OR shaft OR lubrication OR maintenance)';
    const searchTerms = `${JOURNAL_TERMS[entry.id] || ""} ${terms}`.trim();
    const source = channelIds.length ? null : {
      id: `registry-${entry.id}`, label: entry.name, collector: "domain-news", searchTerms,
      query: `site:${domains[0]} ${searchTerms}`, allowedDomains: domains,
      language: cn ? "Chinese" : "English", region: entry.region,
      topic: entry.id === "bid_aggregators" ? "technical" : isIndustry ? "industry" : "technical",
      sourceType: isPaper ? "论文" : isPatent ? "专利" : isStandard ? "标准" : isIndustry ? "行业资讯" : "技术资料",
      contextTags: [entry.group], directSource: entry.id !== "bid_aggregators", maxRecords: 4,
      strictDate: true, registryId: entry.id, leadOnly: entry.id === "bid_aggregators", allowedJournals: JOURNAL_NAMES[entry.id] || []
    };
    if (source) channelIds = [source.id];
    return { ...entry, domains, channelIds, source };
  });
}

export function registryCoverage(plan, channels, articles, checkedAt) {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  return plan.map((entry) => {
    const results = entry.channelIds.map((id) => byId.get(id)).filter(Boolean);
    // A shared channel's HTTP success is not evidence that this particular publisher yielded an article.
    const matched = results.some((r) => r.requestStatus === "ok") ? articles.filter((a) => {
      if (entry.id === "crossref") return a.sourceChannel === "Crossref";
      const journals = JOURNAL_NAMES[entry.id];
      if (journals) return journals.some((name) => name.toLowerCase() === String(a.evidence?.journal || a.source || "").toLowerCase());
      return [a.url, a.sourceUrl].some((url) => isAllowedPublisherUrl(url, entry.domains));
    }) : [];
    const readable = matched.filter((a) => a.evidence?.contentAccess && a.evidence.contentAccess !== "metadata").length;
    return {
      id: entry.id, name: entry.name, group: entry.group, urls: entry.urls,
      referenceStatus: entry.referenceStatus, channelIds: entry.channelIds,
      status: !results.length ? "pending" : matched.length ? "productive" :
        results.every((r) => r.requestStatus === "failed") ? "failed" : "searched",
      matched: matched.length, readable, checkedAt: results.length ? checkedAt : null
    };
  });
}

export function isVerifiedRecent(article, start, end) {
  const date = new Date(article.publishedAt).getTime();
  return !article.evidence?.publishedDateEstimated && Number.isFinite(date) && date >= start && date <= end;
}

export function registryPublicationDate(metadata, url) {
  const raw = String(metadata.publishedAt || "").trim().replace(/年|月/g, "-").replace(/日/g, "");
  if (/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:$|[T\s])/.test(raw) && Number.isFinite(Date.parse(raw))) return new Date(raw).toISOString();
  // These publishers encode the publication day in their article permalink, not a crawl date.
  if (isAllowedPublisherUrl(url, ["ngctransmission.com", "ngcgears.com", "csscbidding.com"])) {
    const match = new URL(url).pathname.match(/\/(20\d{2})(\d{2})(\d{2})(?=\d{0,2}\.html|\/)/);
    if (match) {
      const date = `${match[1]}-${match[2]}-${match[3]}T00:00:00Z`;
      if (Number.isFinite(Date.parse(date))) return date;
    }
  }
  return "";
}

export function isRegistryDrivetrainArticle(article) {
  const parts = /齿轮|轴承|主轴|传动|行星架|联轴器|变桨|偏航|润滑|gearbox|\bgear\b|bearing|drivetrain|transmission|main shaft|coupling|pitch drive|lubrication/i;
  if (/道路|塔筒|叶片|\b(?:road|tower|blade)s?\b/i.test(article.title) && !parts.test(article.title)) return false;
  return parts.test(`${article.title} ${String(article.snippet || "").slice(0, 1500)}`);
}

export async function runRegistryJobs(jobs, concurrency = 2) {
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      try { results[index] = { status: "fulfilled", value: await jobs[index].run() }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}
