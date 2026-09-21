import assert from "node:assert/strict";
import { test } from "node:test";
import { auditDataPoint } from "./index.ts";

test("audit point records host, path, and status", () => {
  const point = auditDataPoint(new URL("https://shufl.cybush.uk/"), 200);
  assert.deepEqual(point.indexes, ["shufl"]);
  assert.deepEqual(point.blobs, ["shufl.cybush.uk", "/", "200"]);
  assert.deepEqual(point.doubles, [200]);
});

test("audit point keeps the pathname and omits the query", () => {
  const point = auditDataPoint(new URL("https://shufl.cybush.uk/index.html?x=1"), 404);
  assert.deepEqual(point.blobs, ["shufl.cybush.uk", "/index.html", "404"]);
  assert.deepEqual(point.doubles, [404]);
});
