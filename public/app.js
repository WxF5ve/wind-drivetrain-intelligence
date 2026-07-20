const state = {
  data: null,
  articles: [],
  query: "",
  category: "全部",
  region: "全部",
  sourceType: "全部",
  sort: "latest",
  view: "all",
  saved: new Set(readStorage("wind-intel-saved", [])),
  watchlist: readStorage("wind-intel-watchlist", ["白色蚀刻裂纹", "行星架轴承", "油液监测"]),
  feedback: readObjectStorage("wind-intel-feedback", {}),
  experiences: readObjectStorage("wind-intel-experiences", {}),
  clientId: readClientId()
};

const runtimeConfig = window.WIND_INTEL_CONFIG || {};

const defaultShareMetadata = {
  title: document.title,
  description: document.querySelector('meta[property="og:description"]')?.content || ""
};

const elements = {
  activeFilters: document.querySelector("#active-filters"),
  articleDialog: document.querySelector("#article-dialog"),
  articleFeed: document.querySelector("#article-feed"),
  briefMode: document.querySelector("#brief-mode"),
  briefPeriod: document.querySelector("#brief-period"),
  briefSummary: document.querySelector("#brief-summary"),
  briefTitle: document.querySelector("#brief-title"),
  categoryTabs: document.querySelector("#category-tabs"),
  clearSearch: document.querySelector("#clear-search"),
  dialogContent: document.querySelector("#dialog-content"),
  dialogSource: document.querySelector("#dialog-source"),
  feedTitle: document.querySelector("#feed-title"),
  filterCount: document.querySelector("#filter-count"),
  filterDialog: document.querySelector("#filter-dialog"),
  filterForm: document.querySelector("#filter-form"),
  freshness: document.querySelector("#freshness"),
  metricDomestic: document.querySelector("#metric-domestic"),
  metricPapers: document.querySelector("#metric-papers"),
  metricTotal: document.querySelector("#metric-total"),
  resultCount: document.querySelector("#result-count"),
  savedCount: document.querySelector("#saved-count"),
  searchInput: document.querySelector("#search-input"),
  shareApp: document.querySelector("#share-app"),
  signalList: document.querySelector("#signal-list"),
  toast: document.querySelector("#toast"),
  trendList: document.querySelector("#trend-list"),
  watchForm: document.querySelector("#watch-form"),
  watchInput: document.querySelector("#watch-input"),
  watchList: document.querySelector("#watch-list")
};

