const VALID_VOTES = new Set(["useful", "questionable", "irrelevant", "broken"]);
const EXPERIENCE_FIELDS = {
  applicability: new Set(["supports", "conditional", "contradicts", "uncertain"]),
  component: new Set(["gearbox", "planetary", "high_speed", "main_bearing", "gear_bearing", "lubrication", "monitoring", "drivetrain", "other"]),
  failureMode: new Set(["micropitting", "wec", "scuffing", "tooth_failure", "bearing_damage", "electrical_damage", "lubrication", "monitoring", "loads", "manufacturing", "other", "not_applicable"]),
  evidenceLevel: new Set(["test_report", "failure_analysis", "multiple_cases", "single_case", "engineering_judgment"]),
  powerRange: new Set(["under_5mw", "5_10mw", "over_10mw", "unknown"]),
  environment: new Set(["onshore", "offshore", "test_bench", "unknown"])
};

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return allowed.includes(origin.replace(/\/$/, "")) ? origin : "";
}

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function validFeedback(payload) {
  return payload &&
    /^[a-f0-9]{12,64}$/i.test(String(payload.articleId || "")) &&
    /^[a-z0-9-]{8,80}$/i.test(String(payload.clientId || "")) &&
    (VALID_VOTES.has(payload.vote) || payload.vote === "clear");
}

async function saveFeedback(request, env, origin) {
  const payload = await request.json().catch(() => null);
  if (!validFeedback(payload)) return json({ ok: false, error: "invalid_feedback" }, 400, origin);
  if (payload.vote === "clear") {
    await env.DB.prepare("DELETE FROM feedback WHERE article_id = ?1 AND client_id = ?2")
      .bind(payload.articleId, payload.clientId)
      .run();
    return json({ ok: true }, 200, origin);
  }
  const reliabilityScore = Math.max(0, Math.min(100, Number(payload.reliabilityScore || 0)));
  await env.DB.prepare(`
    INSERT INTO feedback (article_id, client_id, vote, reliability_score, updated_at)
    VALUES (?1, ?2, ?3, ?4, datetime('now'))
    ON CONFLICT(article_id, client_id) DO UPDATE SET
      vote = excluded.vote,
      reliability_score = excluded.reliability_score,
      updated_at = datetime('now')
  `).bind(payload.articleId, payload.clientId, payload.vote, reliabilityScore).run();
  return json({ ok: true }, 200, origin);
}

function validExperience(payload) {
  return payload &&
    /^[a-f0-9]{12,64}$/i.test(String(payload.articleId || "")) &&
    /^[a-z0-9-]{8,80}$/i.test(String(payload.clientId || "")) &&
    (payload.action === "clear" || (
      EXPERIENCE_FIELDS.applicability.has(payload.applicability) &&
      EXPERIENCE_FIELDS.component.has(payload.component) &&
      EXPERIENCE_FIELDS.failureMode.has(payload.failureMode) &&
      EXPERIENCE_FIELDS.evidenceLevel.has(payload.evidenceLevel) &&
      EXPERIENCE_FIELDS.powerRange.has(payload.powerRange) &&
      EXPERIENCE_FIELDS.environment.has(payload.environment) &&
      Number.isInteger(Number(payload.confidence)) &&
      Number(payload.confidence) >= 1 && Number(payload.confidence) <= 5
    ));
}

async function saveExperience(request, env, origin) {
  const payload = await request.json().catch(() => null);
  if (!validExperience(payload)) return json({ ok: false, error: "invalid_experience" }, 400, origin);
  if (payload.action === "clear") {
    await env.DB.prepare("DELETE FROM engineering_experience WHERE article_id = ?1 AND client_id = ?2")
      .bind(payload.articleId, payload.clientId)
      .run();
    return json({ ok: true }, 200, origin);
  }
  await env.DB.prepare(`
    INSERT INTO engineering_experience (
      article_id, client_id, applicability, component, failure_mode, evidence_level,
      power_range, environment, confidence, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
    ON CONFLICT(article_id, client_id) DO UPDATE SET
      applicability = excluded.applicability,
      component = excluded.component,
      failure_mode = excluded.failure_mode,
      evidence_level = excluded.evidence_level,
      power_range = excluded.power_range,
      environment = excluded.environment,
      confidence = excluded.confidence,
      updated_at = datetime('now')
  `).bind(
    payload.articleId,
    payload.clientId,
    payload.applicability,
    payload.component,
    payload.failureMode,
    payload.evidenceLevel,
    payload.powerRange,
    payload.environment,
    Number(payload.confidence)
  ).run();
  return json({ ok: true }, 200, origin);
}

