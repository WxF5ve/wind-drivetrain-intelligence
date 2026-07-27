import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../config/sources.json", import.meta.url), "utf8"));

test("domestic industry and academic channels are configured without duplicate ids", () => {
  const sources = [...config.newsQueries, ...config.researchQueries];
  const ids = sources.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const requiredId of [
    "portal-cn-bjx-wind",
    "portal-cn-china5e-wind",
    "portal-cn-in-en-wind",
    "portal-cn-transmission",
    "portal-cn-advanced-manufacturing",
    "portal-cn-toutiao-wind",
    "research-cn-cnki-index",
    "research-cn-wanfang-index",
    "research-cn-cqvip-index",
    "research-cn-pubscholar-index",
    "research-cn-nstl-index",
    "research-cn-paper-edu-index"
  ]) {
    assert.equal(ids.includes(requiredId), true, `${requiredId} should be configured`);
  }
  const channelCount = config.newsQueries.length + config.researchQueries.reduce(
    (total, source) => total + (source.providers?.length || 2),
    0
  );
  assert.equal(channelCount >= 90, true);
  assert.equal(config.maxArticles >= 180, true);
});

test("domestic priority research uses OpenAlex and Crossref", () => {
  const domestic = config.researchQueries.filter((source) => source.id === "research-cn")[0];
  assert.deepEqual(domestic.providers, ["openalex", "crossref"]);
});
