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

## Data

The scorekeeper reads and writes recent history in `localStorage` on the device. **Clear Recent History** removes only that local list.

A finished game is also `POST`ed to `/api/games`. If the device is offline, the local archive is kept and the post is skipped. **View Old History** loads `GET /api/games` (newest first) and a short `GET /api/leaderboard` (wins and games played, names matched without case). There is no admin login. Clearing site data does not delete the D1 archive.

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
