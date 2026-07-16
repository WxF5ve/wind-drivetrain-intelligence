const VALID_VOTES = new Set(["useful", "questionable", "irrelevant", "broken"]);

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

async function aggregateFeedback(env, origin) {
  const result = await env.DB.prepare(`
    SELECT
      article_id,
      SUM(CASE WHEN vote = 'useful' THEN 1 ELSE 0 END) AS useful,
      SUM(CASE WHEN vote = 'questionable' THEN 1 ELSE 0 END) AS questionable,
      SUM(CASE WHEN vote = 'irrelevant' THEN 1 ELSE 0 END) AS irrelevant,
      SUM(CASE WHEN vote = 'broken' THEN 1 ELSE 0 END) AS broken,
      COUNT(*) AS total
    FROM feedback
    GROUP BY article_id
  `).all();
  const articles = (result.results || []).map((row) => ({
    articleId: row.article_id,
    useful: Number(row.useful || 0),
    questionable: Number(row.questionable || 0),
    irrelevant: Number(row.irrelevant || 0),
    broken: Number(row.broken || 0),
    total: Number(row.total || 0)
  }));
  return json({ generatedAt: new Date().toISOString(), articles }, 200, origin);
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
    return json({ ok: false, error: "not_found" }, 404, origin);
  }
};
