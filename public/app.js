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
  watchlist: readStorage("wind-intel-watchlist", ["白色蚀刻裂纹", "行星架轴承", "油液监测"])
};

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
  if (!tokens.length) return article.relevanceScore || 0;

  const fields = {
    title: article.title.toLowerCase(),
    tags: article.tags.join(" ").toLowerCase(),
    summary: article.summary.toLowerCase(),
    points: article.keyPoints.join(" ").toLowerCase(),
    impact: (article.engineeringImpact || "").toLowerCase(),
    source: article.source.toLowerCase(),
    classification: `${article.category} ${article.region} ${article.sourceType}`.toLowerCase()
  };

  return tokens.reduce((score, token) => {
    if (!Object.values(fields).some((field) => field.includes(token))) return -1000;
    return (
      score +
      (fields.title.includes(token) ? 8 : 0) +
      (fields.tags.includes(token) ? 5 : 0) +
      (fields.summary.includes(token) ? 3 : 0) +
      (fields.points.includes(token) ? 2 : 0) +
      (fields.impact.includes(token) ? 2 : 0) +
      (fields.source.includes(token) ? 1 : 0) +
      (fields.classification.includes(token) ? 1 : 0)
    );
  }, article.relevanceScore || 0);
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
  return `
    <article class="article-card" data-id="${escapeHtml(article.id)}">
      <div class="article-media">
        <img src="./assets/gearbox-cover.png" alt="" loading="lazy">
        <span class="media-category">${escapeHtml(article.category)}</span>
      </div>
      <div class="article-body">
        <div class="article-meta">
          <span class="source">${escapeHtml(article.source)}</span>
          <span class="meta-separator" aria-hidden="true"></span>
          <span>${escapeHtml(article.region)}</span>
          <span class="meta-separator" aria-hidden="true"></span>
          <time datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt)}</time>
          <span class="meta-separator reading-separator" aria-hidden="true"></span>
          <span class="reading-time">${article.readingMinutes || 4} 分钟</span>
        </div>
        <h3 class="article-title">
          <button type="button" data-action="details">${highlight(article.title)}</button>
        </h3>
        <p class="article-summary">${highlight(article.summary)}</p>
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

function openArticle(article) {
  if (!article) return;
  updateShareMetadata(`${article.title}｜风传智研`, article.summary);
  elements.dialogSource.textContent = `${article.source} · ${article.sourceType}`;
  const linkLabel = article.linkType === "aggregator" ? "聚合跳转" : "发布方原文";
  elements.dialogContent.innerHTML = `
    <article class="dialog-article">
      <h2>${escapeHtml(article.title)}</h2>
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
      </div>
      <p class="dialog-summary">${escapeHtml(article.summary)}</p>
      <h3>关键信息</h3>
      <ol class="key-points">
        ${(article.keyPoints || [])
          .map((point, index) => `<li><span>${index + 1}</span><div>${escapeHtml(point)}</div></li>`)
          .join("")}
      </ol>
      <h3>工程启示</h3>
      <div class="impact-box">${escapeHtml(article.engineeringImpact)}</div>
      <div class="tag-list" style="margin-top: 18px">
        ${(article.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
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
    if (!button) return;
    const article = findArticle(button.dataset.id);
    if (button.dataset.dialogAction === "save") toggleSaved(article);
    if (button.dataset.dialogAction === "share") shareArticle(article);
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