function experienceAggregates(rows = []) {
  const articles = new Map();
  for (const row of rows) {
    const article = articles.get(row.article_id) || {
      total: 0,
      supports: 0,
      conditional: 0,
      contradicts: 0,
      uncertain: 0,
      confidenceTotal: 0,
      evidence: {},
      contexts: {}
    };
    article.total += 1;
    article[row.applicability] = (article[row.applicability] || 0) + 1;
    article.confidenceTotal += Number(row.confidence || 0);
    article.evidence[row.evidence_level] = (article.evidence[row.evidence_level] || 0) + 1;
    const contextKey = [row.component, row.failure_mode, row.power_range, row.environment].join("|");
    article.contexts[contextKey] = (article.contexts[contextKey] || 0) + 1;
    articles.set(row.article_id, article);
  }
  return new Map([...articles.entries()].map(([articleId, value]) => [articleId, {
    total: value.total,
    supports: value.supports,
    conditional: value.conditional,
    contradicts: value.contradicts,
    uncertain: value.uncertain,
    averageConfidence: value.total ? Number((value.confidenceTotal / value.total).toFixed(2)) : 0,
    evidence: value.evidence,
    topContexts: Object.entries(value.contexts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([context, count]) => ({ context, count }))
  }]));
}

async function aggregateFeedback(env, origin) {
  const [result, experienceResult] = await Promise.all([
    env.DB.prepare(`
    SELECT
      article_id,
      SUM(CASE WHEN vote = 'useful' THEN 1 ELSE 0 END) AS useful,
      SUM(CASE WHEN vote = 'questionable' THEN 1 ELSE 0 END) AS questionable,
      SUM(CASE WHEN vote = 'irrelevant' THEN 1 ELSE 0 END) AS irrelevant,
      SUM(CASE WHEN vote = 'broken' THEN 1 ELSE 0 END) AS broken,
      COUNT(*) AS total
    FROM feedback
    GROUP BY article_id
  `).all(),
    env.DB.prepare(`
      SELECT article_id, applicability, component, failure_mode, evidence_level, power_range, environment, confidence
      FROM engineering_experience
    `).all()
  ]);
  const experiences = experienceAggregates(experienceResult.results || []);
  const articles = new Map();
  for (const row of result.results || []) {
    articles.set(row.article_id, {
      articleId: row.article_id,
      useful: Number(row.useful || 0),
      questionable: Number(row.questionable || 0),
      irrelevant: Number(row.irrelevant || 0),
      broken: Number(row.broken || 0),
      total: Number(row.total || 0)
    });
  }
  for (const [articleId, experience] of experiences) {
    const current = articles.get(articleId) || {
      articleId,
      useful: 0,
      questionable: 0,
      irrelevant: 0,
      broken: 0,
      total: 0
    };
    current.experience = experience;
    articles.set(articleId, current);
  }
  return json({ generatedAt: new Date().toISOString(), articles: [...articles.values()] }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin"
        }
      });
    }
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true }, 200, origin);
    if (url.pathname === "/aggregates" && request.method === "GET") return aggregateFeedback(env, origin);
    if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
    if (url.pathname === "/feedback" && request.method === "POST") return saveFeedback(request, env, origin);
    if (url.pathname === "/experience" && request.method === "POST") return saveExperience(request, env, origin);
    return json({ ok: false, error: "not_found" }, 404, origin);
  }
};
