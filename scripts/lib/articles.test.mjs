import test from "node:test";
import assert from "node:assert/strict";
import {
  assessReliability,
  classifyArticle,
  cleanText,
  createFallbackSummary,
  deduplicateArticles,
  feedbackCalibration,
  inferCategory,
  inferDrivetrainClassification,
  inferAiWindClassification,
  inferTags,
  informationLevel,
  isDomainRelevant,
  isOfficialRelevant,
  isIndustryRelevant,
  normalizeUrl,
  recalibratePublishedArticle,
  relevanceScore,
  resolveNewsUrl
} from "./articles.mjs";

test("AI wind drivetrain classification captures methods, datasets, and evidence scope", () => {
  const classification = inferAiWindClassification({
    title: "Source-free domain adaptation for cross-domain wind turbine bearing diagnosis",
    summary: "DPR-PLO combines dynamic prototype alignment and pseudo-label optimization on PU, JNU and a self-collected dataset.",
    keyPoints: ["18 cross-condition tasks", "97.56% average accuracy"],
    paperDetails: { operatingConditions: "18个跨工况任务" }
  });
  assert.equal(classification.relevant, true);
  assert.equal(classification.categories.includes("C3"), true);
  assert.equal(classification.categories.includes("C12"), true);
  assert.equal(classification.methods.includes("无源域自适应"), true);
  assert.deepEqual(classification.datasets, ["PU", "JNU", "自采数据集"]);
  assert.equal(classification.evidenceScope, "18个跨工况任务");
});

test("generic wind AI without a drivetrain object is excluded from the derived column", () => {
  const classification = inferAiWindClassification({
    title: "AI optimizes wind turbine blade inspection",
    summary: "A vision model identifies coating damage on blades."
  });
  assert.equal(classification.relevant, false);
  assert.deepEqual(classification.categories, []);
});

const reliabilityConfig = {
  authorityDomains: {
    primary: ["nrel.gov", "energy.gov"],
    industry: ["dnv.com", "skf.com"],
    media: ["qq.com", "sina.com.cn"]
  },
  minimumFeedback: 5
};

test("cleanText removes markup and compacts whitespace", () => {
  assert.equal(cleanText("<p>齿轮箱&nbsp; 轴承</p>"), "齿轮箱 轴承");
});

test("normalizeUrl removes tracking parameters", () => {
  assert.equal(
    normalizeUrl("https://example.com/report?id=1&utm_source=mail#chapter"),
    "https://example.com/report?id=1"
  );
});

test("resolveNewsUrl extracts the publisher URL from Bing RSS links", () => {
  const bingUrl =
    "https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fwind-report%3Futm_source%3Dbing";
  assert.equal(resolveNewsUrl(bingUrl), "https://example.com/wind-report");
});

