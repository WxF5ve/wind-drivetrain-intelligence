import { cleanText } from "./articles.mjs";

const SUMMARY_CATEGORIES = new Set([
  "齿轮箱", "轴承", "润滑", "状态监测", "白色蚀刻裂纹", "标准政策", "学术论文", "行业资讯", "厂商动态"
]);

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          summary: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
          engineeringImpact: { type: "string" },
          category: { type: "string", enum: [...SUMMARY_CATEGORIES] },
          tags: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 }
        },
        required: ["id", "summary", "keyPoints", "engineeringImpact", "category", "tags"]
      }
    }
  },
  required: ["articles"]
};

const SYSTEM_INSTRUCTIONS = [
  "你是风电齿轮箱与轴承研发情报分析助手。",
  "仅依据给定标题和原始摘录总结，不得补造试验数据、结论、来源或因果关系。",
  "用户反馈只是复核信号，不是事实证据；反馈为负时应重新检查摘录，并明确证据不足之处。",
  "所有输出使用简洁中文，保留必要的英文缩写、标准号、材料名和故障机理术语。",
  "summary 用 60-110 个汉字说明资料做了什么、主要信息以及结论边界。",
  "keyPoints 必须给出三条可从输入核查的信息，不得重复标题。",
  "engineeringImpact 说明对设计、验证、运维或供应链的潜在意义，并明确需要进一步验证之处。",
  "论文统一归入学术论文；queryTopic 为 industry 的资料归入厂商动态；其余按最相关技术主题分类。",
  "只输出有效 JSON，不要输出 Markdown 代码围栏或额外说明。"
].join("\n");

export function resolveAiProvider(env = process.env) {
  const requested = String(env.AI_PROVIDER || "auto").trim().toLowerCase();
  if (!["auto", "deepseek", "openai", "none"].includes(requested)) {
    throw new Error(`不支持的 AI_PROVIDER: ${requested}`);
  }
  if (requested === "none") return null;
  if ((requested === "auto" || requested === "deepseek") && env.DEEPSEEK_API_KEY) {
    return {
      id: "deepseek",
      label: "DeepSeek",
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
      model: env.DEEPSEEK_MODEL || "deepseek-chat"
    };
  }
  if ((requested === "auto" || requested === "openai") && env.OPENAI_API_KEY) {
    return {
      id: "openai",
      label: "OpenAI",
      apiKey: env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",
      model: env.OPENAI_MODEL || "gpt-5-mini"
    };
  }
  return null;
}

function normalizedFeedback(value = {}) {
  const result = {};
  for (const key of ["useful", "questionable", "irrelevant", "broken"]) {
    result[key] = Math.max(0, Number(value[key] || 0));
  }
  result.total = result.useful + result.questionable + result.irrelevant + result.broken;
  return result;
}

export function feedbackNeedsAiReview(feedbackValue, previousAnalysis, minimumFeedback = 5) {
  const feedback = normalizedFeedback(feedbackValue);
  const negative = feedback.questionable + feedback.irrelevant;
  const alreadyReviewedAt = Number(previousAnalysis?.feedbackTotalAtAnalysis || 0);
  return feedback.total >= Number(minimumFeedback || 5) &&
    negative >= 3 &&
    negative / feedback.total >= 0.6 &&
    feedback.total > alreadyReviewedAt;
}

function inputArticles(articles) {
  return articles.map((article) => ({
    id: article.id,
    title: cleanText(article.title),
    source: cleanText(article.source),
    sourceType: article.sourceType,
    queryTopic: article.queryTopic || "technical",
    publishedAt: article.publishedAt,
    snippet: cleanText(article.snippet).slice(0, 1800),
    previousSummary: cleanText(article.previousSummary || "").slice(0, 600),
    feedback: normalizedFeedback(article.feedbackAggregate)
  }));
}

function cleanJsonText(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseSummaryJson(value, expectedIds) {
  const expected = new Set(expectedIds);
  const parsed = JSON.parse(cleanJsonText(value));
  if (!Array.isArray(parsed?.articles)) throw new Error("AI 摘要缺少 articles 数组");
  const summaries = new Map();
  for (const item of parsed.articles) {
    if (!expected.has(item?.id) || summaries.has(item.id)) continue;
    const summary = cleanText(item.summary);
    const keyPoints = Array.isArray(item.keyPoints) ? item.keyPoints.map(cleanText).filter(Boolean).slice(0, 3) : [];
    const engineeringImpact = cleanText(item.engineeringImpact);
    const tags = Array.isArray(item.tags) ? [...new Set(item.tags.map(cleanText).filter(Boolean))].slice(0, 5) : [];
    if (summary.length < 20 || keyPoints.length !== 3 || engineeringImpact.length < 10 ||
        !SUMMARY_CATEGORIES.has(item.category) || tags.length < 2) continue;
    summaries.set(item.id, {
      summary: summary.slice(0, 360),
      keyPoints,
      engineeringImpact: engineeringImpact.slice(0, 360),
      category: item.category,
      tags
    });
  }
  if (!summaries.size) throw new Error("AI 摘要未返回任何通过校验的资料");
  return summaries;
}

function extractOpenAiText(responseData) {
  if (typeof responseData.output_text === "string") return responseData.output_text;
  for (const output of responseData.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

async function fetchAiJson(url, options, fetchImpl, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (response.ok) return response.json();
      const detail = cleanText(await response.text()).slice(0, 240);
      if (attempt === retries || (response.status !== 429 && response.status < 500)) {
        throw new Error(`AI 请求失败: ${response.status} ${detail}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter, 2500 * (attempt + 1))));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("AI 请求重试后仍失败");
}

export async function summarizeBatch(provider, articles, fetchImpl = fetch) {
  if (!provider || !articles.length) return new Map();
  const payload = inputArticles(articles);
  let responseData;
  let text;

  if (provider.id === "deepseek") {
    responseData = await fetchAiJson(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTIONS },
          {
            role: "user",
            content: `请按以下 JSON Schema 分析资料并返回 JSON：\n${JSON.stringify(SUMMARY_SCHEMA)}\n输入资料：\n${JSON.stringify({ articles: payload })}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 5000,
        stream: false
      })
    }, fetchImpl);
    text = responseData.choices?.[0]?.message?.content || "";
  } else if (provider.id === "openai") {
    responseData = await fetchAiJson(`${provider.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: JSON.stringify(payload),
        text: {
          format: {
            type: "json_schema",
            name: "wind_drivetrain_weekly_summary",
            strict: true,
            schema: SUMMARY_SCHEMA
          }
        }
      })
    }, fetchImpl);
    text = extractOpenAiText(responseData);
  } else {
    throw new Error(`不支持的 AI 供应商: ${provider.id}`);
  }

  if (!text) throw new Error(`${provider.label} 未返回摘要文本`);
  return parseSummaryJson(text, articles.map((article) => article.id));
}

export async function summarizeInBatches(provider, articles, options = {}) {
  const batchSize = Math.max(1, Number(options.batchSize || process.env.AI_BATCH_SIZE || 6));
  const summaries = new Map();
  const errors = [];
  for (let index = 0; index < articles.length; index += batchSize) {
    const batch = articles.slice(index, index + batchSize);
    try {
      const batchSummaries = await summarizeBatch(provider, batch, options.fetchImpl || fetch);
      batchSummaries.forEach((value, key) => summaries.set(key, value));
    } catch (error) {
      errors.push(error);
      options.onBatchError?.(error, index / batchSize + 1, batch);
    }
  }
  if (!summaries.size && errors.length) throw errors[0];
  return summaries;
}
