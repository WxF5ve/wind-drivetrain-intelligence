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
    await desktop.locator(".article-card").first().locator('[data-action="details"]').click();
    await desktop.waitForSelector("#article-dialog[open]");
    const reliabilityScore = Number(await desktop.locator(".reliability-score strong").textContent());
    if (!Number.isFinite(reliabilityScore) || reliabilityScore <= 0) throw new Error("Reliability score did not render");
    await desktop.locator('[data-feedback="useful"]').click();
    if (await desktop.locator('[data-feedback="useful"]').getAttribute("aria-pressed") !== "true") {
      throw new Error("Feedback selection was not persisted");
    }
    await desktop.screenshot({ path: path.join(outputDir, "detail-dialog.png") });
    await desktop.locator("#close-dialog").click();
    await desktop.locator('[data-sort="personal"]').click();
    if (!(await desktop.locator('[data-sort="personal"]').evaluate((element) => element.classList.contains("active")))) {
      throw new Error("Personalized sorting did not activate");
    }

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

    if (consoleErrors.length) {
      throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
    }

    console.log(JSON.stringify({ desktopLayout, mobileLayout, searchResults, reliabilityScore }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
