# SHUFL

Industrial shuffleboard scorekeeper. Cloudflare Worker **`shufl`** at **https://shufl.cybush.uk**.

Recent scores, player names, and match history stay in the browser (`localStorage`). Finished games are also posted to D1 so old history and the leaderboard survive a cleared device.

Publishing is **GitHub → Cloudflare** only (GitHub Actions, or Workers Builds). No laptop deploy.

## Stack

- Worker `shufl` records a fleet audit hit, serves `/api/games` and `/api/leaderboard` from D1, then serves static assets
- `public/index.html` is the single-file dashboard (table photo embedded)
- `SHUFL.html` at the repo root is the same file, for offline download
- Analytics Engine dataset `cybush`, binding `AUDIT_HITS` (host, path, status)
- D1 database `shufl`, binding `DB` (finished games + `leaderboard` view)
- `npm run deploy` → `scripts/cf-publish.mjs` (create D1 if needed, apply migrations, deploy Worker + custom domain `shufl.cybush.uk`)

`SITE_URL` and the hostname live in `wrangler.jsonc`.

## Publish (GitHub Actions)

Push or merge to `main`, or run **Actions → Publish to Cloudflare**. The workflow runs `npm ci` and `npm run deploy`. That script creates D1 database `shufl` when it is missing, writes the id into the publish checkout, applies `migrations/`, and deploys the Worker.

Repository secrets (Settings → Secrets and variables → Actions) on **this** repo:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploy Workers and attach a custom domain on zone `cybush.uk` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns `cybush.uk` |

These are the same secret **names** Adonis uses. GitHub Actions secrets are per repository, so values stored on Adonis are not visible here. Add both secrets on `bushellsblower-maker/shufl`. Do not commit token values.

Zone `cybush.uk` must already be on that account. A successful deploy creates Worker `shufl` and attaches `shufl.cybush.uk`. `run_worker_first` is on so `/` still writes an audit point before `index.html` is served.

## Publish (Workers Builds)

Same deploy command, from the Cloudflare dashboard:

1. Workers & Pages → Create → Import a repository → `bushellsblower-maker/shufl`
2. Production branch: `main`
3. Build command: `npm ci`
4. Deploy command: `npm run deploy`

Workers Builds uses the connected Cloudflare account. You do not add `CLOUDFLARE_API_TOKEN` to the Git repository for that path. GitHub Actions is enough once the two secrets above exist.

`wrangler.jsonc` does not commit a `database_id`. The default Workers Builds command, `npx wrangler deploy`, provisions D1 database `shufl` and binds it. The Worker creates the games table and leaderboard view on the first history request if migrations have not been applied yet. Set the deploy command to `npm run deploy` when you want the publish script to apply `migrations/` before the Worker starts.

## Data

The scoring page does not list past games. **History**, next to New Game, opens them in a modal: recent matches from this device and saved matches from `GET /api/games`, plus a short win list from `GET /api/leaderboard`.

Each row has an **X**. Confirming in the in-app dialog removes a device-only game from `localStorage`. A game that was saved (or loaded from D1) is also removed with `DELETE /api/games/:id`.

A finished game is `POST`ed to `/api/games`. If the device is offline, the local copy is kept and the post is skipped. There is no admin login and no button that clears every game at once. The games table and leaderboard view are created by `migrations/0001_games.sql`, and the Worker applies that same SQL if the database is still empty.

## Layout

```
public/index.html          served at /
SHUFL.html                 offline copy
src/index.ts               audit hit, history API, then ASSETS.fetch
migrations/0001_games.sql  games table + leaderboard view
scripts/cf-publish.mjs     create D1, migrate, deploy
wrangler.jsonc             name, domain, Analytics Engine, D1 binding
.github/workflows/         typecheck + cloud publish
```
