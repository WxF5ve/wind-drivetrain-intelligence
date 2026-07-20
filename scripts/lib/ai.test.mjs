import test from "node:test";
import assert from "node:assert/strict";
import {
  feedbackNeedsAiReview,
  experienceNeedsAiReview,
  parseSummaryJson,
  resolveAiProvider,
  summarizeBatch,
  summarizeInBatches
} from "./ai.mjs";

function validSummary(id = "article-1") {
  return {
    articles: [{
      id,
      titleZh: "风电齿轮箱状态监测",
      summary: "该资料基于公开摘录分析风电齿轮箱状态监测方法，当前信息未给出完整试验边界，工程应用前仍需核对原文。",
      keyPoints: ["研究对象为风电齿轮箱", "资料包含状态监测方法", "输入未提供完整试验参数"],
      engineeringImpact: "可用于筛选状态监测方向，但需要结合机型、载荷谱和验证数据进一步确认。",
      category: "学术论文",
      tags: ["齿轮箱", "状态监测"],
      paperDetails: {
        objective: "识别齿轮箱状态异常",
        methods: "采用状态监测算法处理振动数据",
        testObject: "风电齿轮箱",
        operatingConditions: "公开摘录未披露",
        quantitativeFindings: [{
          metric: "识别准确率",
          value: "95",
          unit: "%",
          comparison: "高于基准方法",
          conditions: "试验数据集",
          evidence: "公开摘要"
        }],
        limitations: ["缺少现场工况验证"]
      },
      industryDetails: {
        eventType: "",
        companies: [],
        location: "",
        capacity: "",
        investment: "",
        timeline: "",
        supplyChainImpact: "",
        verificationStatus: "",
        quantitativeFacts: []
      }
    }]
  };
}

test("DeepSeek is selected without exposing unrelated credentials", () => {
  const provider = resolveAiProvider({
    AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "secret-value",
    DEEPSEEK_MODEL: "deepseek-chat"
  });
  assert.equal(provider.id, "deepseek");
  assert.equal(provider.model, "deepseek-chat");
  assert.equal(provider.baseUrl, "https://api.deepseek.com");
});

test("automatic provider selection falls back safely when no key exists", () => {
  assert.equal(resolveAiProvider({ AI_PROVIDER: "auto" }), null);
  assert.equal(resolveAiProvider({ AI_PROVIDER: "none", DEEPSEEK_API_KEY: "ignored" }), null);
});

test("negative aggregate feedback triggers one review per new feedback snapshot", () => {
  const feedback = { useful: 1, questionable: 3, irrelevant: 2, broken: 0 };
  assert.equal(feedbackNeedsAiReview(feedback, null, 5), true);
  assert.equal(feedbackNeedsAiReview(feedback, { feedbackTotalAtAnalysis: 6 }, 5), false);
  assert.equal(feedbackNeedsAiReview({ useful: 4, questionable: 1 }, null, 5), false);
});

test("contradictory engineering experience triggers a bounded AI review", () => {
  const experience = { total: 5, supports: 1, conditional: 1, contradicts: 3 };
  assert.equal(experienceNeedsAiReview(experience, null, 3), true);
  assert.equal(experienceNeedsAiReview(experience, { experienceTotalAtAnalysis: 5 }, 3), false);
  assert.equal(experienceNeedsAiReview({ total: 5, contradicts: 1 }, null, 3), false);
});

test("AI JSON parser accepts fenced JSON and rejects unsupported records", () => {
  const parsed = parseSummaryJson(`\`\`\`json\n${JSON.stringify(validSummary())}\n\`\`\``, [{
    id: "article-1",
    title: "Wind turbine gearbox monitoring",
    snippet: "The reported identification accuracy was 95%."
  }]);
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get("article-1").keyPoints.length, 3);
  assert.equal(parsed.get("article-1").paperDetails.quantitativeFindings[0].value, "95");
  assert.throws(() => parseSummaryJson(JSON.stringify(validSummary("unknown")), ["article-1"]));
});

test("quantitative findings are removed when the source excerpt does not contain the number", () => {
  const parsed = parseSummaryJson(JSON.stringify(validSummary()), [{
    id: "article-1",
    title: "Wind turbine gearbox monitoring",
    snippet: "The public abstract does not disclose numerical accuracy."
  }]);
  assert.equal(parsed.get("article-1").paperDetails.quantitativeFindings.length, 0);
});

test("DeepSeek adapter uses chat completions and validates its response", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validSummary()) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const summaries = await summarizeBatch({
    id: "deepseek",
    label: "DeepSeek",
    apiKey: "secret-value",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  }, [{
    id: "article-1",
    title: "Wind turbine gearbox monitoring",
    source: "Journal",
    sourceType: "论文",
    queryTopic: "technical",
    snippet: "A public abstract reports 95% accuracy for wind turbine gearbox condition monitoring."
  }], fetchImpl);
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.body.response_format.type, "json_object");
  assert.equal(request.options.headers.Authorization, "Bearer secret-value");
  assert.equal(summaries.size, 1);
});

test("batch summarization preserves successful batches when one batch fails", async () => {
  const errors = [];
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return new Response("bad request", { status: 400 });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validSummary("article-2")) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const articles = ["article-1", "article-2"].map((id) => ({
    id,
    title: "Wind turbine gearbox monitoring",
    source: "Journal",
    sourceType: "论文",
    snippet: "A public abstract about wind turbine gearbox condition monitoring."
  }));
  const summaries = await summarizeInBatches({
    id: "deepseek",
    label: "DeepSeek",
    apiKey: "secret-value",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  }, articles, { batchSize: 1, fetchImpl, onBatchError: (error) => errors.push(error.message) });
  assert.equal(summaries.size, 1);
  assert.equal(summaries.has("article-2"), true);
  assert.equal(errors.length, 1);
});
