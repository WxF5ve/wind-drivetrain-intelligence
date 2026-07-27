import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../config/sources.json", import.meta.url), "utf8"));

test("domestic industry and academic channels are configured without duplicate ids", () => {
  const sources = [...config.newsQueries, ...(config.webQueries || []), ...config.researchQueries];
  const ids = sources.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const requiredId of [
    "portal-cn-bjx-wind",
    "portal-cn-china5e-wind",
    "portal-cn-in-en-wind",
    "portal-cn-transmission",
    "portal-cn-advanced-manufacturing",
    "portal-cn-toutiao-wind",
    "web-cn-drivetrain-suppliers",
    "web-global-gearbox-suppliers",
    "web-global-bearing-suppliers",
    "web-cn-wind-oems",
    "web-global-wind-oems",
    "web-drivetrain-failure-cases",
    "web-cwea-drivetrain",
    "web-cn-drivetrain-patents",
    "web-global-drivetrain-patents",
    "web-drivetrain-standards",
    "research-cn-cnki-index",
    "research-cn-wanfang-index",
    "research-cn-cqvip-index",
    "research-cn-pubscholar-index",
    "research-cn-nstl-index",
    "research-cn-paper-edu-index"
  ]) {
    assert.equal(ids.includes(requiredId), true, `${requiredId} should be configured`);
  }
  const channelCount = config.newsQueries.length + (config.webQueries || []).length + config.researchQueries.reduce(
    (total, source) => total + (source.providers?.length || 2),
    0
  );
  assert.equal(channelCount >= 90, true);
  assert.equal(config.maxArticles >= 180, true);
});

test("direct web channels constrain results to declared publisher domains", () => {
  assert.equal(config.webQueries.length >= 10, true);
  for (const source of config.webQueries) {
    assert.equal(source.directSource, true, `${source.id} should be a direct source`);
    assert.equal(Array.isArray(source.allowedDomains) && source.allowedDomains.length > 0, true, `${source.id} should constrain domains`);
    assert.equal(["行业资讯", "技术资料", "专利", "标准"].includes(source.sourceType), true, `${source.id} should declare sourceType`);
    assert.equal(["domain-news", "google-patents"].includes(source.collector), true, `${source.id} should declare a supported collector`);
    if (source.collector === "domain-news") {
      assert.equal(typeof source.searchTerms === "string" && source.searchTerms.length > 0, true, `${source.id} should declare searchTerms`);
    }
    if (source.collector === "google-patents") {
      assert.equal(Array.isArray(source.patentQueries) && source.patentQueries.length > 0, true, `${source.id} should declare patentQueries`);
    }
  }
});

test("domestic priority research uses OpenAlex and Crossref", () => {
  const domestic = config.researchQueries.filter((source) => source.id === "research-cn")[0];
  assert.deepEqual(domestic.providers, ["openalex", "crossref"]);
});
