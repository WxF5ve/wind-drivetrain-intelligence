import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registryPlan, registryCoverage, isVerifiedRecent, runRegistryJobs, registryPublicationDate, isRegistryDrivetrainArticle } from "./source-registry.mjs";

const registry = JSON.parse(await readFile(new URL("../../config/weekly-source-registry.json", import.meta.url)));
const config = JSON.parse(await readFile(new URL("../../config/sources.json", import.meta.url)));
const plan = registryPlan(registry, config);
test("all 68 reference sources have executable or reused channels, without copied reliability claims", () => {
  assert.equal(plan.length, 68);
  assert.equal(new Set(plan.map((s) => s.id)).size, 68);
  assert.equal(new Set(plan.map((s) => s.group)).size, 8);
  for (const entry of plan) {
    assert.ok(entry.channelIds.length);
    assert.equal(entry.reliability, undefined);
    if (entry.source) {
      assert.ok(entry.source.allowedDomains.length);
      assert.equal(entry.source.strictDate, true);
      assert.match(entry.source.searchTerms, /wind|风电/);
    }
  }
  assert.ok(plan.find((s) => s.id === "csgear").domains.includes("ngcgears.com"));
  assert.equal(plan.find((s) => s.id === "chnenergy").domains[0], "chng.com.cn");
});
test("shared channel success does not mean every publisher has yielded content", () => {
  const entries = plan.filter((s) => ["skf", "schaeffler", "msa"].includes(s.id));
  const coverage = registryCoverage(entries, [{ id: "web-global-bearing-suppliers", requestStatus: "ok" }], [
    { url: "https://skf.com/news/one", evidence: { contentAccess: "fulltext" } }
  ], "2026-10-19");
  assert.equal(coverage.find((s) => s.id === "skf").status, "productive");
  assert.equal(coverage.find((s) => s.id === "schaeffler").status, "searched");
  assert.equal(coverage.find((s) => s.id === "msa").status, "pending");
});
test("journal coverage is journal-specific instead of counting every article on a publisher domain", () => {
  const entries = plan.filter((s) => ["mdpi_machines", "mdpi_lubricants"].includes(s.id));
  const result = registryCoverage(entries, entries.map((s) => ({ id: s.channelIds[0], requestStatus: "ok" })), [
    { url: "https://mdpi.com/paper", evidence: { journal: "Lubricants", contentAccess: "abstract" } }
  ], "2026-10-19");
  assert.equal(result.find((s) => s.id === "mdpi_machines").matched, 0);
  assert.equal(result.find((s) => s.id === "mdpi_lubricants").readable, 1);
});
test("registry rejects undated and out-of-window content", () => {
  assert.equal(isVerifiedRecent({ publishedAt: "2026-10-18" }, Date.parse("2026-10-12"), Date.parse("2026-10-19")), true);
  assert.equal(isVerifiedRecent({ publishedAt: "2026-10-18", evidence: { publishedDateEstimated: true } }, 0, Date.now()), false);
  assert.equal(isVerifiedRecent({ publishedAt: "2020-10-18" }, Date.parse("2026-10-12"), Date.parse("2026-10-19")), false);
});
test("registry publication date never falls back to a search engine crawl date", () => {
  assert.equal(registryPublicationDate({}, "https://mdpi.com/1424-8220/21/4/1512/pdf-with-cover"), "");
  assert.equal(registryPublicationDate({ publishedAt: "2021-02-23" }, "https://mdpi.com/paper"), "2021-02-23T00:00:00.000Z");
  assert.equal(registryPublicationDate({}, "https://csscbidding.com/news/20261016/a.html"), "2026-10-16T00:00:00Z");
});
test("registry excludes generic roads and tower research but retains bearing failure studies", () => {
  assert.equal(isRegistryDrivetrainArticle({ title: "风电项目部分场内道路工程招标公告", snippet: "风电机组" }), false);
  assert.equal(isRegistryDrivetrainArticle({ title: "Remaining Useful Life of Wind Turbine Towers", snippet: "gearbox used as a comparison" }), false);
  assert.equal(isRegistryDrivetrainArticle({ title: "Wind turbine main bearing fault diagnosis" }), true);
});
test("bounded registry collection preserves order and isolates failures", async () => {
  let active = 0;
  let max = 0;
  const jobs = Array.from({ length: 6 }, (_, index) => ({ run: async () => {
    active++; max = Math.max(active, max);
    await new Promise((resolve) => setTimeout(resolve, 5)); active--;
    if (index === 2) throw new Error("restricted");
    return [index];
  } }));
  const result = await runRegistryJobs(jobs, 2);
  assert.equal(max, 2);
  assert.equal(result[2].status, "rejected");
  assert.deepEqual(result[4].value, [4]);
});