let toastTimer;

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readObjectStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readClientId() {
  const existing = localStorage.getItem("wind-intel-client-id");
  if (existing) return existing;
  const value = crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("wind-intel-client-id", value);
  return value;
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderIcons() {
  window.lucide?.createIcons({
    attrs: {
      "aria-hidden": "true"
    }
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatPeriod(period) {
  if (!period?.from || !period?.to) return "本周情报简报";
  const formatter = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });
  return `${formatter.format(new Date(period.from))} - ${formatter.format(new Date(period.to))} 情报简报`;
}

function updateShareMetadata(title, description) {
  document.title = title;
  const titleMeta = document.querySelector('meta[property="og:title"]');
  const descriptionMeta = document.querySelector('meta[property="og:description"]');
  if (titleMeta) titleMeta.content = title;
  if (descriptionMeta) descriptionMeta.content = description;
}

function restoreShareMetadata() {
  updateShareMetadata(defaultShareMetadata.title, defaultShareMetadata.description);
}

function searchTokens() {
  return state.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function articleSearchScore(article) {
  const tokens = searchTokens();
  if (!tokens.length) return (article.relevanceScore || 0) + (article.reliability?.score || 0) / 10;

  const fields = {
    title: article.title.toLowerCase(),
    titleZh: (article.titleZh || "").toLowerCase(),
    tags: article.tags.join(" ").toLowerCase(),
    summary: article.summary.toLowerCase(),
    points: article.keyPoints.join(" ").toLowerCase(),
    impact: (article.engineeringImpact || "").toLowerCase(),
    source: article.source.toLowerCase(),
    classification: `${article.category} ${article.region} ${article.sourceType}`.toLowerCase(),
    structured: JSON.stringify({
      evidence: article.evidence || {},
      paper: article.paperDetails || {},
      industry: article.industryDetails || {}
    }).toLowerCase()
  };

  return tokens.reduce((score, token) => {
    if (!Object.values(fields).some((field) => field.includes(token))) return -1000;
    return (
      score +
      (fields.title.includes(token) ? 8 : 0) +
      (fields.titleZh.includes(token) ? 8 : 0) +
      (fields.tags.includes(token) ? 5 : 0) +
      (fields.summary.includes(token) ? 3 : 0) +
      (fields.points.includes(token) ? 2 : 0) +
      (fields.impact.includes(token) ? 2 : 0) +
      (fields.source.includes(token) ? 1 : 0) +
      (fields.classification.includes(token) ? 1 : 0)
      + (fields.structured.includes(token) ? 2 : 0)
    );
  }, (article.relevanceScore || 0) + (article.reliability?.score || 0) / 10);
}

function feedbackVoteWeight(vote) {
  return { useful: 8, questionable: -3, irrelevant: -18, broken: -20 }[vote] || 0;
}

function personalScore(article) {
  let score = (article.reliability?.score || 0) * 0.6 + (article.relevanceScore || 0) * 2;
  score += feedbackVoteWeight(state.feedback[article.id]);
  const articleTags = new Set(article.tags || []);
  for (const [articleId, vote] of Object.entries(state.feedback)) {
    const rated = state.articles.find((item) => item.id === articleId);
    if (!rated) continue;
    const direction = vote === "useful" ? 1.5 : vote === "irrelevant" ? -2 : 0;
    if (!direction) continue;
    const overlap = (rated.tags || []).filter((tag) => articleTags.has(tag)).length;
    score += Math.min(6, overlap * direction);
  }
  return score;
}

function matchesCategory(article) {
  if (state.category === "全部") return true;
  if (state.category === "学术论文") return article.sourceType === "论文";
  return article.category === state.category || article.tags.includes(state.category);
}

function matchesSourceType(article) {
  if (state.sourceType === "全部") return true;
  if (state.sourceType === "论文") return article.sourceType === "论文";
  return article.sourceType !== "论文";
}

function getVisibleArticles() {
  return state.articles
    .map((article) => ({ article, searchScore: articleSearchScore(article) }))
    .filter(({ article, searchScore }) => {
      if (searchScore < 0) return false;
      if (!matchesCategory(article)) return false;
      if (state.region !== "全部" && article.region !== state.region) return false;
      if (!matchesSourceType(article)) return false;
      if (state.view === "saved" && !state.saved.has(article.id)) return false;
      return true;
    })
    .sort((a, b) => {
      if (state.sort === "relevance" || state.query) return b.searchScore - a.searchScore;
      if (state.sort === "reliability") return (b.article.reliability?.score || 0) - (a.article.reliability?.score || 0);
      if (state.sort === "personal") return personalScore(b.article) - personalScore(a.article);
      return new Date(b.article.publishedAt) - new Date(a.article.publishedAt);
    })
    .map(({ article }) => article);
}

function highlight(value) {
  const tokens = searchTokens();
  let safe = escapeHtml(value);
  for (const token of tokens) {
    const pattern = new RegExp(`(${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    safe = safe.replace(pattern, "<mark>$1</mark>");
  }
  return safe;
}

function renderWeeklyBrief() {
  const { weeklyBrief, period, generatedAt, collectionStatus } = state.data;
  elements.briefPeriod.textContent = formatPeriod(period);
  elements.briefMode.textContent = weeklyBrief.summaryMode || "自动摘要";
  elements.briefTitle.textContent = weeklyBrief.title;
  elements.briefSummary.textContent = weeklyBrief.summary;
  elements.metricTotal.textContent = weeklyBrief.metrics?.total ?? state.articles.length;
  elements.metricDomestic.textContent = weeklyBrief.metrics?.domestic ?? 0;
  elements.metricPapers.textContent = weeklyBrief.metrics?.papers ?? 0;
  elements.signalList.innerHTML = (weeklyBrief.signals || [])
    .map(
      (signal) => `
        <span class="signal-chip">
          <i data-lucide="zap"></i>
          ${escapeHtml(signal)}
        </span>
      `
    )
    .join("");

  const generatedLabel = formatDate(generatedAt);
  const failedLabel = collectionStatus?.failed ? ` · ${collectionStatus.failed} 个通道异常` : "";
  const liveLabel = collectionStatus?.dataMode === "live" ? " · 真实来源" : "";
  elements.freshness.innerHTML = `
    <span class="status-dot" aria-hidden="true"></span>
    更新于 ${generatedLabel}${liveLabel}${failedLabel}
  `;
}

function articleCard(article) {
  const saved = state.saved.has(article.id);
  const reliability = article.reliability || { score: 0, grade: "D", label: "待评估" };
  const displayTitle = article.titleZh || article.title;
  return `
    <article class="article-card" data-id="${escapeHtml(article.id)}">
      <div class="article-media">
        <img src="./assets/gearbox-cover.png" alt="" loading="lazy">
        <span class="media-category">${escapeHtml(article.category)}</span>
      </div>
      <div class="article-body">
        <div class="article-meta">
          <span class="source">${escapeHtml(article.source)}</span>
          <span class="reliability-badge grade-${escapeHtml(reliability.grade.toLowerCase())}" title="可靠度 ${reliability.score} 分">
            ${escapeHtml(reliability.grade)} · ${escapeHtml(reliability.label)}
          </span>
          <span class="meta-separator" aria-hidden="true"></span>
          <span>${escapeHtml(article.region)}</span>
          <span class="meta-separator" aria-hidden="true"></span>
          <time datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt)}</time>
          <span class="meta-separator reading-separator" aria-hidden="true"></span>
          <span class="reading-time">${article.readingMinutes || 4} 分钟</span>
        </div>
        <h3 class="article-title">
          <button type="button" data-action="details">${highlight(displayTitle)}</button>
        </h3>
        <p class="article-summary">${highlight(article.summary)}</p>
        <button class="experience-link" type="button" data-action="experience">
          <i data-lucide="wrench"></i>
          <span>工程经验</span>
          <i data-lucide="chevron-right"></i>
        </button>
        <div class="article-footer">
          <div class="tag-list">
            ${(article.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="article-actions">
            <button class="icon-button ${saved ? "saved" : ""}" type="button" data-action="save" title="${saved ? "取消收藏" : "收藏"}" aria-label="${saved ? "取消收藏" : "收藏"}">
              <i data-lucide="${saved ? "bookmark-check" : "bookmark"}"></i>
            </button>
            <button class="icon-button share-action" type="button" data-action="share" title="分享" aria-label="分享">
              <i data-lucide="share-2"></i>
            </button>
            <a class="icon-button" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" title="查看原文" aria-label="查看原文">
              <i data-lucide="external-link"></i>
            </a>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderFeed() {
  const articles = getVisibleArticles();
  const hasFilters =
    state.query ||
    state.category !== "全部" ||
    state.region !== "全部" ||
    state.sourceType !== "全部" ||
    state.view === "saved";

  elements.feedTitle.textContent = state.view === "saved" ? "我的收藏" : state.query ? "搜索结果" : "最新情报";
  elements.resultCount.textContent = `找到 ${articles.length} 条资料${hasFilters ? "，已按当前条件筛选" : ""}`;
  elements.clearSearch.hidden = !state.query;

  if (!articles.length) {
    const collectionIsEmpty = state.articles.length === 0 && state.view !== "saved" && !hasFilters;
    elements.articleFeed.innerHTML = `
      <div class="empty-state">
        <div>
          <i data-lucide="${state.view === "saved" ? "bookmark" : collectionIsEmpty ? "calendar-check" : "search-x"}"></i>
          <h3>${state.view === "saved" ? "还没有收藏资料" : collectionIsEmpty ? "本周暂无高相关新增" : "没有找到匹配内容"}</h3>
          <p>${state.view === "saved" ? "在资讯卡片上点击收藏图标，重要资料会保存在当前设备。" : collectionIsEmpty ? "采集任务已完成，当前没有达到相关性阈值的公开资料。" : "试试更短的关键词，或移除部分分类与来源筛选。"}</p>
        </div>
      </div>
    `;
  } else {
    elements.articleFeed.innerHTML = articles.map(articleCard).join("");
  }

  elements.savedCount.textContent = state.saved.size;
  renderActiveFilters();
  renderIcons();
}

function renderActiveFilters() {
  const filters = [];
  if (state.query) filters.push({ key: "query", label: `关键词：${state.query}` });
  if (state.category !== "全部") filters.push({ key: "category", label: state.category });
  if (state.region !== "全部") filters.push({ key: "region", label: state.region });
  if (state.sourceType !== "全部") filters.push({ key: "sourceType", label: state.sourceType });
  if (state.view === "saved") filters.push({ key: "view", label: "仅看收藏" });

  elements.activeFilters.innerHTML = filters
    .map(
      (filter) => `
        <button class="active-filter" type="button" data-clear="${filter.key}">
          ${escapeHtml(filter.label)}
          <i data-lucide="x"></i>
        </button>
      `
    )
    .join("");

  const filterCount = [state.region, state.sourceType].filter((value) => value !== "全部").length;
  elements.filterCount.textContent = filterCount;
  elements.filterCount.hidden = filterCount === 0;
}

function renderTrends() {
  const counts = new Map();
  for (const article of state.articles) {
    counts.set(article.category, (counts.get(article.category) || 0) + 1);
  }
  const trends = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...trends.map(([, count]) => count), 1);

  elements.trendList.innerHTML = trends
    .map(
      ([category, count]) => `
        <button class="trend-item" type="button" data-trend="${escapeHtml(category)}" title="筛选 ${escapeHtml(category)}">
          <span class="trend-label">${escapeHtml(category)}</span>
          <span class="trend-bar"><span style="width: ${(count / max) * 100}%"></span></span>
          <span class="trend-count">${count}</span>
        </button>
      `
    )
    .join("");
}

function renderWatchlist() {
  elements.watchList.innerHTML = state.watchlist
    .map(
      (keyword) => `
        <span class="watch-token">
          <button type="button" data-watch="${escapeHtml(keyword)}">${escapeHtml(keyword)}</button>
          <button class="remove-watch" type="button" data-remove-watch="${escapeHtml(keyword)}" title="移除 ${escapeHtml(keyword)}" aria-label="移除 ${escapeHtml(keyword)}">
            <i data-lucide="x"></i>
          </button>
        </span>
      `
    )
    .join("");
  renderIcons();
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });
  renderFeed();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view || (view === "all" && button.dataset.view === "all"));
  });
  if (view === "search") {
    state.view = "all";
    elements.searchInput.focus();
    document.querySelector(".search-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  renderFeed();
}

function findArticle(id) {
  return state.articles.find((article) => article.id === id);
}

function definitionRows(rows) {
  const visible = rows.filter(([, value]) => value !== "" && value !== null && value !== undefined);
  if (!visible.length) return "";
  return `<dl class="detail-grid">${visible.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
  `).join("")}</dl>`;
}

function renderPaperMetadata(article) {
  if (article.sourceType !== "论文") return "";
  const evidence = article.evidence || {};
  const metrics = evidence.sourceMetrics || {};
  const pages = [evidence.firstPage, evidence.lastPage].filter(Boolean).join("-");
  const metricValue = Number(metrics.twoYearMeanCitedness || 0);
  return `
    <section class="detail-section paper-metadata">
      <h3>论文与期刊</h3>
      ${definitionRows([
        ["期刊", evidence.journal || article.source],
        ["作者", (evidence.authors || []).join("、")],
        ["DOI", evidence.doi],
        ["ISSN-L", evidence.issnL],
        ["出版社", evidence.publisher],
        ["卷期", [evidence.volume && `Vol. ${evidence.volume}`, evidence.issue && `No. ${evidence.issue}`].filter(Boolean).join(" / ")],
        ["页码", pages],
        ["论文被引", Number(evidence.citedByCount || 0) ? `${evidence.citedByCount} 次（OpenAlex）` : ""],
        ["2年平均被引率", metricValue ? `${Number(metricValue.toFixed(2))}（OpenAlex，非 JCR 影响因子）` : ""],
        ["期刊 h-index", Number(metrics.hIndex || 0) ? `${metrics.hIndex}（OpenAlex）` : ""],
        ["开放获取", evidence.isOpenAccess ? "是" : ""]
      ])}
    </section>
  `;
}

function renderPaperDetails(article) {
  if (article.sourceType !== "论文") return "";
  const details = article.paperDetails || {};
  const findings = details.quantitativeFindings || [];
  return `
    <section class="detail-section">
      <h3>研究设计</h3>
      ${definitionRows([
        ["研究目标", details.objective],
        ["方法", details.methods],
        ["试验对象", details.testObject],
        ["工况与边界", details.operatingConditions]
      ]) || '<p class="detail-empty">公开摘要未披露完整研究设计。</p>'}
      <h3>量化结论</h3>
      ${findings.length ? `<div class="quantitative-list">${findings.map((item) => `
        <div class="quantitative-row">
          <div class="quantitative-value"><strong>${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</strong><span>${escapeHtml(item.metric)}</span></div>
          <div>${item.comparison ? `<p>${escapeHtml(item.comparison)}</p>` : ""}${item.conditions ? `<p>条件：${escapeHtml(item.conditions)}</p>` : ""}${item.evidence ? `<p>依据：${escapeHtml(item.evidence)}</p>` : ""}</div>
        </div>
      `).join("")}</div>` : '<p class="detail-empty">公开摘要未披露可核查的量化结果。</p>'}
      ${(details.limitations || []).length ? `<h3>研究局限</h3><ul class="limitations-list">${details.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
  `;
}

function renderIndustryDetails(article) {
  if (article.intelligenceType !== "industry") return "";
  const details = article.industryDetails || {};
  return `
    <section class="detail-section">
      <h3>行业事件</h3>
      ${definitionRows([
        ["事件", details.eventType],
        ["企业", (details.companies || []).join("、")],
        ["地点", details.location],
        ["容量", details.capacity],
        ["金额", details.investment],
        ["时间线", details.timeline],
        ["供应链影响", details.supplyChainImpact],
        ["核验状态", details.verificationStatus]
      ])}
      ${(details.quantitativeFacts || []).length ? `<h3>量化事实</h3><ul class="fact-list">${details.quantitativeFacts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
  `;
}

const experienceOptions = {
  applicability: {
    supports: "符合工程经验",
    conditional: "有条件适用",
    contradicts: "与工程经验冲突",
    uncertain: "暂不确定"
  },
  component: {
    gearbox: "齿轮箱总成",
    planetary: "行星级",
    high_speed: "高速级",
    main_bearing: "主轴承",
    gear_bearing: "齿轮箱轴承",
    lubrication: "润滑系统",
    monitoring: "状态监测",
    drivetrain: "传动链",
    other: "其他"
  },
  failureMode: {
    micropitting: "微点蚀",
    wec: "白色蚀刻裂纹",
    scuffing: "胶合",
    tooth_failure: "断齿/齿根裂纹",
    bearing_damage: "轴承损伤",
    electrical_damage: "电蚀",
    lubrication: "润滑问题",
    monitoring: "监测诊断",
    loads: "载荷与均载",
    manufacturing: "材料与制造",
    other: "其他",
    not_applicable: "不涉及失效"
  },
  evidenceLevel: {
    test_report: "试验报告",
    failure_analysis: "失效分析",
    multiple_cases: "多个案例",
    single_case: "单个案例",
    engineering_judgment: "工程判断"
  },
  powerRange: {
    under_5mw: "5 MW 以下",
    "5_10mw": "5-10 MW",
    over_10mw: "10 MW 以上",
    unknown: "未限定"
  },
  environment: {
    onshore: "陆上风场",
    offshore: "海上风场",
    test_bench: "试验台",
    unknown: "未限定"
  }
};

function selectOptions(group, selected, fallback) {
  return Object.entries(experienceOptions[group]).map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${value === (selected || fallback) ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function renderExperiencePanel(article) {
  const selected = state.experiences[article.id] || {};
  const aggregate = article.engineeringExperience || {};
  const aggregateLabel = aggregate.writtenTotal
    ? `已收录 ${aggregate.writtenTotal} 条工程心得`
    : "欢迎补充工程心得";
  const insight = String(selected.insight || "");
  return `
    <details class="experience-panel">
      <summary><span><i data-lucide="wrench"></i>工程经验交流</span><small>${escapeHtml(aggregateLabel)}</small></summary>
      <form class="experience-form" data-experience-form data-id="${escapeHtml(article.id)}">
        <label class="experience-insight-field">
          <span><strong>工程心得</strong><small data-insight-count>${insight.length}/1200</small></span>
          <textarea name="insight" rows="6" minlength="20" maxlength="1200" required autocomplete="off" placeholder="请写下你观察到的现象、适用边界、判断依据、反例或建议的验证方法">${escapeHtml(insight)}</textarea>
          <small>请勿填写公司、项目、机组编号、人员姓名及其他保密信息。</small>
        </label>
        <div class="experience-context-heading">适用背景</div>
        <div class="experience-grid">
          <label>适用判断<select name="applicability" required>${selectOptions("applicability", selected.applicability, "uncertain")}</select></label>
          <label>相关部件<select name="component" required>${selectOptions("component", selected.component, "gearbox")}</select></label>
          <label>失效/主题<select name="failureMode" required>${selectOptions("failureMode", selected.failureMode, "not_applicable")}</select></label>
          <label>证据等级<select name="evidenceLevel" required>${selectOptions("evidenceLevel", selected.evidenceLevel, "engineering_judgment")}</select></label>
          <label>功率区间<select name="powerRange" required>${selectOptions("powerRange", selected.powerRange, "unknown")}</select></label>
          <label>应用场景<select name="environment" required>${selectOptions("environment", selected.environment, "unknown")}</select></label>
        </div>
        <label class="privacy-confirmation"><input type="checkbox" name="privacyConfirmed" required><span>我确认这段心得不含单位或项目保密信息</span></label>
        <div class="experience-actions">
          <button class="primary-button" type="submit"><i data-lucide="send"></i>提交工程心得</button>
          ${selected.applicability ? `<button class="quiet-button" type="button" data-experience-clear data-id="${escapeHtml(article.id)}"><i data-lucide="trash-2"></i>撤销</button>` : ""}
        </div>
      </form>
    </details>
  `;
}

function renderExperienceReview(article) {
  const review = article.experienceReview || {};
  if (!review.synthesis) return "";
  return `
    <section class="experience-review" aria-labelledby="experience-review-title">
      <div class="experience-review-heading">
        <div>
          <span>ENGINEER REVIEW</span>
          <h3 id="experience-review-title">工程经验复核</h3>
        </div>
        <strong>${escapeHtml(review.status || "待核验")}</strong>
      </div>
      <p>${escapeHtml(review.synthesis)}</p>
      ${review.applicableBoundary ? `<div><b>适用边界</b><span>${escapeHtml(review.applicableBoundary)}</span></div>` : ""}
      ${review.verificationNeeded ? `<div><b>待验证</b><span>${escapeHtml(review.verificationNeeded)}</span></div>` : ""}
      <small>基于匿名工程师心得归纳，不替代论文、试验报告或失效分析原始证据。</small>
    </section>
  `;
}

function openArticle(article, { focusExperience = false } = {}) {
  if (!article) return;
  const displayTitle = article.titleZh || article.title;
  updateShareMetadata(`${displayTitle}｜风传智研`, article.summary);
  elements.dialogSource.textContent = `${article.source} · ${article.sourceType}`;
  const linkLabel = article.linkType === "aggregator" ? "聚合跳转" : "发布方原文";
  const reliability = article.reliability || { score: 0, grade: "D", label: "待评估", factors: [], limitations: [], feedback: {} };
  const selectedFeedback = state.feedback[article.id] || "";
  const aggregateTotal = reliability.feedback?.total || 0;
  elements.dialogContent.innerHTML = `
    <article class="dialog-article">
      <h2>${escapeHtml(displayTitle)}</h2>
      ${article.titleZh && article.titleZh !== article.title ? `<p class="original-title">${escapeHtml(article.title)}</p>` : ""}
      <div class="dialog-meta">
        <span>${escapeHtml(article.region)}</span>
        <span>·</span>
        <time datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt)}</time>
        <span>·</span>
        <span>${article.readingMinutes || 4} 分钟阅读</span>
      </div>
      <div class="provenance-row">
        <span><i data-lucide="shield-check"></i> 来源可追溯</span>
        <span>${escapeHtml(article.sourceChannel || "网络公开来源")}</span>
        <span>${linkLabel}</span>
        ${article.aiAnalysis?.provider ? `<span>${escapeHtml(article.aiAnalysis.provider)} AI 摘要</span>` : ""}
      </div>
      ${renderPaperMetadata(article)}
      <p class="dialog-summary">${escapeHtml(article.summary)}</p>
      ${renderPaperDetails(article)}
      ${renderIndustryDetails(article)}
      <section class="reliability-section" aria-labelledby="reliability-title">
        <div class="reliability-heading">
          <div>
            <h3 id="reliability-title">可靠度评估</h3>
            <p>评估来源、证据与可追溯性，不代表结论已经证实。</p>
          </div>
          <div class="reliability-score grade-${escapeHtml(reliability.grade.toLowerCase())}">
            <strong>${reliability.score}</strong>
            <span>${escapeHtml(reliability.grade)} · ${escapeHtml(reliability.label)}</span>
          </div>
        </div>
        <div class="reliability-reasons">
          ${(reliability.factors || []).map((item) => `<span class="positive"><i data-lucide="check"></i>${escapeHtml(item)}</span>`).join("")}
          ${(reliability.limitations || []).map((item) => `<span class="limitation"><i data-lucide="triangle-alert"></i>${escapeHtml(item)}</span>`).join("")}
        </div>
      </section>
      <h3>关键信息</h3>
      <ol class="key-points">
        ${(article.keyPoints || [])
          .map((point, index) => `<li><span>${index + 1}</span><div>${escapeHtml(point)}</div></li>`)
          .join("")}
      </ol>
      <h3>工程启示</h3>
      <div class="impact-box">${escapeHtml(article.engineeringImpact)}</div>
      ${renderExperienceReview(article)}
      <div class="tag-list" style="margin-top: 18px">
        ${(article.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${renderExperiencePanel(article)}
      <section class="feedback-section" aria-labelledby="feedback-title">
        <div>
          <h3 id="feedback-title">你的判断</h3>
          ${aggregateTotal ? `<span class="feedback-total">已汇总 ${aggregateTotal} 份反馈</span>` : ""}
        </div>
        <div class="feedback-actions" role="group" aria-label="评价这条资料">
          <button type="button" data-feedback="useful" data-id="${escapeHtml(article.id)}" aria-pressed="${selectedFeedback === "useful"}">
            <i data-lucide="thumbs-up"></i><span>有价值</span>
          </button>
          <button type="button" data-feedback="questionable" data-id="${escapeHtml(article.id)}" aria-pressed="${selectedFeedback === "questionable"}">
            <i data-lucide="circle-help"></i><span>需核验</span>
          </button>
          <button type="button" data-feedback="irrelevant" data-id="${escapeHtml(article.id)}" aria-pressed="${selectedFeedback === "irrelevant"}">
            <i data-lucide="circle-minus"></i><span>不相关</span>
          </button>
          <button type="button" data-feedback="broken" data-id="${escapeHtml(article.id)}" aria-pressed="${selectedFeedback === "broken"}">
            <i data-lucide="unlink"></i><span>链接失效</span>
          </button>
        </div>
      </section>
      <div class="dialog-actions">
        <a class="primary-button" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">
          <i data-lucide="external-link"></i>
          阅读原文
        </a>
        <button class="quiet-button" type="button" data-dialog-action="save" data-id="${escapeHtml(article.id)}">
          <i data-lucide="${state.saved.has(article.id) ? "bookmark-check" : "bookmark"}"></i>
          ${state.saved.has(article.id) ? "已收藏" : "收藏"}
        </button>
        <button class="quiet-button" type="button" data-dialog-action="share" data-id="${escapeHtml(article.id)}">
          <i data-lucide="share-2"></i>
          分享
        </button>
      </div>
    </article>
  `;
  if (!elements.articleDialog.open) elements.articleDialog.showModal();
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("article", article.id);
  history.replaceState(null, "", shareUrl);
  renderIcons();
  if (focusExperience) {
    const panel = elements.dialogContent.querySelector(".experience-panel");
    if (panel) {
      panel.open = true;
      requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        panel.querySelector("textarea")?.focus({ preventScroll: true });
      });
    }
  }
}

async function sendCentralFeedback(article, vote) {
  if (!runtimeConfig.feedbackEndpoint) return;
  const endpoint = new URL("feedback", runtimeConfig.feedbackEndpoint.endsWith("/")
    ? runtimeConfig.feedbackEndpoint
    : `${runtimeConfig.feedbackEndpoint}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articleId: article.id,
      vote,
      clientId: state.clientId,
      reliabilityScore: article.reliability?.score || 0,
      submittedAt: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Feedback API ${response.status}`);
  const pending = readObjectStorage("wind-intel-feedback-pending", {});
  delete pending[article.id];
  writeStorage("wind-intel-feedback-pending", pending);
}

async function sendCentralExperience(article, experience) {
  if (!runtimeConfig.feedbackEndpoint) return;
  const endpoint = new URL("experience", runtimeConfig.feedbackEndpoint.endsWith("/")
    ? runtimeConfig.feedbackEndpoint
    : `${runtimeConfig.feedbackEndpoint}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articleId: article.id,
      clientId: state.clientId,
      ...experience,
      submittedAt: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Experience API ${response.status}`);
  const pending = readObjectStorage("wind-intel-experience-pending", {});
  delete pending[article.id];
  writeStorage("wind-intel-experience-pending", pending);
}

function queuePendingExperience(article, experience) {
  const pending = readObjectStorage("wind-intel-experience-pending", {});
  pending[article.id] = { ...experience, updatedAt: new Date().toISOString() };
  writeStorage("wind-intel-experience-pending", pending);
}

async function flushPendingExperience() {
  if (!runtimeConfig.feedbackEndpoint) return;
  const pending = readObjectStorage("wind-intel-experience-pending", {});
  for (const [articleId, experience] of Object.entries(pending)) {
    const article = findArticle(articleId);
    if (!article) continue;
    try {
      await sendCentralExperience(article, experience);
    } catch {
      return;
    }
  }
}

async function submitExperience(article, form) {
  if (!article || !form) return;
  const data = new FormData(form);
  const experience = {
    insight: String(data.get("insight") || "").replace(/\r\n?/g, "\n").trim().slice(0, 1200),
    applicability: data.get("applicability"),
    component: data.get("component"),
    failureMode: data.get("failureMode"),
    evidenceLevel: data.get("evidenceLevel"),
    powerRange: data.get("powerRange"),
    environment: data.get("environment")
  };
  state.experiences[article.id] = experience;
  writeStorage("wind-intel-experiences", state.experiences);
  openArticle(article, { focusExperience: true });
  try {
    await sendCentralExperience(article, experience);
    showToast(runtimeConfig.feedbackEndpoint ? "工程经验已匿名汇总" : "工程经验已保存在本机");
  } catch (error) {
    console.warn(error);
    queuePendingExperience(article, experience);
    showToast("工程经验已保存在本机，下次打开自动重试");
  }
}

async function clearExperience(article) {
  if (!article) return;
  delete state.experiences[article.id];
  writeStorage("wind-intel-experiences", state.experiences);
  openArticle(article, { focusExperience: true });
  const clearPayload = { action: "clear" };
  try {
    await sendCentralExperience(article, clearPayload);
    showToast("已撤销工程经验");
  } catch (error) {
    console.warn(error);
    queuePendingExperience(article, clearPayload);
    showToast("撤销请求已保存在本机");
  }
}

function queuePendingFeedback(article, vote) {
  const pending = readObjectStorage("wind-intel-feedback-pending", {});
  pending[article.id] = { vote, updatedAt: new Date().toISOString() };
  writeStorage("wind-intel-feedback-pending", pending);
}

async function flushPendingFeedback() {
  if (!runtimeConfig.feedbackEndpoint) return;
  const pending = readObjectStorage("wind-intel-feedback-pending", {});
  for (const [articleId, item] of Object.entries(pending)) {
    const article = findArticle(articleId);
    if (!article) continue;
    try {
      await sendCentralFeedback(article, item.vote);
    } catch {
      return;
    }
  }
}

async function submitFeedback(article, vote) {
  if (!article || !["useful", "questionable", "irrelevant", "broken"].includes(vote)) return;
  const keepExperienceOpen = Boolean(elements.dialogContent.querySelector(".experience-panel")?.open);
  if (state.feedback[article.id] === vote) {
    delete state.feedback[article.id];
  } else {
    state.feedback[article.id] = vote;
  }
  writeStorage("wind-intel-feedback", state.feedback);
  const selected = state.feedback[article.id] || "";
  renderFeed();
  openArticle(article, { focusExperience: keepExperienceOpen });
  try {
    await sendCentralFeedback(article, selected || "clear");
    showToast(!selected
      ? "已撤销反馈"
      : runtimeConfig.feedbackEndpoint
        ? "反馈已汇总并用于后续校准"
        : "已根据反馈调整本机推荐");
  } catch (error) {
    console.warn(error);
    queuePendingFeedback(article, selected || "clear");
    showToast("反馈已保存在本机，下次打开自动重试");
  }
}

function closeArticle() {
  if (elements.articleDialog.open) elements.articleDialog.close();
  const url = new URL(window.location.href);
  url.searchParams.delete("article");
  history.replaceState(null, "", url);
  restoreShareMetadata();
}

function toggleSaved(article) {
  if (!article) return;
  if (state.saved.has(article.id)) {
    state.saved.delete(article.id);
    showToast("已取消收藏");
  } else {
    state.saved.add(article.id);
    showToast("已加入收藏");
  }
  writeStorage("wind-intel-saved", [...state.saved]);
  renderFeed();
  if (elements.articleDialog.open) openArticle(article);
}

async function shareContent(shareData) {
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
  } catch {
    const input = document.createElement("textarea");
    input.value = `${shareData.title}\n${shareData.url}`;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(/MicroMessenger/i.test(navigator.userAgent) ? "链接已复制，也可使用微信右上角分享" : "分享链接已复制");
}

async function shareArticle(article) {
  if (!article) return;
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("article", article.id);
  return shareContent({
    title: article.title,
    text: `${article.summary}\n来源：${article.source}`,
    url: shareUrl.toString()
  });
}

async function shareApplication() {
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.delete("article");
  return shareContent({
    title: defaultShareMetadata.title,
    text: state.data?.weeklyBrief?.summary || defaultShareMetadata.description,
    url: shareUrl.toString()
  });
}

function openFilters() {
  elements.filterForm.elements.region.value = state.region;
  elements.filterForm.elements.sourceType.value = state.sourceType;
  elements.filterDialog.showModal();
}

function clearFilter(key) {
  if (key === "query") {
    state.query = "";
    elements.searchInput.value = "";
  } else if (key === "view") {
    state.view = "all";
  } else {
    state[key] = "全部";
  }
  renderFeed();
}

function wireEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    if (state.query) state.sort = "relevance";
    renderFeed();
    document.querySelectorAll("[data-sort]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sort === state.sort);
    });
  });

  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    elements.searchInput.value = "";
    elements.searchInput.focus();
    renderFeed();
  });

  elements.categoryTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (button) setCategory(button.dataset.category);
  });

  document.querySelector(".segmented-control").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort]");
    if (!button) return;
    state.sort = button.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("active", item === button));
    renderFeed();
  });

  elements.articleFeed.addEventListener("click", (event) => {
    const card = event.target.closest(".article-card");
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!card || !action) return;
    const article = findArticle(card.dataset.id);
    if (action === "details") openArticle(article);
    if (action === "experience") openArticle(article, { focusExperience: true });
    if (action === "save") toggleSaved(article);
    if (action === "share") shareArticle(article);
  });

  elements.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear]");
    if (button) clearFilter(button.dataset.clear);
  });

  elements.trendList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-trend]");
    if (button) setCategory(button.dataset.trend);
  });

  elements.watchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const keyword = elements.watchInput.value.trim();
    if (!keyword) return;
    if (!state.watchlist.includes(keyword)) {
      state.watchlist.unshift(keyword);
      state.watchlist = state.watchlist.slice(0, 12);
      writeStorage("wind-intel-watchlist", state.watchlist);
      renderWatchlist();
    }
    elements.watchInput.value = "";
  });

  elements.watchList.addEventListener("click", (event) => {
    const searchButton = event.target.closest("[data-watch]");
    const removeButton = event.target.closest("[data-remove-watch]");
    if (searchButton) {
      state.query = searchButton.dataset.watch;
      elements.searchInput.value = state.query;
      state.sort = "relevance";
      renderFeed();
      document.querySelector(".search-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (removeButton) {
      state.watchlist = state.watchlist.filter((item) => item !== removeButton.dataset.removeWatch);
      writeStorage("wind-intel-watchlist", state.watchlist);
      renderWatchlist();
    }
  });

  document.querySelector("#show-saved").addEventListener("click", () => setView("saved"));
  elements.shareApp.addEventListener("click", shareApplication);
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelector("#open-filters").addEventListener("click", openFilters);
  document.querySelector("#open-filters-mobile").addEventListener("click", openFilters);
  document.querySelector("#reset-filters").addEventListener("click", () => {
    elements.filterForm.elements.region.value = "全部";
    elements.filterForm.elements.sourceType.value = "全部";
  });
  elements.filterForm.addEventListener("submit", (event) => {
    if (event.submitter?.value !== "apply") return;
    const formData = new FormData(elements.filterForm);
    state.region = formData.get("region") || "全部";
    state.sourceType = formData.get("sourceType") || "全部";
    renderFeed();
  });

  document.querySelector("#close-dialog").addEventListener("click", closeArticle);
  elements.articleDialog.addEventListener("click", (event) => {
    if (event.target === elements.articleDialog) closeArticle();
    const button = event.target.closest("[data-dialog-action]");
    const feedbackButton = event.target.closest("[data-feedback]");
    const experienceClear = event.target.closest("[data-experience-clear]");
    if (experienceClear) {
      clearExperience(findArticle(experienceClear.dataset.id));
      return;
    }
    if (feedbackButton) {
      submitFeedback(findArticle(feedbackButton.dataset.id), feedbackButton.dataset.feedback);
      return;
    }
    if (button) {
      const article = findArticle(button.dataset.id);
      if (button.dataset.dialogAction === "save") toggleSaved(article);
      if (button.dataset.dialogAction === "share") shareArticle(article);
    }
  });
  elements.articleDialog.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-experience-form]");
    if (!form) return;
    event.preventDefault();
    submitExperience(findArticle(form.dataset.id), form);
  });
  elements.articleDialog.addEventListener("input", (event) => {
    const input = event.target.closest('textarea[name="insight"]');
    if (!input) return;
    const counter = input.closest(".experience-insight-field")?.querySelector("[data-insight-count]");
    if (counter) counter.textContent = `${input.value.length}/1200`;
  });
  elements.articleDialog.addEventListener("close", () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("article")) {
      url.searchParams.delete("article");
      history.replaceState(null, "", url);
    }
    restoreShareMetadata();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }
  });
}

async function loadData() {
  try {
    const response = await fetch("./data/articles.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.data = await response.json();
    state.articles = state.data.articles || [];
    renderWeeklyBrief();
    renderTrends();
    renderWatchlist();
    renderFeed();
    renderIcons();
    flushPendingFeedback();
    flushPendingExperience();

    const articleId = new URL(window.location.href).searchParams.get("article");
    if (articleId) openArticle(findArticle(articleId));
  } catch (error) {
    console.error(error);
    elements.articleFeed.innerHTML = `
      <div class="empty-state">
        <div>
          <i data-lucide="cloud-off"></i>
          <h3>资料暂时无法加载</h3>
          <p>请检查网络连接后刷新页面。已经打开过的内容仍可通过离线缓存访问。</p>
        </div>
      </div>
    `;
    elements.resultCount.textContent = "加载失败";
    renderIcons();
  }
}

wireEvents();
renderIcons();
loadData();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}
