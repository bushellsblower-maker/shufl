# SHUFL

Industrial shuffleboard scorekeeper. Cloudflare Worker **`shufl`** at **https://shufl.cybush.uk**.

Scores, player names, and match history stay in the browser (`localStorage`). The Worker does not store game data.

Publishing is **GitHub → Cloudflare** only (GitHub Actions, or Workers Builds). No laptop deploy.

## Stack

- Worker `shufl` records a fleet audit hit, then serves static assets
- `public/index.html` is the single-file dashboard (table photo embedded)
- `SHUFL.html` at the repo root is the same file, for offline download
- Analytics Engine dataset `cybush`, binding `AUDIT_HITS` (host, path, status)
- `npm run deploy` → `wrangler deploy` (Worker + custom domain `shufl.cybush.uk`)

`SITE_URL` and the hostname live in `wrangler.jsonc`.

## Publish (GitHub Actions)

Push or merge to `main`, or run **Actions → Publish to Cloudflare**. The workflow runs `npm ci` and `npm run deploy`.

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

The scorekeeper reads and writes `localStorage` on the device. There is no database and no admin login. Clearing site data for `shufl.cybush.uk` clears the games.

## Layout

```
public/index.html          served at /
SHUFL.html                 offline copy
src/index.ts               audit hit, then ASSETS.fetch
wrangler.jsonc             name, domain, Analytics Engine
.github/workflows/         typecheck + cloud publish
```
