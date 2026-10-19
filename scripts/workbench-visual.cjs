const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results");
const executablePath = [process.env.PLAYWRIGHT_CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find(fs.existsSync);
const server = spawn(process.execPath, ["server.mjs"], { cwd: root, env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
const localUrl = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Server startup timeout")), 10000);
  server.stdout.on("data", (data) => { const match = String(data).match(/http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
  server.once("error", reject);
});
async function noOverflow(page, selector) {
  const overflow = await page.locator(selector).evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  assert.equal(overflow, false, `${selector} horizontal overflow`);
}
(async () => {
  let browser;
  try {
    const base = process.env.WORKBENCH_TEST_URL || await localUrl;
    browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".component-node").first().waitFor();
    assert.equal(await page.locator(".component-node").count(), 15);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await noOverflow(page, "body");
      await noOverflow(page, "#engineering-workbench");
      await page.locator('[data-map-component="主轴承"]').click();
      assert.match(await page.locator(".digest-heading").textContent(), /主轴承/);
      await page.locator("#map-days").selectOption("30");
      await page.locator("#engineering-workbench").screenshot({ path: path.join(output, `engineering-workbench-${width}.png`) });
      await page.locator('[data-map-component="齿轮箱"]').click();
      await page.locator("#open-comparison").click();
      if (width === 1440) {
        await page.locator("#comparison-search").fill("齿轮箱");
        const candidates = page.locator('#comparison-candidates input:not([disabled])');
        await candidates.first().check();
        const secondId = await page.locator('#comparison-candidates input:not(:checked):not([disabled])').first().getAttribute("data-pick-comparison");
        await page.locator(`[data-pick-comparison="${secondId}"]`).check();
        assert.equal(await page.locator(".comparison-table thead th").count(), 3);
        assert.match(await page.locator(".comparison-table").textContent(), /工况与验证范围/);
      }
      await noOverflow(page, "#comparison-dialog");
      await page.locator("#comparison-dialog").screenshot({ path: path.join(output, `engineering-comparison-${width}.png`) });
      await page.locator("#close-comparison").click();
      await page.locator("#open-presentation").click();
      await page.locator("#presentation-component").selectOption("全部部件");
      await noOverflow(page, "#presentation-dialog");
      await page.locator("#presentation-dialog").screenshot({ path: path.join(output, `engineering-presentation-overview-${width}.png`) });
      const total = Number((await page.locator("#slide-progress").textContent()).split("/")[1]);
      assert.ok(total > 2 && total <= 8);
      await page.locator("#next-slide").click();
      assert.ok(await page.locator(".slide-reading .article-summary").count());
      await noOverflow(page, "#presentation-stage");
      await page.locator("#presentation-dialog").screenshot({ path: path.join(output, `engineering-presentation-article-${width}.png`) });
      await page.locator("#next-slide").focus();
      await page.keyboard.press("ArrowRight");
      assert.match(await page.locator("#slide-progress").textContent(), /^3/);
      await page.locator("#close-presentation").click();
    }
    await page.locator("#open-source-coverage").click();
    await page.locator(".coverage-row").first().waitFor();
    assert.equal(await page.locator(".coverage-row").count(), 68);
    await noOverflow(page, "#source-coverage-dialog");
    await page.locator("#source-coverage-dialog").screenshot({ path: path.join(output, "engineering-sources-mobile.png") });
    await page.locator("#close-source-coverage").click();
    await page.locator("#browse-map-component").click();
    assert.match(await page.locator("#active-filters").textContent(), /齿轮箱/);
    const all = page.locator('.article-card [data-action="compare"]');
    await all.first().waitFor();
    await page.goto(`${base}?presentation=1&component=${encodeURIComponent("主轴承")}&days=30`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#presentation-dialog").getAttribute("open"), "");
    assert.equal(await page.locator("#presentation-component").inputValue(), "主轴承");
    assert.deepEqual(errors, []);
    console.log("Workbench passed: 15 component nodes, comparison, 8-slide deck, keyboard, share URL, 68-source ledger, 1440/390/320px.");
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
