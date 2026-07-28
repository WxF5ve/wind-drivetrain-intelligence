import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDomainNewsQueries,
  classifyChannelResult,
  isAllowedPublisherUrl,
  isAllowedResearchJournal
} from "./sources.mjs";

test("domain news queries use one explicit publisher domain per request", () => {
  const queries = buildDomainNewsQueries({
    searchTerms: "wind turbine bearing technology",
    allowedDomains: ["skf.com", "www.schaeffler.com", "skf.com"]
  });
  assert.deepEqual(queries, [
    { domain: "skf.com", query: "site:skf.com wind turbine bearing technology" },
    { domain: "schaeffler.com", query: "site:schaeffler.com wind turbine bearing technology" }
  ]);
});

test("publisher URL validation accepts subdomains and rejects unrelated results", () => {
  assert.equal(isAllowedPublisherUrl("https://engineering.skf.com/wind", ["skf.com"]), true);
  assert.equal(isAllowedPublisherUrl("https://skf.com.evil.example/wind", ["skf.com"]), false);
  assert.equal(isAllowedPublisherUrl("https://news.google.com/article/123", ["skf.com"]), false);
});

test("research journal filters keep RSER records exact", () => {
  const journals = ["Renewable and Sustainable Energy Reviews"];
  assert.equal(isAllowedResearchJournal("Renewable and Sustainable Energy Reviews", journals), true);
  assert.equal(isAllowedResearchJournal("Renewable & Sustainable Energy Reviews", journals), true);
  assert.equal(isAllowedResearchJournal("Renewable Energy", journals), false);
  assert.equal(isAllowedResearchJournal("Any Journal", []), true);
});

test("successful zero-result channels become low-yield after consecutive runs", () => {
  const empty = classifyChannelResult({ status: "fulfilled", value: [] });
  assert.deepEqual(empty, { status: "empty", requestStatus: "ok", zeroFetchStreak: 1 });

  const lowYield = classifyChannelResult(
    { status: "fulfilled", value: [] },
    { status: "ok", fetched: 0 }
  );
  assert.deepEqual(lowYield, { status: "low-yield", requestStatus: "ok", zeroFetchStreak: 2 });

  const recovered = classifyChannelResult(
    { status: "fulfilled", value: [{ id: "article" }] },
    { status: "low-yield", fetched: 0, zeroFetchStreak: 3 }
  );
  assert.deepEqual(recovered, { status: "ok", requestStatus: "ok", zeroFetchStreak: 0 });
});
