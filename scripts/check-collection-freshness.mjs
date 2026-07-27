import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function collectionDateKey(value, timeZone = "Asia/Shanghai") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shouldCollect({ eventName, generatedAt, now = new Date(), timeZone = "Asia/Shanghai", force = false }) {
  if (force) return true;
  if (eventName === "workflow_dispatch") return true;
  if (eventName !== "schedule") return false;
  const generatedDate = collectionDateKey(generatedAt, timeZone);
  const currentDate = collectionDateKey(now, timeZone);
  return !generatedDate || generatedDate !== currentDate;
}

function readGeneratedAt(dataPath) {
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf8")).generatedAt || "";
  } catch (error) {
    console.warn(`无法读取采集时间，将执行采集：${error.message}`);
    return "";
  }
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME || "workflow_dispatch";
  const force = /^(?:1|true|yes)$/i.test(String(process.env.FORCE_COLLECTION || ""));
  const timeZone = process.env.COLLECTION_TIME_ZONE || "Asia/Shanghai";
  const dataPath = path.resolve(process.env.COLLECTION_DATA_PATH || "public/data/articles.json");
  const generatedAt = readGeneratedAt(dataPath);
  const collect = shouldCollect({ eventName, generatedAt, timeZone, force });
  const output = `should_collect=${collect}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
  console.log(JSON.stringify({ eventName, force, timeZone, generatedAt, today: collectionDateKey(new Date(), timeZone), shouldCollect: collect }));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
