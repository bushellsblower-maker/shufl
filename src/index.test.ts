import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { auditDataPoint, versionPayload, withCybushVersion } from "./index.ts";
import { BUILT, SHA } from "./version.generated.ts";

function testEnv(options?: { versionId?: string; asset?: Response }): Env {
  return {
    AUDIT_HITS: { writeDataPoint() {} },
    ASSETS: {
      async fetch() {
        return options?.asset ?? new Response("missing", { status: 404 });
      },
    },
    ...(options?.versionId
      ? { CF_VERSION: { id: options.versionId, tag: "t", timestamp: BUILT } }
      : {}),
  } as Env;
}

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

test("generated stamp is a 7-char sha or dev, built in UTC", () => {
  assert.match(SHA, /^([0-9a-f]{7}|dev)$/);
  assert.match(BUILT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("version payload names the worker and omits secrets", () => {
  assert.deepEqual(versionPayload(undefined), {
    app: "shufl",
    sha: SHA,
    built: BUILT,
    cf_version_id: null,
  });
  assert.deepEqual(versionPayload("ver-1").cf_version_id, "ver-1");
});

test("GET /__version is uncached JSON before assets", async () => {
  let assetsCalled = false;
  const env = testEnv({ versionId: "ver-9" });
  env.ASSETS = {
    async fetch() {
      assetsCalled = true;
      return new Response("nope", { status: 404 });
    },
  };
  const response = await worker.fetch(new Request("https://shufl.cybush.uk/__version?x=1"), env);
  assert.equal(assetsCalled, false);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("x-cybush-version"), SHA);
  assert.deepEqual(await response.json(), {
    app: "shufl",
    sha: SHA,
    built: BUILT,
    cf_version_id: "ver-9",
  });
});

test("GET /__version reports null when version metadata is absent", async () => {
  const response = await worker.fetch(new Request("https://shufl.cybush.uk/__version"), testEnv());
  const body = (await response.json()) as { cf_version_id: string | null };
  assert.equal(body.cf_version_id, null);
  assert.equal(response.headers.get("x-cybush-version"), SHA);
});

test("asset responses keep their headers and gain X-Cybush-Version", async () => {
  const response = await worker.fetch(
    new Request("https://shufl.cybush.uk/"),
    testEnv({
      asset: new Response("page", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "page");
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.equal(response.headers.get("x-cybush-version"), SHA);
});

test("version header is cloned onto asset responses", async () => {
  const response = withCybushVersion(
    new Response("page", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "page");
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.equal(response.headers.get("x-cybush-version"), SHA);
});
