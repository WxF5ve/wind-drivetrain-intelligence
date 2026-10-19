import { readFile, writeFile } from "node:fs/promises";
import { registryPlan, registryCoverage, isVerifiedRecent } from "./source-registry.mjs";

export async function writeSourceCoverage(destination) {
  const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  const registry = await read("../../config/weekly-source-registry.json");
  const config = await read("../../config/sources.json");
  const data = await read("../../public/data/articles.json");
  const end = new Date(data.generatedAt).getTime();
  const start = new Date(data.period?.from || end - 30 * 86400000).getTime();
  const recorded = data.collectionStatus.registry;
  const recordedIds = new Set((recorded?.entries || []).map((entry) => entry.id));
  const entries = recorded?.referenceDate === registry.referenceDate && registry.sources.every((entry) => recordedIds.has(entry.id))
    ? recorded.entries
    : registryCoverage(registryPlan(registry, config), data.collectionStatus.sources,
      data.articles.filter((a) => a.collectedAt === data.generatedAt && isVerifiedRecent(a, start, end)), data.generatedAt);
  const result = { reference: registry.reference, referenceDate: registry.referenceDate, generatedAt: data.generatedAt, entries };
  if (destination) await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
