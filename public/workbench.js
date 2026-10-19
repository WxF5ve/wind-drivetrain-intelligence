import { COMPONENT_NODES, safeWebUrl, scopeArticles, isReadable, addComparison, commonComponents, comparisonFields, presentationArticles } from "./lib/workbench.mjs";

export function mountWorkbench({ root, articles, generatedAt, components, reading, renderParagraphs, openArticle, browseComponent, icons, toast }) {
  const escape = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const date = (value) => new Date(value).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  const sourceLink = (article) => safeWebUrl(article.url) ? `<a href="${escape(safeWebUrl(article.url))}" target="_blank" rel="noopener noreferrer">${escape(article.source)} ${icon("external-link")}</a>` : escape(article.source);
  const options = ["全部部件", "传动链整体", ...COMPONENT_NODES.map((node) => node.name)];
  let component = "齿轮箱";
  let days = 7;
  let selected = [];
  let slideIndex = 0;
  let deck = [];
  let deckItems = [];
  const windowOptions = () => ({ end: generatedAt, days, component, components });
  const selectOptions = (value, allLabel) => options.map((name) => `<option value="${name}" ${name === value ? "selected" : ""}>${name === "全部部件" ? allLabel || name : name}</option>`).join("");
  const button = (id, name, label, extra = "") => `<button type="button" id="${id}" class="icon-button" title="${label}" aria-label="${label}" ${extra}>${icon(name)}</button>`;

  root.innerHTML = `
    <div class="engineering-header">
      <div><span class="section-kicker">ENGINEERING DESK</span><h2>工程工作台</h2></div>
      <div class="engineering-tools">
        <button type="button" id="open-comparison" class="quiet-button">${icon("columns-3")}<span>方案对照</span><strong id="comparison-count">0</strong></button>
        <button type="button" id="open-presentation" class="primary-button">${icon("presentation")}<span>汇报演示</span></button>
        ${button("open-source-coverage", "network", "采集渠道")}
      </div>
    </div>
    <details class="drivetrain-overview" open>
      <summary><span>传动链交互总览</span><small id="map-period"></small>${icon("chevron-down")}</summary>
      <div class="overview-body">
        <div class="component-map" aria-label="风电传动链部件示意">
          <div class="map-toolbar"><button class="quiet-button" id="map-all" type="button">传动链整体</button>
            <label class="sr-only" for="map-days">信息时间范围</label><select id="map-days"><option value="7">最近7天</option><option value="30">最近30天</option></select>
          </div>
          <div class="component-lane main-lane" id="main-lane"></div>
          <div class="component-lane-label">齿轮箱内部</div><div class="component-lane" id="gearbox-lane"></div>
          <div class="component-lane-label">连接与辅助系统</div><div class="component-lane" id="support-lane"></div>
          <div class="map-legend"><span class="activity-dot"></span>相关资料数<span class="map-caption">部件关联示意 · 非机型布置图</span></div>
        </div>
        <div class="component-digest" id="component-digest" aria-live="polite"></div>
      </div>
    </details>`;

  const dialogs = document.createElement("div");
  dialogs.innerHTML = `
    <dialog id="comparison-dialog" class="engineering-dialog" aria-labelledby="comparison-title">
      <header class="engineering-dialog-header"><div><span class="section-kicker">TECHNICAL COMPARISON</span><h2 id="comparison-title">技术方案对照</h2></div>${button("close-comparison", "x", "关闭方案对照")}</header>
      <div class="comparison-controls"><label>相关部件<select id="comparison-component">${selectOptions("全部部件")}</select></label>
        <label class="comparison-search">检索资料<input id="comparison-search" type="search" placeholder="题名、企业或技术词"></label>
        <button id="clear-comparison" class="quiet-button" type="button">${icon("trash-2")}清空</button>
      </div>
      <div id="comparison-selection" class="comparison-selection" aria-live="polite"></div>
      <div class="comparison-table-wrap" id="comparison-table-wrap" tabindex="0" aria-label="方案对照表"></div>
      <div class="comparison-candidate-heading"><h3>资料库</h3><span id="comparison-result-count"></span></div>
      <div id="comparison-candidates" class="comparison-candidates"></div>
    </dialog>
    <dialog id="presentation-dialog" class="presentation-dialog" aria-labelledby="presentation-title">
      <header class="presentation-toolbar"><strong id="presentation-title">传动技术汇报</strong>
        <label class="sr-only" for="presentation-component">汇报部件</label><select id="presentation-component">${selectOptions("全部部件", "全部传动部件")}</select>
        <label class="sr-only" for="presentation-days">汇报时间范围</label><select id="presentation-days"><option value="7">最近7天</option><option value="30">最近30天</option></select>
        <div class="presentation-tools">${button("share-presentation", "share-2", "分享此专题演示")}${button("fullscreen-presentation", "maximize", "全屏演示")}${button("close-presentation", "x", "关闭汇报演示")}</div>
      </header>
      <div id="presentation-stage" class="presentation-stage" aria-live="polite"></div>
      <footer class="presentation-footer">${button("previous-slide", "arrow-left", "上一页")}<div id="slide-progress"></div>${button("next-slide", "arrow-right", "下一页")}</footer>
    </dialog>
    <dialog id="source-coverage-dialog" class="engineering-dialog" aria-labelledby="source-coverage-title">
      <header class="engineering-dialog-header"><div><span class="section-kicker">SOURCE COVERAGE</span><h2 id="source-coverage-title">采集渠道对照</h2></div>${button("close-source-coverage", "x", "关闭采集渠道")}</header>
      <div id="source-coverage-body" class="source-coverage-body" aria-live="polite"></div>
    </dialog>`;
  document.body.append(dialogs);
  const $ = (id) => document.getElementById(id);
  const comparisonDialog = $("comparison-dialog");
  const presentationDialog = $("presentation-dialog");
  const coverageDialog = $("source-coverage-dialog");

  function renderMap() {
    const all = scopeArticles(articles, { ...windowOptions(), component: "全部部件" });
    $("map-period").textContent = `截至 ${date(generatedAt)} · 最近${days}天`;
    for (const lane of ["main", "gearbox", "support"]) {
      $(`${lane}-lane`).innerHTML = COMPONENT_NODES.filter((node) => node.lane === lane).map((node) => {
        const count = all.filter((article) => components(article).includes(node.name)).length;
        return `<button type="button" class="component-node ${node.name === component ? "active" : ""} ${count ? "has-updates" : ""}" data-map-component="${node.name}" aria-pressed="${node.name === component}">
          ${icon(node.icon)}<span>${node.name}</span><strong>${count}</strong></button>`;
      }).join("");
    }
    const matching = scopeArticles(articles, windowOptions());
    const readable = matching.filter(isReadable);
    const experience = matching.reduce((sum, a) => sum + Number(a.engineeringExperience?.writtenTotal || 0), 0);
    $("component-digest").innerHTML = `<div class="digest-heading"><h3>${escape(component === "全部部件" ? "传动链整体" : component)}</h3><button class="icon-button" id="browse-map-component" title="查看该部件全部情报" aria-label="查看该部件全部情报">${icon("arrow-up-right")}</button></div>
      <div class="digest-stats"><span><strong>${matching.length}</strong>相关资料</span><span><strong>${readable.length}</strong>可读摘要</span><span><strong>${experience}</strong>工程心得</span></div>
      <div class="digest-articles">${readable.slice(0, 2).map((a) => `<button type="button" data-open-article="${escape(a.id)}"><time>${date(a.publishedAt)}</time><span>${escape(reading(a).headline)}</span>${icon("chevron-right")}</button>`).join("") || '<p class="workbench-empty">本时间范围暂无可读摘要</p>'}</div>`;
    icons();
  }

  function syncSelection() {
    $("comparison-count").textContent = selected.length;
    document.querySelectorAll('[data-action="compare"]').forEach((control) => {
      const id = control.closest("[data-id]")?.dataset.id;
      const active = selected.some((a) => a.id === id);
      control.setAttribute("aria-pressed", String(active));
      control.classList.toggle("selected", active);
    });
  }

  function toggleComparison(article) {
    const result = addComparison(selected, article, components);
    if (result.error) return toast(result.error);
    selected = result.items;
    syncSelection();
    if (comparisonDialog.open) renderComparison();
    else toast(`对照台已选 ${selected.length} 条`);
  }

  function renderComparison() {
    const common = commonComponents(selected, components);
    $("comparison-selection").innerHTML = `<span>已选 ${selected.length}/4${common.length ? ` · ${escape(common.join("、"))}` : ""}</span>${selected.map((a) => `<button type="button" data-remove-comparison="${escape(a.id)}" title="移除：${escape(reading(a).headline)}">${escape(reading(a).headline)}${icon("x")}</button>`).join("")}`;
    const fields = selected.map(comparisonFields);
    const fieldRows = [
      ["对象与企业", (f) => escape(f.object || "—")], ["技术路线", (f) => escape(f.method || "—")],
      ["材料与工艺", (f) => escape(f.process || "—")], ["工况与验证范围", (f) => escape(f.conditions || "—")],
      ["阶段与证据类型", (f) => escape(f.stage || "—")],
      ["量化结果与比较条件", (f) => f.findings.map((q) => `<p class="comparison-finding">${escape(q.label)} <strong>${escape(q.value)}</strong>${q.context ? `<small>${escape(q.context)}</small>` : ""}</p>`).join("") || "—"],
      ["开发参考", (f) => escape(f.implication || "—")]
    ];
    $("comparison-table-wrap").innerHTML = selected.length < 2 ? '<p class="workbench-empty">待选择2—4条同部件资料</p>' :
      `<table class="comparison-table"><caption>资料原有参数并列 · 工况分别保留 · 不作性能排名</caption><thead><tr><th scope="col">工程维度</th>${selected.map((a) => `<th scope="col"><button type="button" data-open-article="${escape(a.id)}">${escape(reading(a).headline)}</button><small>${date(a.publishedAt)} · ${sourceLink(a)}</small></th>`).join("")}</tr></thead><tbody>${fieldRows.map(([label, render]) => `<tr><th scope="row">${label}</th>${fields.map((f) => `<td>${render(f)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    renderCandidates();
    icons();
  }

  function renderCandidates() {
    const filter = $("comparison-component").value;
    const query = $("comparison-search").value.trim().toLowerCase();
    const candidates = articles.filter((a) => isReadable(a) && (filter === "全部部件" || components(a).includes(filter)) &&
      (!query || [reading(a).headline, a.source, a.summary, ...(a.technicalTags || [])].join(" ").toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    $("comparison-result-count").textContent = `${candidates.length}条 · 显示前${Math.min(30, candidates.length)}条`;
    $("comparison-candidates").innerHTML = candidates.slice(0, 30).map((a) => {
      const checked = selected.some((s) => s.id === a.id);
      const unavailable = !checked && (selected.length >= 4 || (selected.length && !commonComponents([...selected, a], components).length));
      return `<label class="comparison-candidate ${unavailable ? "unavailable" : ""}"><input type="checkbox" data-pick-comparison="${escape(a.id)}" ${checked ? "checked" : ""} ${unavailable ? "disabled" : ""}><span><strong>${escape(reading(a).headline)}</strong><small>${escape(components(a).join(" · "))} · ${date(a.publishedAt)} · ${escape(a.source)}</small></span></label>`;
    }).join("") || '<p class="workbench-empty">暂无匹配资料</p>';
  }

  function buildPresentation() {
    const selectedComponent = $("presentation-component").value;
    const selectedDays = Number($("presentation-days").value);
    const settings = { end: generatedAt, days: selectedDays, component: selectedComponent, components };
    deckItems = presentationArticles(articles, settings);
    const all = scopeArticles(articles, { ...settings, readableOnly: true });
    const start = new Date(new Date(generatedAt).getTime() - selectedDays * 86400000);
    const title = selectedComponent === "全部部件" ? "风电传动技术进展" : `${selectedComponent}技术进展`;
    const counts = COMPONENT_NODES.map((node) => ({ name: node.name, count: all.filter((a) => components(a).includes(node.name)).length })).filter((x) => x.count).sort((a, b) => b.count - a.count).slice(0, 5);
    deck = [{ type: "overview", title, start, allCount: all.length, counts }, ...deckItems.map((article) => ({ type: "article", article }))];
    if (deckItems.length) deck.push({ type: "sources" });
    slideIndex = 0;
    renderSlide();
  }

  function renderSlide() {
    const slide = deck[slideIndex];
    if (!slide) return;
    let content;
    if (slide.type === "overview") {
      content = `<div class="slide-overview"><div class="slide-kicker">机械中心 · 传动技术部</div><h2>${escape(slide.title)}</h2><p class="slide-period">${date(slide.start)} — ${date(generatedAt)}</p>
        <div class="slide-metrics"><div><strong>${slide.allCount}</strong><span>范围内可读情报</span></div><div><strong>${deckItems.length}</strong><span>本次精选</span></div><div><strong>${new Set(deckItems.map((a) => a.source)).size}</strong><span>来源</span></div></div>
        <div class="slide-distribution">${slide.counts.map((count) => `<div><span>${count.name}</span><progress value="${count.count}" max="${slide.counts[0].count}" aria-label="${count.name}相关资料数"></progress><strong>${count.count}</strong></div>`).join("") || '<p class="workbench-empty">本时间范围暂无可读情报</p>'}</div></div>`;
    } else if (slide.type === "article") {
      const a = slide.article;
      content = `<article class="slide-article"><div class="slide-kicker">${escape(components(a).join(" · "))} <span>${escape(a.sourceType)}</span></div><h2>${escape(reading(a).headline)}</h2><div class="slide-meta">${date(a.publishedAt)} · ${sourceLink(a)}</div><div class="slide-reading">${renderParagraphs(a)}</div></article>`;
    } else {
      content = `<div class="slide-sources"><div class="slide-kicker">REFERENCE INDEX</div><h2>本次汇报原文</h2><ol>${deckItems.map((a) => `<li><strong>${escape(reading(a).headline)}</strong><span>${date(a.publishedAt)} · ${sourceLink(a)}</span></li>`).join("")}</ol></div>`;
    }
    $("presentation-stage").innerHTML = content;
    $("presentation-stage").scrollTop = 0;
    $("slide-progress").textContent = `${slideIndex + 1} / ${deck.length}`;
    $("previous-slide").disabled = slideIndex === 0;
    $("next-slide").disabled = slideIndex === deck.length - 1;
    icons();
  }

  async function closePresentation() {
    if (document.fullscreenElement === presentationDialog) await document.exitFullscreen().catch(() => {});
    presentationDialog.close();
  }

  async function showCoverage() {
    coverageDialog.showModal();
    $("source-coverage-body").textContent = "正在读取渠道记录";
    try {
      const response = await fetch("./data/source-coverage.json", { cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const coverage = await response.json();
      const labels = { pending: "待运行核验", productive: "本轮有收录", failed: "本轮请求失败", searched: "已检索 · 无收录" };
      const groups = [...new Set(coverage.entries.map((entry) => entry.group))];
      $("source-coverage-body").innerHTML = `<p class="coverage-summary">周报生成渠道基线 · ${coverage.entries.length}个入口 · ${groups.length}类</p><p class="coverage-date">基线 ${escape(coverage.referenceDate)} · 采集记录 ${date(coverage.generatedAt)}</p>${groups.map((group) => `<section class="coverage-group"><h3>${escape(group)}</h3>${coverage.entries.filter((entry) => entry.group === group).map((entry) => `<div class="coverage-row"><a href="${escape(safeWebUrl(entry.urls[0]))}" target="_blank" rel="noopener noreferrer">${escape(entry.name)}${icon("external-link")}</a><span class="coverage-status status-${escape(entry.status)}">${labels[entry.status] || labels.pending}</span><small>${entry.matched}条收录 · ${entry.readable}条可读</small></div>`).join("")}</section>`).join("")}`;
      icons();
    } catch { $("source-coverage-body").textContent = "渠道记录暂不可用，请稍后重试。"; }
  }

  root.addEventListener("click", (event) => {
    const node = event.target.closest("[data-map-component]");
    if (node) { component = node.dataset.mapComponent; renderMap(); root.querySelector(`[data-map-component="${component}"]`)?.focus({ preventScroll: true }); }
    const articleId = event.target.closest("[data-open-article]")?.dataset.openArticle;
    if (articleId) openArticle(articles.find((a) => a.id === articleId));
    if (event.target.closest("#browse-map-component")) browseComponent(component);
  });
  $("map-all").onclick = () => { component = "全部部件"; renderMap(); };
  $("map-days").onchange = (event) => { days = Number(event.target.value); renderMap(); };
  $("open-comparison").onclick = () => { $("comparison-component").value = selected.length ? "全部部件" : component; comparisonDialog.showModal(); renderComparison(); };
  $("close-comparison").onclick = () => comparisonDialog.close();
  $("clear-comparison").onclick = () => { selected = []; syncSelection(); renderComparison(); };
  $("comparison-component").onchange = renderCandidates;
  $("comparison-search").oninput = renderCandidates;
  comparisonDialog.addEventListener("change", (event) => {
    const id = event.target.dataset.pickComparison;
    if (id) {
      toggleComparison(articles.find((a) => a.id === id));
      comparisonDialog.querySelector(`[data-pick-comparison="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    }
  });
  comparisonDialog.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-comparison]");
    if (remove) toggleComparison(articles.find((a) => a.id === remove.dataset.removeComparison));
    const open = event.target.closest("[data-open-article]");
    if (open) openArticle(articles.find((a) => a.id === open.dataset.openArticle));
  });
  $("open-presentation").onclick = () => { $("presentation-component").value = component; $("presentation-days").value = days; buildPresentation(); presentationDialog.showModal(); };
  $("presentation-component").onchange = buildPresentation;
  $("presentation-days").onchange = buildPresentation;
  $("close-presentation").onclick = closePresentation;
  $("next-slide").onclick = () => { if (slideIndex < deck.length - 1) { slideIndex++; renderSlide(); } };
  $("previous-slide").onclick = () => { if (slideIndex > 0) { slideIndex--; renderSlide(); } };
  $("fullscreen-presentation").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (presentationDialog.requestFullscreen) await presentationDialog.requestFullscreen();
      else toast("当前浏览器使用窗口演示模式");
    } catch { toast("当前浏览器使用窗口演示模式"); }
  };
  $("share-presentation").onclick = async () => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("presentation", "1");
    url.searchParams.set("component", $("presentation-component").value);
    url.searchParams.set("days", $("presentation-days").value);
    try {
      if (navigator.share) await navigator.share({ title: "传动技术专题汇报", url: url.href });
      else { await navigator.clipboard.writeText(url.href); toast("专题演示链接已复制"); }
    } catch (error) { if (error.name !== "AbortError") toast("分享暂不可用，可使用微信菜单分享平台"); }
  };
  presentationDialog.addEventListener("keydown", (event) => {
    if (event.target.matches("input,select,textarea")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); $(event.key === "ArrowRight" ? "next-slide" : "previous-slide").click(); }
  });
  $("open-source-coverage").onclick = showCoverage;
  $("close-source-coverage").onclick = () => coverageDialog.close();
  for (const dialog of [comparisonDialog, coverageDialog, presentationDialog]) {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog === presentationDialog ? closePresentation() : dialog.close(); });
  }
  renderMap();
  const params = new URL(location.href).searchParams;
  if (params.get("presentation") === "1") {
    $("presentation-component").value = options.includes(params.get("component")) ? params.get("component") : "全部部件";
    $("presentation-days").value = params.get("days") === "30" ? "30" : "7";
    buildPresentation();
    presentationDialog.showModal();
  }
  return { toggleComparison, syncSelection };
}
