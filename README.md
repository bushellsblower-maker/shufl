# SHUFL

Industrial shuffleboard scorekeeper. Cloudflare Worker **`shufl`** at **https://shufl.cybush.uk**.

Recent scores, player names, and match history stay in the browser (`localStorage`). Finished games are also posted to D1 so old history and the leaderboard survive a cleared device.

Publishing is **Cloudflare Workers Builds** on push to `main` (`npx wrangler deploy`). No laptop deploy.

Version: curl -sI https://shufl.cybush.uk/ | grep x-cybush-version ; /__version

## Stack

- Worker `shufl` records a fleet audit hit, serves `GET /__version`, serves `/api/games` and `/api/leaderboard` from D1, then serves static assets
- `public/index.html` is the single-file dashboard; the background table photo is `public/bg-board.jpg`
- `SHUFL.html` at the repo root is the same file, for offline download (keep `bg-board.jpg` next to it to see the photo)
- Analytics Engine dataset `cybush`, binding `AUDIT_HITS` (host, path, status)
- D1 database `shufl`, binding `DB` (finished games + `leaderboard` view)
- `npm run deploy` → `scripts/cf-publish.mjs` (create D1 if needed, apply migrations, deploy Worker + custom domain `shufl.cybush.uk`)

`SITE_URL` and the hostname live in `wrangler.jsonc`.

## Publish (Workers Builds)

Push to `main` deploys from the connected Cloudflare project. The live command is `npx wrangler deploy` (no separate dashboard build command). That command runs the Wrangler build step, which writes `src/version.generated.ts` before upload.

Workers Builds uses the connected Cloudflare account. You do not add `CLOUDFLARE_API_TOKEN` to the Git repository.

Zone `cybush.uk` must already be on that account. A successful deploy attaches `shufl.cybush.uk`. `run_worker_first` is on so `/` still writes an audit point before `index.html` is served.

`wrangler.jsonc` does not commit a `database_id`. `npx wrangler deploy` provisions D1 database `shufl` and binds it. The Worker creates the games table and leaderboard view on the first history request if migrations have not been applied yet. Set the deploy command to `npm run deploy` when you want the publish script to apply `migrations/` before the Worker starts.

GitHub Actions runs `.github/workflows/check.yml` only (typecheck and tests) on pull requests and pushes to `main`.

## Data

The scoring page does not list past games. **History**, next to New Game, opens them in a modal: recent matches from this device and saved matches from `GET /api/games`, plus a short win list from `GET /api/leaderboard`.

Each row has an **X**. Confirming in the in-app dialog removes a device-only game from `localStorage`. A game that was saved (or loaded from D1) is also removed with `DELETE /api/games/:id`.

A finished game is `POST`ed to `/api/games`. If the device is offline, the local copy is kept and the post is skipped. There is no admin login and no button that clears every game at once. The games table and leaderboard view are created by `migrations/0001_games.sql`, and the Worker applies that same SQL if the database is still empty.

## Layout

```
public/index.html          served at /
public/bg-board.jpg        background table photo
SHUFL.html                 offline copy
src/index.ts               version header, audit hit, history API, then ASSETS.fetch
migrations/0001_games.sql  games table + leaderboard view
scripts/write-version.mjs  git sha for X-Cybush-Version
scripts/cf-publish.mjs     create D1, migrate, deploy
wrangler.jsonc             name, domain, Analytics Engine, D1 binding
.github/workflows/         typecheck and tests
```
