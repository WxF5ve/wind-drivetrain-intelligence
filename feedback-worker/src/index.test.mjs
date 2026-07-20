import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function mockDatabase() {
  const feedbackRows = new Map();
  const experienceRows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              const key = `${args[0]}:${args[1]}`;
              if (/DELETE FROM feedback/i.test(sql)) feedbackRows.delete(key);
              else if (/DELETE FROM engineering_experience/i.test(sql)) experienceRows.delete(key);
              else if (/INSERT INTO engineering_experience/i.test(sql)) {
                experienceRows.set(key, {
                  article_id: args[0],
                  client_id: args[1],
                  applicability: args[2],
                  component: args[3],
                  failure_mode: args[4],
                  evidence_level: args[5],
                  power_range: args[6],
                  environment: args[7],
                  insight_text: args[8],
                  confidence: 3,
                  updated_at: "2026-07-20 08:00:00"
                });
              } else {
                feedbackRows.set(key, { article_id: args[0], client_id: args[1], vote: args[2] });
              }
              return { success: true };
            }
          };
        },
        async all() {
          if (/FROM engineering_experience/i.test(sql)) {
            return { results: [...experienceRows.values()] };
          }
          const aggregates = new Map();
          for (const row of feedbackRows.values()) {
            const value = aggregates.get(row.article_id) || {
              article_id: row.article_id,
              useful: 0,
              questionable: 0,
              irrelevant: 0,
              broken: 0,
              total: 0
            };
            value[row.vote] += 1;
            value.total += 1;
            aggregates.set(row.article_id, value);
          }
          return { results: [...aggregates.values()] };
        }
      };
    }
  };
}

test("feedback worker stores one current vote per browser and supports clearing", async () => {
  const env = { DB: mockDatabase(), ALLOWED_ORIGIN: "https://engineer.github.io" };
  const payload = {
    articleId: "0123456789ab",
    clientId: "12345678-abcd-4321-abcd-1234567890ab",
    vote: "useful",
    reliabilityScore: 72
  };
  const post = (body) => worker.fetch(new Request("https://feedback.example/feedback", {
    method: "POST",
    headers: { Origin: "https://engineer.github.io", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }), env);

  assert.equal((await post(payload)).status, 200);
  assert.equal((await post({ ...payload, vote: "questionable" })).status, 200);
  let aggregate = await (await worker.fetch(new Request("https://feedback.example/aggregates"), env)).json();
  assert.equal(aggregate.articles[0].questionable, 1);
  assert.equal(aggregate.articles[0].useful, 0);

  assert.equal((await post({ ...payload, vote: "clear" })).status, 200);
  aggregate = await (await worker.fetch(new Request("https://feedback.example/aggregates"), env)).json();
  assert.equal(aggregate.articles.length, 0);
});

test("feedback worker rejects unapproved origins", async () => {
  const env = { DB: mockDatabase(), ALLOWED_ORIGIN: "https://engineer.github.io" };
  const response = await worker.fetch(new Request("https://feedback.example/feedback", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({
      articleId: "0123456789ab",
      clientId: "12345678-abcd-4321-abcd-1234567890ab",
      vote: "useful"
    })
  }), env);
  assert.equal(response.status, 403);
});

test("written engineering experience is private, upserted, aggregated, and clearable", async () => {
  const env = {
    DB: mockDatabase(),
    ALLOWED_ORIGIN: "https://engineer.github.io",
    AGGREGATE_TOKEN: "test-token-that-is-longer-than-thirty-two-characters"
  };
  const payload = {
    articleId: "0123456789ab",
    clientId: "12345678-abcd-4321-abcd-1234567890ab",
    applicability: "contradicts",
    component: "planetary",
    failureMode: "micropitting",
    evidenceLevel: "failure_analysis",
    powerRange: "5_10mw",
    environment: "offshore",
    insight: "现场检查发现该机理只在特定润滑状态和载荷波动下出现，建议结合油样和内窥镜结果交叉确认。"
  };
  const post = (body) => worker.fetch(new Request("https://feedback.example/experience", {
    method: "POST",
    headers: { Origin: "https://engineer.github.io", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }), env);

  assert.equal((await post(payload)).status, 200);
  let aggregate = await (await worker.fetch(new Request("https://feedback.example/aggregates"), env)).json();
  assert.equal(aggregate.articles[0].experience.contradicts, 1);
  assert.equal(aggregate.articles[0].experience.writtenTotal, 1);
  assert.equal(aggregate.articles[0].experience.topContexts[0].context, "planetary|micropitting|5_10mw|offshore");
  assert.equal("insights" in aggregate.articles[0].experience, false);

  aggregate = await (await worker.fetch(new Request("https://feedback.example/aggregates", {
    headers: { Authorization: `Bearer ${env.AGGREGATE_TOKEN}` }
  }), env)).json();
  assert.equal(aggregate.articles[0].experience.insights.length, 1);
  assert.equal(aggregate.articles[0].experience.insights[0].text, payload.insight);

  assert.equal((await post({ ...payload, insight: "太短" })).status, 400);

  assert.equal((await post({ ...payload, action: "clear" })).status, 200);
  aggregate = await (await worker.fetch(new Request("https://feedback.example/aggregates"), env)).json();
  assert.equal(aggregate.articles.length, 0);
});
