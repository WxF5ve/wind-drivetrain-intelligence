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
    reliabilityBadges: document.querySelectorAll(".reliability-badge").length
  }));
  if (result.bodyScrollWidth > result.viewportWidth + 1) {
    throw new Error(`${label} has horizontal overflow: ${result.bodyScrollWidth} > ${result.viewportWidth}`);
  }
  if (!result.cards) throw new Error(`${label} rendered no article cards`);
  if (result.reliabilityBadges !== result.cards) throw new Error(`${label} is missing reliability badges`);
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
    const reportEventParagraphs = await desktop.locator(".report-event").count();
    const reportInsightParagraphs = await desktop.locator(".report-insight").count();
    const reportEntities = await desktop.locator(".report-entity").count();
    const reportDataHighlights = await desktop.locator(".report-key-data").count();
    const legacyFactRows = await desktop.locator(".report-facts > div").count();
    if (reportItems < 1 || reportEventParagraphs !== reportItems || reportInsightParagraphs !== reportItems || reportEntities !== reportItems || legacyFactRows) {
      throw new Error(`Weekly report narrative is incomplete: ${reportItems} items, ${reportEventParagraphs} event paragraphs, ${reportInsightParagraphs} insight paragraphs`);
    }
    if (!reportDataHighlights) throw new Error("Weekly report did not highlight any quantitative data");
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

    console.log(JSON.stringify({ desktopLayout, mobileLayout, searchResults, reliabilityScore, experienceControls, experienceStored, reportItems, reportEventParagraphs, reportInsightParagraphs, reportDataHighlights, pdfBytes: pdfBytes.length, pdfPages }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
