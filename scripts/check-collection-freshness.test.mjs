import test from "node:test";
import assert from "node:assert/strict";

import { collectionDateKey, shouldCollect } from "./check-collection-freshness.mjs";

test("collection date uses Beijing time across the UTC date boundary", () => {
  assert.equal(collectionDateKey("2026-07-26T16:30:00.000Z"), "2026-07-27");
});

test("scheduled backup skips collection when the Beijing date is already fresh", () => {
  assert.equal(shouldCollect({
    eventName: "schedule",
    generatedAt: "2026-07-27T00:40:00.000Z",
    now: new Date("2026-07-27T03:15:00.000Z")
  }), false);
});

test("scheduled backup collects when the latest data is from an earlier Beijing date", () => {
  assert.equal(shouldCollect({
    eventName: "schedule",
    generatedAt: "2026-07-21T02:41:49.954Z",
    now: new Date("2026-07-27T03:15:00.000Z")
  }), true);
});

test("manual dispatch always collects and ordinary pushes never collect", () => {
  const input = { generatedAt: "2026-07-27T00:40:00.000Z", now: new Date("2026-07-27T03:15:00.000Z") };
  assert.equal(shouldCollect({ ...input, eventName: "workflow_dispatch" }), true);
  assert.equal(shouldCollect({ ...input, eventName: "push" }), false);
});

test("an explicitly marked source update may force one push collection", () => {
  assert.equal(shouldCollect({
    eventName: "push",
    generatedAt: "2026-07-27T07:27:32.480Z",
    now: new Date("2026-07-27T09:00:00.000Z"),
    force: true
  }), true);
});
