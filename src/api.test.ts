import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api.ts";
import { parseGameBody, parseLimit } from "./games.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function memoryDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(root, "migrations/0001_games.sql"), "utf8"));
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        bind(...values: Array<string | number | null>) {
          return {
            async run() {
              const info = statement.run(...values);
              return { success: true as const, results: [], meta: { changes: Number(info.changes) || 0 } };
            },
            async all() {
              return { success: true as const, results: statement.all(...values) };
            },
          };
        },
      };
    },
  };
}

function envWith(db: ReturnType<typeof memoryDb>) {
  return { DB: db } as unknown as Env;
}

const finished = {
  id: "game-1",
  playedAt: "2026-09-22T12:00:00.000Z",
  names: ["Ada", "BOB"],
  scores: [15, 10],
  target: 15,
  winner: 0,
  rounds: [{ n: 1, pts: [15, 10] }],
  hammerMode: "turns",
};

test("parseLimit keeps a sane page size", () => {
  assert.equal(parseLimit(null, 40, 100), 40);
  assert.equal(parseLimit("8", 40, 100), 8);
  assert.equal(parseLimit("500", 40, 100), 100);
  assert.equal(parseLimit("0", 40, 100), 40);
  assert.equal(parseLimit("nope", 40, 100), 40);
});

test("parseGameBody accepts a finished match and rejects a tie", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const parsed = parseGameBody(finished, now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.game.winnerName, "Ada");
  assert.equal(parsed.game.name1, "Ada");
  assert.equal(parsed.game.hammerMode, "turns");
  assert.equal(parsed.game.playedAt, "2026-09-22T12:00:00.000Z");

  const tie = parseGameBody({ ...finished, scores: [15, 15], winner: 0 }, now);
  assert.equal(tie.ok, false);
});

test("finished games land in D1 and the leaderboard is case-normalized", async () => {
  const env = envWith(memoryDb());
  const created = await handleApi(
    new Request("https://shufl.cybush.uk/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(finished),
    }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { ok: true, id: "game-1" });

  await handleApi(
    new Request("https://shufl.cybush.uk/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...finished,
        id: "game-2",
        playedAt: "2026-09-21T12:00:00.000Z",
        names: ["ADA", "Cara"],
        scores: [21, 18],
        target: 21,
        winner: 0,
        hammerMode: "winner",
      }),
    }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );

  const again = await handleApi(
    new Request("https://shufl.cybush.uk/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...finished, scores: [16, 9] }),
    }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  assert.equal(again.status, 200);

  const list = await handleApi(
    new Request("https://shufl.cybush.uk/api/games?limit=1"),
    env,
    new URL("https://shufl.cybush.uk/api/games?limit=1"),
  );
  const listed = (await list.json()) as { games: Array<{ id: string; names: string[]; scores: number[]; winnerName: string; roundCount: number }> };
  assert.equal(listed.games.length, 1);
  assert.equal(listed.games[0].id, "game-1");
  assert.deepEqual(listed.games[0].names, ["Ada", "BOB"]);
  assert.deepEqual(listed.games[0].scores, [16, 9]);
  assert.equal(listed.games[0].winnerName, "Ada");
  assert.equal(listed.games[0].roundCount, 1);

  const board = await handleApi(
    new Request("https://shufl.cybush.uk/api/leaderboard"),
    env,
    new URL("https://shufl.cybush.uk/api/leaderboard"),
  );
  const leaders = (await board.json()) as { leaders: Array<{ name: string; wins: number; games: number }> };
  const ada = leaders.leaders.find((row) => row.name.toLowerCase() === "ada");
  assert.ok(ada);
  assert.equal(ada.wins, 2);
  assert.equal(ada.games, 2);
  const bob = leaders.leaders.find((row) => row.name === "BOB");
  assert.equal(bob?.wins, 0);
  assert.equal(bob?.games, 1);
});

test("api rejects a bad game and an unknown path", async () => {
  const env = envWith(memoryDb());
  const bad = await handleApi(
    new Request("https://shufl.cybush.uk/api/games", {
      method: "POST",
      body: JSON.stringify({ names: ["A", "B"], scores: [1, 1], target: 15, winner: 0 }),
    }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  assert.equal(bad.status, 400);

  const missing = await handleApi(
    new Request("https://shufl.cybush.uk/api/games", { method: "DELETE" }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  assert.equal(missing.status, 405);

  const removed = await handleApi(
    new Request("https://shufl.cybush.uk/api/games/game-1", { method: "DELETE" }),
    env,
    new URL("https://shufl.cybush.uk/api/games/game-1"),
  );
  assert.equal(removed.status, 404);

  const saved = await handleApi(
    new Request("https://shufl.cybush.uk/api/games", {
      method: "POST",
      body: JSON.stringify(finished),
    }),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  assert.equal(saved.status, 200);
  const deleted = await handleApi(
    new Request("https://shufl.cybush.uk/api/games/game-1", { method: "DELETE" }),
    env,
    new URL("https://shufl.cybush.uk/api/games/game-1"),
  );
  assert.equal(deleted.status, 200);
  const after = await handleApi(
    new Request("https://shufl.cybush.uk/api/games"),
    env,
    new URL("https://shufl.cybush.uk/api/games"),
  );
  const body = (await after.json()) as { games: unknown[] };
  assert.deepEqual(body.games, []);

  const badId = await handleApi(
    new Request("https://shufl.cybush.uk/api/games/nope%20id", { method: "DELETE" }),
    env,
    new URL("https://shufl.cybush.uk/api/games/nope%20id"),
  );
  assert.equal(badId.status, 400);
});

test("worker routes history before assets", () => {
  const src = readFileSync(join(root, "src/index.ts"), "utf8");
  assert.match(src, /pathname === "\/api\/games"/);
  assert.match(src, /pathname\.startsWith\("\/api\/games\/"\)/);
  assert.match(src, /pathname === "\/api\/leaderboard"/);
  assert.ok(src.indexOf("handleApi") < src.indexOf("env.ASSETS.fetch"));
  const publish = readFileSync(join(root, "scripts/cf-publish.mjs"), "utf8");
  assert.match(publish, /DB_NAME = "shufl"/);
  assert.match(publish, /"d1", "migrations", "apply", "DB", "--remote"/);
  assert.match(publish, /CLOUDFLARE_API_TOKEN/);
  assert.equal(publish.includes("ADMIN_PASSWORD"), false);
});
