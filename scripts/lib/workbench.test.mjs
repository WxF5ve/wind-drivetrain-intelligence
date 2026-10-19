import test from "node:test";
import assert from "node:assert/strict";
import { scopeArticles, addComparison, commonComponents, comparisonFields, presentationArticles, safeWebUrl } from "../../public/lib/workbench.mjs";

const end = "2026-10-19T04:00:00Z";
const components = (article) => article.components;
const make = (id, parts = ["齿轮箱"]) => ({ id, publishedAt: "2026-10-15T12:00:00Z", informationLevel: "readable", evidence: { contentAccess: "fulltext" }, components: parts });
test("workbench window rejects future, estimated and old dates", () => {
  const articles = [make("valid"), { ...make("future"), publishedAt: "2026-12-20" }, { ...make("estimated"), evidence: { publishedDateEstimated: true } }, { ...make("old"), publishedAt: "2020-01-01" }];
  assert.deepEqual(scopeArticles(articles, { end, components }).map((a) => a.id), ["valid"]);
});
test("comparison enforces a shared component and four-item maximum without ranking", () => {
  const a = make("a", ["齿轮箱", "滑动轴承"]);
  assert.deepEqual(commonComponents([a, make("b")], components), ["齿轮箱"]);
  assert.ok(addComparison([a], make("x", ["主轴承"]), components).error);
  assert.ok(addComparison([a, make("b"), make("c"), make("d")], make("e"), components).error);
  assert.equal(addComparison([a], a, components).items.length, 0);
  assert.ok(addComparison([], { ...a, informationLevel: "catalog" }, components).error);
});
test("comparison keeps conditions and comparison baselines attached to numeric results", () => {
  const a = { ...make("a"), paperDetails: { operatingConditions: "台架试验", quantitativeFindings: [{ metric: "效率", value: "97", unit: "%", comparison: "同载荷基线", conditions: "额定工况" }] } };
  const fields = comparisonFields(a);
  assert.equal(fields.conditions, "台架试验");
  assert.deepEqual(fields.findings, [{ label: "效率", value: "97%", context: "同载荷基线；额定工况" }]);
  assert.equal(fields.process, "");
});
test("presentation uses only readable real-date articles and has at most six selections", () => {
  const articles = Array.from({ length: 9 }, (_, i) => make(String(i), i % 2 ? ["主轴承"] : ["齿轮箱"]));
  articles.push({ ...make("title-only"), informationLevel: "catalog" });
  const selected = presentationArticles(articles, { end, components });
  assert.equal(selected.length, 6);
  assert.equal(new Set(selected.map((a) => a.id)).size, 6);
  assert.ok(!selected.some((a) => a.id === "title-only"));
  const parts = selected.map((a) => components(a)[0]);
  assert.deepEqual(parts, ["齿轮箱", "齿轮箱", "齿轮箱", "主轴承", "主轴承", "主轴承"]);
});
test("source URLs only allow web protocols", () => {
  assert.equal(safeWebUrl("javascript:alert(1)"), "");
  assert.equal(safeWebUrl("https://example.org/paper"), "https://example.org/paper");
});
