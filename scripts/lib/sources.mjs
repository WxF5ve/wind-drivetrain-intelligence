function normalizedDomain(value = "") {
  return String(value).trim().toLowerCase().replace(/^www\./, "").replace(/\/$/, "");
}

export function isAllowedPublisherUrl(value, allowedDomains = []) {
  if (!value || !allowedDomains.length) return false;
  try {
    const hostname = normalizedDomain(new URL(value).hostname);
    return allowedDomains
      .map(normalizedDomain)
      .filter(Boolean)
      .some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function buildDomainNewsQueries(source = {}) {
  const searchTerms = String(source.searchTerms || "").trim();
  if (!searchTerms) return [];
  return [...new Set((source.allowedDomains || []).map(normalizedDomain).filter(Boolean))]
    .map((domain) => ({ domain, query: `site:${domain} ${searchTerms}` }));
}

function normalizedJournal(value = "") {
  return String(value).trim().toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function isAllowedResearchJournal(value, allowedJournals = []) {
  if (!allowedJournals.length) return true;
  const journal = normalizedJournal(value);
  return Boolean(journal) && allowedJournals
    .map(normalizedJournal)
    .filter(Boolean)
    .some((allowed) => journal === allowed);
}

export function classifyChannelResult(result, previous = {}) {
  if (result?.status !== "fulfilled") {
    return { status: "failed", requestStatus: "failed", zeroFetchStreak: 0 };
  }
  const fetched = Array.isArray(result.value) ? result.value.length : 0;
  if (fetched > 0) {
    return { status: "ok", requestStatus: "ok", zeroFetchStreak: 0 };
  }
  const previousFetched = Number(previous?.fetched || 0);
  const previousWasEmpty = previous?.requestStatus === "ok" ||
    ["ok", "empty", "low-yield"].includes(previous?.status);
  const zeroFetchStreak = previousWasEmpty && previousFetched === 0
    ? Math.max(1, Number(previous?.zeroFetchStreak || 1)) + 1
    : 1;
  return {
    status: zeroFetchStreak >= 2 ? "low-yield" : "empty",
    requestStatus: "ok",
    zeroFetchStreak
  };
}
