import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function mockDatabase() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              const key = `${args[0]}:${args[1]}`;
              if (/DELETE FROM feedback/i.test(sql)) rows.delete(key);
              else rows.set(key, { article_id: args[0], client_id: args[1], vote: args[2] });
              return { success: true };
            }
          };
        },
        async all() {
          const aggregates = new Map();
          for (const row of rows.values()) {
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
