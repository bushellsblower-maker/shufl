import { parseGameBody, parseGameId, parseLimit, roundCount } from "./games.ts";
import { ensureGamesSchema } from "./schema.ts";

const MAX_BODY = 48_000;

const INSERT_GAME = `
INSERT INTO games (
  id, played_at, name1, name2, score1, score2, target,
  winner_index, winner_name, rounds_json, hammer_mode, meta_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  played_at = excluded.played_at,
  name1 = excluded.name1,
  name2 = excluded.name2,
  score1 = excluded.score1,
  score2 = excluded.score2,
  target = excluded.target,
  winner_index = excluded.winner_index,
  winner_name = excluded.winner_name,
  rounds_json = excluded.rounds_json,
  hammer_mode = excluded.hammer_mode,
  meta_json = excluded.meta_json
`;

const LIST_GAMES = `
SELECT id, played_at, name1, name2, score1, score2, target,
       winner_index, winner_name, rounds_json, hammer_mode
FROM games
ORDER BY played_at DESC, id DESC
LIMIT ?
`;

const DELETE_GAME = `DELETE FROM games WHERE id = ?`;

const LIST_LEADERS = `
SELECT name, wins, games
FROM leaderboard
ORDER BY wins DESC, games DESC, name COLLATE NOCASE ASC
LIMIT ?
`;

type GameRow = {
  id: string;
  played_at: string;
  name1: string;
  name2: string;
  score1: number;
  score2: number;
  target: number;
  winner_index: number | null;
  winner_name: string | null;
  rounds_json: string;
  hammer_mode: string | null;
};

type LeaderRow = {
  name: string;
  wins: number;
  games: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

function gameJson(row: GameRow) {
  return {
    id: row.id,
    playedAt: row.played_at,
    names: [row.name1, row.name2],
    scores: [row.score1, row.score2],
    target: row.target,
    winnerIndex: row.winner_index,
    winnerName: row.winner_name,
    hammerMode: row.hammer_mode === "winner" ? "winner" : "turns",
    roundCount: roundCount(row.rounds_json),
  };
}

async function listGames(env: Env, url: URL): Promise<Response> {
  const limit = parseLimit(url.searchParams.get("limit"), 40, 100);
  const result = await env.DB.prepare(LIST_GAMES).bind(limit).all<GameRow>();
  return json({ games: (result.results ?? []).map(gameJson) });
}

async function listLeaders(env: Env, url: URL): Promise<Response> {
  const limit = parseLimit(url.searchParams.get("limit"), 20, 50);
  const result = await env.DB.prepare(LIST_LEADERS).bind(limit).all<LeaderRow>();
  const leaders = (result.results ?? []).map((row) => ({
    name: row.name,
    wins: Number(row.wins) || 0,
    games: Number(row.games) || 0,
  }));
  return json({ leaders });
}

async function createGame(request: Request, env: Env): Promise<Response> {
  const text = await readLimited(request, MAX_BODY);
  if (text === null) return json({ error: "Game is too large" }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "Game body must be JSON" }, 400);
  }
  const game = parseGameBody(parsed);
  if (!game.ok) return json({ error: game.error }, 400);
  const row = game.game;
  await env.DB.prepare(INSERT_GAME)
    .bind(
      row.id,
      row.playedAt,
      row.name1,
      row.name2,
      row.score1,
      row.score2,
      row.target,
      row.winnerIndex,
      row.winnerName,
      row.roundsJson,
      row.hammerMode,
      row.metaJson,
    )
    .run();
  return json({ ok: true, id: row.id });
}

async function deleteGame(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare(DELETE_GAME).bind(id).run();
  if (!result.meta.changes) return json({ error: "Game not found" }, 404);
  return json({ ok: true, id });
}

export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    await ensureGamesSchema(env.DB);
    if (url.pathname.startsWith("/api/games/")) {
      if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
      const id = parseGameId(url.pathname.slice("/api/games/".length));
      if (!id) return json({ error: "Invalid game id" }, 400);
      return deleteGame(env, id);
    }
    if (url.pathname === "/api/games" && request.method === "GET") return listGames(env, url);
    if (url.pathname === "/api/games" && request.method === "POST") return createGame(request, env);
    if (url.pathname === "/api/leaderboard" && request.method === "GET") return listLeaders(env, url);
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("shufl history", error instanceof Error ? error.message : "failed");
    return json({ error: "History store failed" }, 500);
  }
}
