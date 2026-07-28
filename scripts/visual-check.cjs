const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "test-results");
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: "4173" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

function waitForServer(url, attempts = 40) {
  return new Promise((resolve, reject) => {
    const tryRequest = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else if (remaining > 0) setTimeout(() => tryRequest(remaining - 1), 250);
        else reject(new Error(`Server returned ${response.statusCode}`));
      });
      request.on("error", () => {
        if (remaining > 0) setTimeout(() => tryRequest(remaining - 1), 250);
        else reject(new Error("Server did not become ready"));
      });
    };
    tryRequest(attempts);
  });
}

async function inspectLayout(page, label) {
  const result = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    cards: document.querySelectorAll(".article-card").length,
    title: document.querySelector("#brief-title")?.textContent?.trim(),
    searchWidth: document.querySelector(".search-box")?.getBoundingClientRect().width,
    reliabilityBadges: document.querySelectorAll(".reliability-badge").length,
    accessBadges: document.querySelectorAll(".content-access").length,
    technicalLabels: document.querySelectorAll(".technical-labels").length,
    componentTagRows: document.querySelectorAll(".article-card .related-component-tags").length,
    componentChips: document.querySelectorAll(".article-card .related-component-chip").length,
    dimensionFilters: document.querySelectorAll(".dimension-filter").length,
    activeCategory: document.querySelector(".category-tab.active > span")?.textContent?.trim(),
    categoryCounts: [...document.querySelectorAll("[data-category-count]")].map((item) => Number(item.textContent || 0)),
    brand: document.querySelector(".brand strong")?.textContent?.trim()
  }));
  if (result.bodyScrollWidth > result.viewportWidth + 1) {
    throw new Error(`${label} has horizontal overflow: ${result.bodyScrollWidth} > ${result.viewportWidth}`);
  }
  if (!result.cards) throw new Error(`${label} rendered no article cards`);
  if (result.reliabilityBadges !== result.cards) throw new Error(`${label} is missing reliability badges`);
  if (result.accessBadges < result.cards) throw new Error(`${label} is missing content access badges`);
  if (result.technicalLabels) throw new Error(`${label} still renders legacy multi-level technical labels`);
  if (result.componentTagRows !== result.cards || result.componentChips < result.cards) {
    throw new Error(`${label} is missing simplified related-component labels`);
  }
  if (result.activeCategory !== "传动链技术开发与质量运维") throw new Error(`${label} did not default to technical development and quality operations`);
  if (result.categoryCounts.length !== 6 || result.categoryCounts.some((count) => !Number.isFinite(count))) {
    throw new Error(`${label} did not expose stable main-section counts`);
  }
  if (!result.dimensionFilters) throw new Error(`${label} rendered no drivetrain component filters`);
  if (result.brand !== "机械中心-传动技术部在线平台") throw new Error(`${label} rendered the wrong platform name`);
  return result;
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const consoleErrors = [];
  let browser;

  try {
    await waitForServer("http://127.0.0.1:4173/api/health");
    browser = await chromium.launch({ headless: true, executablePath });

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    desktop.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    desktop.on("pageerror", (error) => consoleErrors.push(error.message));
    await desktop.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await desktop.waitForSelector(".article-card");
    const desktopLayout = await inspectLayout(desktop, "desktop");
    await desktop.screenshot({ path: path.join(outputDir, "desktop.png") });

    await desktop.locator('[data-category="综合资讯与待深读线索"]').click();
    await desktop.waitForTimeout(150);
    const clueCards = await desktop.locator(".clue-card").count();
    const verboseClueCards = await desktop.locator(".clue-card .article-summary").count();
    if (!clueCards || verboseClueCards) {
      throw new Error(`Comprehensive lead pool did not render compact entries: ${clueCards} clues, ${verboseClueCards} summaries`);
    }
    if (await desktop.locator(".clue-card .related-component-tags").count() !== clueCards) {
      throw new Error("Comprehensive lead pool is missing simplified related-component labels");
    }
    await desktop.screenshot({ path: path.join(outputDir, "title-clues.png") });
    await desktop.locator('[data-category="厂商与项目动态"]').click();
    await desktop.waitForTimeout(100);
    if (!(await desktop.locator('[data-industry-category="传动链企业"]').count())) {
      throw new Error("Manufacturer section did not expose its internal categories");
    }
    await desktop.locator('[data-category="传动链技术开发与质量运维"]').click();
    await desktop.waitForTimeout(100);

    await desktop.locator('[data-category="全部"]').click();
    await desktop.locator("#search-input").fill("轴承");
    await desktop.waitForTimeout(150);
    const searchResults = await desktop.locator(".article-card").count();
    if (searchResults < 1) throw new Error("Search for 轴承 returned no results");
    await desktop.locator(".article-card").first().locator('[data-action="experience"]').click();
    await desktop.waitForSelector("#article-dialog[open]");
    if (!(await desktop.locator(".experience-panel").evaluate((element) => element.open))) {
      throw new Error("Experience entry did not expand the structured form");
    }
    const reliabilityScore = Number(await desktop.locator(".reliability-score strong").textContent());
    if (!Number.isFinite(reliabilityScore) || reliabilityScore <= 0) throw new Error("Reliability score did not render");
    const detailClassificationRows = await desktop.locator(".classification-panel .classification-row").count();
    const detailTechnicalLabels = await desktop.locator(".classification-panel .technical-domain, .classification-panel .technical-tag, .classification-panel .failure-chip").count();
    if (detailClassificationRows !== 2 || detailTechnicalLabels) {
      throw new Error("Article details did not reduce classification to section and related component");
    }
    await desktop.locator('[data-feedback="useful"]').click();
    if (await desktop.locator('[data-feedback="useful"]').getAttribute("aria-pressed") !== "true") {
      throw new Error("Feedback selection was not persisted");
    }
    const experienceControls = await desktop.locator("[data-experience-form] select").count();
    if (experienceControls !== 6) throw new Error(`Expected 6 structured experience controls, found ${experienceControls}`);
    const insight = "现场连续监测中，建议先排除转速波动和传感器安装差异，再判断该结论是否适用于当前传动链。";
    await desktop.locator('[name="insight"]').fill(insight);
    await desktop.locator('[name="applicability"]').selectOption("supports");
    await desktop.locator('[name="privacyConfirmed"]').check();
    await desktop.locator('[data-experience-form] button[type="submit"]').click();
    await desktop.waitForTimeout(100);
    if (!(await desktop.locator(".experience-panel").evaluate((element) => element.open))) {
      throw new Error("Experience form collapsed after submission");
    }
    const experienceStored = await desktop.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem("wind-intel-experiences") || "{}");
      return Object.values(stored)[0] || {};
    });
    if (experienceStored.applicability !== "supports" || experienceStored.insight !== insight) {
      throw new Error("Written engineering experience was not persisted locally");
    }
    await desktop.screenshot({ path: path.join(outputDir, "detail-dialog.png") });
    await desktop.locator("#close-dialog").click();
    await desktop.locator('[data-sort="personal"]').click();
    if (!(await desktop.locator('[data-sort="personal"]').evaluate((element) => element.classList.contains("active")))) {
      throw new Error("Personalized sorting did not activate");
    }

    const reportDownloadPromise = desktop.waitForEvent("download");
    await desktop.locator("#open-weekly-report").click();
    const reportDownload = await reportDownloadPromise;
    await desktop.waitForSelector("#weekly-report-dialog[open]");
    const reportItems = await desktop.locator(".report-item").count();
    const reportParagraphs = await desktop.locator(".report-paragraph").count();
    const reportTags = await desktop.locator(".report-tags").count();
    const reportComponentGroups = await desktop.locator(".report-component-group").count();
    const reportEventParagraphs = await desktop.locator(".report-event").count();
    const reportInsightParagraphs = await desktop.locator(".report-insight").count();
    const reportEntities = await desktop.locator(".report-entity").count();
    const reportDataHighlights = await desktop.locator(".report-key-data").count();
    const reportOrganizationHighlights = await desktop.locator(".report-key-organization").count();
    const reportTechnologyHighlights = await desktop.locator(".report-key-technology").count();
    const reportReliability = await desktop.locator(".report-reliability").count();
    const reportNarrativeText = await desktop.locator(".report-paragraph").allTextContents();
    const legacyFactRows = await desktop.locator(".report-facts > div").count();
    if (reportItems < 1 || reportParagraphs !== reportItems || reportTags !== reportItems || !reportComponentGroups || reportEventParagraphs || reportInsightParagraphs || reportEntities || legacyFactRows || reportReliability) {
      throw new Error(`Weekly report must use one paragraph per item: ${reportItems} items, ${reportParagraphs} paragraphs`);
    }
    const reportStructure = await desktop.locator(".report-section").evaluateAll((sections) => sections.map((section) => ({
      title: section.querySelector(".report-section-heading h2")?.textContent?.trim(),
      components: [...section.querySelectorAll(".report-component-group")].map((componentGroup) => ({
        component: componentGroup.dataset.reportComponent,
        items: componentGroup.querySelectorAll(".report-item").length,
        firstTag: componentGroup.querySelector(".report-item .report-tags span")?.textContent?.trim()
      }))
    })));
    const expectedSectionOrder = ["传动链技术开发与质量运维", "论文、标准与专利", "厂商与项目动态", "政策、市场与产业环境"];
    const actualSectionRanks = reportStructure.map((section) => expectedSectionOrder.indexOf(section.title));
    if (actualSectionRanks.some((rank) => rank < 0) || actualSectionRanks.some((rank, index) => index && rank <= actualSectionRanks[index - 1])) {
      throw new Error("Weekly report main sections are not in the fixed taxonomy order");
    }
    if (reportStructure.some((section) => !section.components.length || section.components.some((component) => !component.items || component.firstTag !== component.component))) {
      throw new Error("Weekly report did not keep items under their matching component group");
    }
    if (!reportDataHighlights) throw new Error("Weekly report did not highlight any quantitative data");
    if (!reportOrganizationHighlights) throw new Error("Weekly report did not highlight any organizations");
    if (reportNarrativeText.some((text) => /(?:主体|做了什么|效果|关键数据|关键点|工程意义|公开资料披露)[：:]/.test(text))) {
      throw new Error("Weekly report still contains template field labels");
    }
    const prohibitedReportText = reportNarrativeText.filter((text) => /其中[，,]|项目容量为|计划节点为|公开金额为|来源为官方媒体|信息渠道来自官方媒体|属于行业资讯/.test(text));
    if (prohibitedReportText.length) {
      throw new Error(`Weekly report still appends standalone fields or source evaluations:\n${prohibitedReportText.join("\n")}`);
    }
    if (reportNarrativeText.some((text) => /[，,；;]\s*20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?[。.!！?？]/.test(text))) {
      throw new Error("Weekly report still appends a standalone timeline value");
    }
    const redundantReportText = reportNarrativeText.filter((text) => /采用采用|证据层级|结论边界|待验证问题|属于(?:行业|厂商|政策|官方|媒体)[^，。；]{0,16}(?:资讯|动态|信息|报道)|项目容量\s*[:：]?|容量\s*[:：]\s*\d|未(?:披露|提供|说明|给出)|信息(?:有限|不足)|需(?:要)?核验|来源待确认|可靠度/i.test(text));
    if (redundantReportText.length) {
      throw new Error(`Weekly report still contains redundant meta prose:\n${redundantReportText.join("\n")}`);
    }
    await desktop.locator(".report-item").first().screenshot({ path: path.join(outputDir, "weekly-report-item.png") });
    await reportDownload.saveAs(path.join(outputDir, "weekly-report.pdf"));
    const pdfBytes = fs.readFileSync(path.join(outputDir, "weekly-report.pdf"));
    const pdfHeader = pdfBytes.subarray(0, 8).toString("ascii");
    const pdfPages = (pdfBytes.toString("latin1").match(/\/Type \/Page /g) || []).length;
    if (pdfHeader !== "%PDF-1.4" || pdfBytes.length < 30000 || pdfPages < 1) {
      throw new Error(`Weekly report PDF failed validation: ${pdfHeader}, ${pdfBytes.length} bytes, ${pdfPages} pages`);
    }
    await desktop.screenshot({ path: path.join(outputDir, "weekly-report.png") });
    await desktop.locator("#close-weekly-report").click();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    mobile.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    mobile.on("pageerror", (error) => consoleErrors.push(error.message));
    await mobile.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await mobile.waitForSelector(".article-card");
    const mobileLayout = await inspectLayout(mobile, "mobile");
    await mobile.screenshot({ path: path.join(outputDir, "mobile.png") });

    await mobile.locator("#open-filters-mobile").click();
    await mobile.waitForSelector("#filter-dialog[open]");
    await mobile.screenshot({ path: path.join(outputDir, "mobile-filters.png") });
    await mobile.locator('#filter-dialog button[value="cancel"]').click();
    await mobile.locator(".article-card").first().locator('[data-action="experience"]').click();
    await mobile.waitForSelector('#article-dialog[open] textarea[name="insight"]', { state: "visible" });
    await mobile.waitForTimeout(700);
    const mobileDialogOverflow = await mobile.locator(".article-dialog").evaluate((element) =>
      element.scrollWidth > element.clientWidth + 1
    );
    if (mobileDialogOverflow) throw new Error("Mobile experience form has horizontal overflow");
    const mobileExperienceTop = await mobile.locator(".experience-insight-field").evaluate((element) =>
      element.getBoundingClientRect().top
    );
    if (mobileExperienceTop > 420) throw new Error("Mobile experience entry did not scroll to the form");
    await mobile.screenshot({ path: path.join(outputDir, "mobile-experience.png") });

    await mobile.goto("http://127.0.0.1:4173/?report=weekly", { waitUntil: "networkidle" });
    await mobile.waitForSelector("#weekly-report-dialog[open] .report-item");
    const mobileReportOverflow = await mobile.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
    if (mobileReportOverflow) throw new Error("Mobile weekly report has horizontal overflow");
    await mobile.screenshot({ path: path.join(outputDir, "mobile-weekly-report.png") });

    if (consoleErrors.length) {
      throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
    }

    console.log(JSON.stringify({ desktopLayout, mobileLayout, clueCards, searchResults, reliabilityScore, experienceControls, experienceStored, reportItems, reportParagraphs, reportComponentGroups, reportStructure, reportDataHighlights, reportOrganizationHighlights, reportTechnologyHighlights, pdfBytes: pdfBytes.length, pdfPages }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