test("fallback summary explains when an index has no usable abstract", () => {
  const summary = createFallbackSummary({
    title: "Wind turbine drivetrain health monitoring",
    snippet: "Abstract.",
    source: "OpenAlex",
    sourceType: "论文",
    region: "海外",
    publishedAt: "2026-07-06T00:00:00Z"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("fallback summary does not present a repeated title as an abstract", () => {
  const summary = createFallbackSummary({
    title: "Wind turbine gearbox reliability update",
    snippet: "Wind turbine gearbox reliability update",
    source: "Publisher",
    sourceType: "行业资讯",
    region: "海外"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("fallback summary rejects a title followed only by a publisher name", () => {
  const summary = createFallbackSummary({
    title: "风电齿轮箱行业更新与轴承趋势",
    snippet: "风电齿轮箱行业更新与轴承趋势 某新闻网站",
    source: "某新闻网站",
    sourceType: "行业资讯",
    region: "国内"
  });
  assert.match(summary.summary, /未提供可用摘要/);
});

test("deduplicateArticles removes matching URLs and titles", () => {
  const articles = [
    { title: "Wind gearbox bearing study", url: "https://example.com/a?utm_source=x" },
    { title: "Another title", url: "https://example.com/a" },
    { title: "Wind gearbox bearing study", url: "https://example.com/b" }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("deduplicateArticles merges coverage of the same manufacturer event", () => {
  const articles = [
    {
      title: "Nordex secures three wind turbine orders in the United States totaling 484 MW",
      url: "https://example.com/one",
      queryTopic: "industry",
      publishedAt: "2026-07-01T00:00:00Z"
    },
    {
      title: "Nordex Group secures new US orders totalling 484 MW",
      url: "https://example.org/two",
      queryTopic: "industry",
      publishedAt: "2026-07-01T08:00:00Z"
    }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("deduplicateArticles merges same-capacity coverage with different locations wording", () => {
  const articles = [
    {
      title: "Vestas secures 40 MW wind turbine order for Reken Hulsterholt project in Germany",
      url: "https://example.com/one",
      queryTopic: "industry",
      matchTerms: ["Vestas"],
      publishedAt: "2026-07-01T00:00:00Z"
    },
    {
      title: "Vestas wins 40-MW wind turbine order in North Rhine-Westphalia",
      url: "https://example.org/two",
      queryTopic: "industry",
      matchTerms: ["Vestas"],
      publishedAt: "2026-07-02T00:00:00Z"
    }
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test("deduplicateArticles keeps distinct tenders with different capacities", () => {
  const articles = [
    { title: "中标：1261.5MW风电项目开标", url: "https://example.com/a", queryTopic: "industry" },
    { title: "中标：643.25MW风电项目公示", url: "https://example.com/b", queryTopic: "industry" }
  ];
  assert.equal(deduplicateArticles(articles).length, 2);
});

test("relevance and category recognize drivetrain terms", () => {
  const article = { title: "Wind turbine gearbox bearing condition monitoring", snippet: "" };
  const score = relevanceScore(article, { "wind turbine": 2, gearbox: 4, bearing: 4 });
  assert.equal(score, 10);
  assert.equal(inferCategory(article), "状态监测");
  assert.equal(isDomainRelevant(article), true);
  assert.equal(
    isDomainRelevant({ title: "Elevator bearing fault diagnosis", snippet: "" }),
    false
  );
  assert.equal(
    isDomainRelevant({ title: "润滑油市场被 AI、储能和风电重塑", snippet: "" }),
    false
  );
  assert.equal(
    isDomainRelevant({ title: "风机齿轮箱润滑状态监测", snippet: "" }),
    true
  );
});

test("drivetrain taxonomy recognizes manufacturing, quality, bearing, simulation, and structure topics", () => {
  const cases = [
    ["风电齿轮感应淬火与强化喷丸残余压应力研究", ["感应淬火", "喷丸强化"]],
    ["风电轴承跑圈、套圈蠕动与过盈配合分析", ["轴承跑圈与配合"]],
    ["Wind turbine gearbox vibration NVH and resonance investigation", ["齿轮箱振动", "模态与共振"]],
    ["AVL EXCITE and Romax simulation for a wind turbine drivetrain", ["AVL EXCITE", "Romax/MASTA/KISSsoft"]],
    ["风电齿轮箱行星架强度、变形及拓扑优化", ["行星架强度", "有限元与疲劳"]],
    ["Hydrodynamic tilting pad plain bearing development for wind turbine drivetrains", ["滑动轴承开发"]],
    ["风电整机齿轮箱轻量化与变桨齿轮箱开发", ["齿轮箱开发与轻量化", "变桨传动"]],
    ["Wind turbine gearbox tooth root bending fatigue strength of 42CrMo4 steel", ["齿轮强度", "齿根弯曲疲劳", "材料与表面工程"]],
    ["Machine learning diagnosis for wind turbine gearbox failures", ["AI辅助设计", "故障诊断与PHM"]],
    ["风电主轴开裂与锁紧盘连接失效分析", ["锁紧盘与连接", "主轴裂纹与断裂"]]
  ];
  for (const [title, expectedTags] of cases) {
    const result = inferDrivetrainClassification({ title });
    expectedTags.forEach((tag) => assert.equal(result.technicalTags.includes(tag), true, `${title} should include ${tag}`));
  }
});

test("query context tags do not create false drivetrain classifications", () => {
  const bladeArticle = {
    title: "Scientists built wind turbine blades 80% lighter using 4D printing",
    snippet: "The report concerns blade material development.",
    contextTags: ["齿轮箱架构", "变桨传动", "AI辅助诊断"]
  };
  const classification = inferDrivetrainClassification(bladeArticle);
  assert.deepEqual(classification.technicalTags, []);
  assert.equal(isDomainRelevant(bladeArticle), false);
  assert.equal(relevanceScore(bladeArticle, { gearbox: 4, "pitch gearbox": 4 }), 0);
});

test("every intelligence item receives a primary component classification", () => {
  const cases = [
    ["风电行星架与内齿圈均载分析", "行星级"],
    ["10 MW 风机主轴承载荷与跑圈研究", "主轴系统"],
    ["风电齿轮箱高速轴与平行轴级振动", "平行轴级"],
    ["风电联轴器、锁紧盘和花键连接设计", "轴系连接"],
    ["齿轮箱润滑冷却系统与密封漏油治理", "润滑冷却与密封"],
    ["Wind turbine gearbox housing and torque arm deformation", "箱体与支承"],
    ["Wind turbine pitch gearbox and pitch drive reliability test", "变桨传动"]
  ];
  for (const [title, expected] of cases) {
    assert.equal(classifyArticle({ title, sourceType: "论文" }).componentCategory, expected);
  }
  assert.equal(classifyArticle({
    title: "国家发布年度风电装机统计",
    queryTopic: "official",
    sourceType: "行业资讯"
  }).componentCategory, "行业综合");
  assert.equal(classifyArticle({
    title: "某整机企业发布海外项目进展",
    queryTopic: "industry",
    sourceType: "行业资讯"
  }).componentCategory, "行业综合");
});

test("section classification assigns exactly one primary section", () => {
  const supplierProgress = classifyArticle({
    title: "某风电齿轮箱企业完成感应淬火与喷丸工艺验证",
    queryTopic: "industry",
    sourceType: "行业资讯",
    contextTags: ["齿轮箱厂商"]
  });
  assert.deepEqual(supplierProgress.sections, ["厂商与项目动态"]);
  assert.equal(supplierProgress.primarySection, "厂商与项目动态");
  assert.equal(supplierProgress.industryCategory, "传动链企业");
  assert.equal(supplierProgress.technicalTags.includes("感应淬火"), true);

  const policy = classifyArticle({
    title: "国家能源局发布年度风电装机规划",
    queryTopic: "official",
    sourceType: "行业资讯"
  });
  assert.deepEqual(policy.sections, ["政策、市场与产业环境"]);

  const genericProject = classifyArticle({
    title: "某地200MW风电项目完成并网",
    summary: "该项目可能带动齿轮箱和轴承需求。",
    engineeringImpact: "可关注传动链供应链机会。",
    queryTopic: "industry",
    sourceType: "行业资讯"
  });
  assert.deepEqual(genericProject.sections, ["厂商与项目动态"]);
  assert.equal(genericProject.industryCategory, "项目进展");

  const paper = classifyArticle({
    title: "Wind power market overview",
    sourceType: "论文"
  });
  assert.deepEqual(paper.sections, ["论文、标准与专利"]);

  const failureCase = classifyArticle({
    title: "风电齿轮箱轴承跑圈故障案例与现场维修",
    sourceType: "行业资讯"
  });
  assert.deepEqual(failureCase.sections, ["传动链技术开发与质量运维"]);
  assert.equal(failureCase.failureModes.includes("轴承跑圈"), true);
  assert.equal(failureCase.developmentStages.includes("运维与技改"), true);
});

test("metadata records are separated into topical briefs, catalogs, leads, and noise", () => {
  assert.equal(informationLevel({
    title: "华能乾安四海20万千瓦风电项目全容量并网投产",
    sourceType: "行业资讯",
    evidence: { contentAccess: "metadata" }
  }), "brief");
  assert.equal(informationLevel({
    title: "Wind turbine gearbox bearing degradation assessment",
    sourceType: "论文",
    evidence: { contentAccess: "metadata" }
  }), "catalog");
  assert.equal(informationLevel({
    title: "风电产业观察",
    sourceType: "行业资讯",
    evidence: { contentAccess: "metadata" }
  }), "lead");
  assert.equal(informationLevel({
    title: "陆上风电项目经理招聘 1.8-5.5万",
    sourceType: "行业资讯",
    evidence: { contentAccess: "metadata" }
  }), "ignored");
  assert.equal(informationLevel({
    title: "风电齿轮箱试验",
    sourceType: "技术资料",
    evidence: { contentAccess: "fulltext" }
  }), "readable");
});

test("WECS is not mislabeled as a white etching crack acronym", () => {
  const tags = inferTags({
    title: "Torsional vibrations in wind energy conversion systems (WECS)",
    snippet: "Wind turbine shaft vibration control"
  });
  assert.equal(tags.includes("白色蚀刻裂纹"), false);
  assert.equal(tags.includes("状态监测"), true);
});

test("manufacturer intelligence keeps its own category and context tags", async () => {
  const { toPublicArticle } = await import("./articles.mjs");
  const article = toPublicArticle({
    title: "Vestas announces a new offshore wind order",
    snippet: "Vestas announced a new offshore wind turbine order and manufacturing expansion.",
    source: "Publisher",
    sourceType: "行业资讯",
    sourceChannel: "Google News RSS",
    queryTopic: "industry",
    contextTags: ["整机厂商", "海外"],
    region: "海外",
    url: "https://example.com/vestas",
    linkType: "publisher"
  }, createFallbackSummary({
    title: "Vestas announces a new offshore wind order",
    snippet: "Vestas announced a new offshore wind turbine order and manufacturing expansion.",
    source: "Publisher",
    sourceType: "行业资讯",
    queryTopic: "industry",
    contextTags: ["整机厂商"],
    region: "海外"
  }));
  assert.equal(article.category, "厂商动态");
  assert.equal(article.intelligenceType, "industry");
  assert.equal(article.tags.includes("整机厂商"), true);
});

test("manufacturer intelligence requires exact entities, wind context, and progress", () => {
  assert.equal(isIndustryRelevant({
    title: "Vestas secures a 200 MW order",
    snippet: "New turbine delivery for an offshore wind project.",
    queryTopic: "industry",
    matchTerms: ["Vestas"],
    contextTags: ["整机厂商"]
  }), true);
  assert.equal(isIndustryRelevant({
    title: "NTN satellite transmission milestone",
    snippet: "A 3GPP communications test.",
    queryTopic: "industry",
    matchTerms: ["NTN"],
    contextTags: ["轴承厂商"]
  }), false);
  assert.equal(isIndustryRelevant({
    title: "Timken India secures bearing licenses",
    snippet: "Industrial bearing certification update.",
    queryTopic: "industry",
    matchTerms: ["Timken"],
    contextTags: ["轴承厂商"]
  }), false);
  assert.equal(isIndustryRelevant({
    title: "Hawaiian Electric orders aeroderivative turbine packages",
    snippet: "The project will support a conventional power plant.",
    queryTopic: "industry",
    directSource: true,
    contextTags: ["整机厂商"]
  }), false);
});

test("official domestic channels require wind context and keep the publisher domain constrained", () => {
  assert.equal(isOfficialRelevant({
    title: "国家能源局发布海上风电并网项目进展",
    snippet: "项目容量达到 500MW，相关风电装备建设持续推进。",
    queryTopic: "official",
    url: "https://www.nea.gov.cn/example",
    allowedDomains: ["nea.gov.cn"]
  }), true);
  assert.equal(isOfficialRelevant({
    title: "风电项目最新规划",
    snippet: "公开消息来自非指定域名。",
    queryTopic: "official",
    url: "https://example.com/wind",
    allowedDomains: ["nea.gov.cn"]
  }), false);
  assert.equal(isOfficialRelevant({
    title: "国家能源局发布能源政策",
    snippet: "内容仅涉及水电和光伏。",
    queryTopic: "official",
    url: "https://www.nea.gov.cn/example",
    allowedDomains: ["nea.gov.cn"]
  }), false);
});

test("public articles expose provenance without carrying source snippets", async () => {
  const { toPublicArticle } = await import("./articles.mjs");
  const article = toPublicArticle(
    {
      title: "Wind turbine gearbox reliability update",
      snippet: "A short source excerpt.",
      source: "Publisher",
      sourceType: "行业资讯",
      region: "海外",
      url: "https://example.com/article?utm_source=rss",
      sourceUrl: "https://example.com/",
      sourceChannel: "Google News RSS",
      linkType: "publisher",
      engineeringExperience: {
        total: 2,
        writtenTotal: 2,
        latestInsightAt: "2026-07-20T09:00:00Z",
        insights: [{ text: "这段工程心得只能提供给受保护的模型复核流程。" }]
      }
    },
    {
      summary: "可核查摘要",
      keyPoints: ["来源明确"],
      engineeringImpact: "需要结合机型验证",
      category: "齿轮箱",
      tags: ["齿轮箱"]
    }
  );
  assert.equal(article.url, "https://example.com/article");
  assert.equal(article.sourceChannel, "Google News RSS");
  assert.equal(article.linkType, "publisher");
  assert.equal("snippet" in article, false);
  assert.equal(article.engineeringExperience.writtenTotal, 2);
  assert.equal("insights" in article.engineeringExperience, false);
  assert.equal("latestInsightAt" in article.engineeringExperience, false);
  assert.equal(typeof article.reliability.score, "number");
});

test("paper metadata and quantitative findings are normalized for public display", async () => {
  const { toPublicArticle } = await import("./articles.mjs");
  const article = toPublicArticle({
    title: "Wind turbine bearing study",
    snippet: "A detailed public abstract for a wind turbine bearing study.",
    source: "Journal of Testing",
    sourceType: "论文",
    region: "海外",
    url: "https://doi.org/10.1000/test",
    evidence: {
      journal: "Journal of Testing",
      authors: ["A. Engineer", "B. Researcher"],
      issnL: "1234-5678",
      sourceMetrics: { provider: "OpenAlex", twoYearMeanCitedness: 3.2, hIndex: 45 }
    }
  }, {
    titleZh: "风电轴承研究",
    summary: "公开摘要总结",
    keyPoints: ["要点一", "要点二", "要点三"],
    engineeringImpact: "需要结合现场工况验证工程适用性。",
    category: "学术论文",
    tags: ["轴承", "论文"],
    paperDetails: {
      objective: "研究轴承故障",
      quantitativeFindings: [{ metric: "准确率", value: "95", unit: "%", evidence: "摘要" }]
    }
  });
  assert.equal(article.titleZh, "风电轴承研究");
  assert.equal(article.evidence.authors.length, 2);
  assert.equal(article.evidence.sourceMetrics.twoYearMeanCitedness, 3.2);
  assert.equal(article.paperDetails.quantitativeFindings[0].unit, "%");
});

test("peer-reviewed DOI records score above unsupported company claims", () => {
  const paper = assessReliability({
    title: "Wind turbine gearbox vibration study",
    snippet: "A detailed abstract describing methods, datasets, validation, limitations, and measured results for a wind turbine drivetrain experiment.".repeat(2),
    source: "Scientific Reports",
    sourceType: "论文",
    sourceChannel: "OpenAlex",
    publishedAt: new Date().toISOString(),
    url: "https://doi.org/10.1000/example",
    linkType: "publisher",
    linkVerified: true,
    evidence: { doi: "https://doi.org/10.1000/example", hasAbstract: true, publicationType: "article" }
  }, reliabilityConfig);
  const claim = assessReliability({
    title: "公司表示主要产品涵盖风电主轴轴承",
    snippet: "",
    source: "腾讯新闻",
    sourceType: "行业资讯",
    sourceChannel: "Google News RSS",
    publishedAt: new Date().toISOString(),
    url: "https://news.qq.com/example",
    linkType: "publisher",
    linkVerified: true
  }, reliabilityConfig);
  assert.ok(paper.score >= 80);
  assert.ok(claim.score < paper.score);
  assert.match(claim.limitations.join(" "), /企业自述/);
});

test("small feedback samples do not change reliability", () => {
  const base = {
    title: "Wind turbine gearbox report",
    snippet: "A sufficiently detailed publisher description with methods and stated limitations for engineering review.",
    source: "Technical publisher",
    sourceType: "行业资讯",
    sourceChannel: "RSS",
    publishedAt: new Date().toISOString(),
    url: "https://example.com/report",
    linkType: "publisher",
    linkVerified: true
  };
  const withoutFeedback = assessReliability(base, reliabilityConfig);
  const withSmallSample = assessReliability({ ...base, feedbackAggregate: { useful: 4 } }, reliabilityConfig);
  assert.equal(withSmallSample.score, withoutFeedback.score);
});

test("published history is recalibrated when aggregate feedback changes", () => {
  const article = {
    id: "article-1",
    reliability: {
      score: 70,
      grade: "B",
      label: "较高",
      dimensions: { feedback: 2 },
      factors: ["5 份用户反馈带来 +2 分有限修正"],
      limitations: []
    }
  };
  const feedback = { useful: 0, questionable: 4, irrelevant: 2, broken: 0 };
  const calibration = feedbackCalibration(feedback, 5);
  const updated = recalibratePublishedArticle(article, feedback, 5);
  assert.equal(calibration.adjustment, -6);
  assert.equal(updated.reliability.score, 62);
  assert.equal(updated.reliability.grade, "C");
  assert.match(updated.reliability.limitations[0], /复核队列/);
});
