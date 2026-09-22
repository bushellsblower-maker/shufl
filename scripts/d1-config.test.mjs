import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  findDatabase,
  isPlaceholderDatabaseId,
  parseCreatedDatabaseId,
  parseD1List,
  patchDatabaseId,
} from "./d1-config.mjs";

describe("parseD1List", () => {
  it("reads wrangler --json arrays and API result wrappers", () => {
    const rows = parseD1List([
      { name: "shufl", uuid: "11111111-1111-1111-1111-111111111111" },
      { database_name: "other", database_id: "22222222-2222-2222-2222-222222222222" },
    ]);
    assert.equal(findDatabase(rows, "shufl")?.id, "11111111-1111-1111-1111-111111111111");
    assert.equal(
      parseD1List({ result: [{ name: "shufl", id: "11111111-1111-1111-1111-111111111111" }] })[0]
        .id,
      "11111111-1111-1111-1111-111111111111",
    );
    const noisy = parseD1List(
      'wrangler banner\n[{"name":"shufl","uuid":"11111111-1111-1111-1111-111111111111"}]\n',
    );
    assert.equal(noisy[0].id, "11111111-1111-1111-1111-111111111111");
  });
});

describe("patchDatabaseId", () => {
  it("inserts a real id when wrangler.jsonc leaves database_id unset", () => {
    const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    assert.equal(source.includes("00000000-0000-0000-0000-000000000000"), false);
    assert.equal(source.includes('"database_id"'), false);
    const next = patchDatabaseId(source, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.match(next, /"database_name": "shufl",\n\s+"database_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"/);
    const replaced = patchDatabaseId(next, "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.match(replaced, /"database_id": "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"/);
    assert.equal(replaced.includes("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), false);
    assert.equal(isPlaceholderDatabaseId("00000000-0000-0000-0000-000000000000"), true);
  });
});

describe("parseCreatedDatabaseId", () => {
  it("extracts the UUID from wrangler create output", () => {
    const id = parseCreatedDatabaseId(`
Created your new D1 database.
database_name = "shufl"
database_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
`);
    assert.equal(id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});
