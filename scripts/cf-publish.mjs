#!/usr/bin/env node
/**
 * Publish SHUFL from GitHub Actions or Cloudflare Workers Builds.
 * Creates D1 `shufl` if needed, applies migrations, then deploys Worker `shufl`
 * (including shufl.cybush.uk).
 *
 * Not for laptops or the coordinator box.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findDatabase,
  isPlaceholderDatabaseId,
  parseCreatedDatabaseId,
  parseD1List,
  patchDatabaseId,
} from "./d1-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = existsSync(join(ROOT, "node_modules", ".bin", "wrangler"))
  ? [join(ROOT, "node_modules", ".bin", "wrangler")]
  : ["npx", "--yes", "wrangler"];
const CONFIG = join(ROOT, "wrangler.jsonc");
const DB_NAME = "shufl";

process.env.CI = "true";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function cloudAuth() {
  const workersBuilds = process.env.WORKERS_CI === "1";
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  if (workersBuilds || (token && account)) {
    return { workersBuilds, token, account };
  }
  fail(`This publish script runs only on GitHub Actions or Cloudflare Workers Builds.

Add GitHub repository secrets (Settings → Secrets and variables → Actions):
  CLOUDFLARE_API_TOKEN    Workers edit + D1 edit + Workers Routes edit
  CLOUDFLARE_ACCOUNT_ID   Cloudflare account id

Or connect this repo in the Cloudflare dashboard:
  Workers → shufl → Settings → Builds → GitHub → branch main
  Deploy command: npm run deploy

Do not publish from a laptop or the coordinator machine.`);
}

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(WRANGLER[0], [...WRANGLER.slice(1), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    stdio: capture ? ["pipe", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(detail || `wrangler ${args.join(" ")} failed (${result.status})`);
  }
  return result.stdout ?? "";
}

function ensureDatabase() {
  let rows = [];
  try {
    rows = parseD1List(wrangler(["d1", "list", "--json"], { capture: true }));
  } catch (error) {
    fail(`Could not list D1 databases. Check CLOUDFLARE_API_TOKEN permissions include D1 edit.\n${error.message}`);
  }

  const existing = findDatabase(rows, DB_NAME);
  if (existing) {
    console.log(`Using existing D1 database ${DB_NAME} (${existing.id})`);
    return existing.id;
  }

  console.log(`Creating D1 database ${DB_NAME}…`);
  let stdout = "";
  try {
    stdout = wrangler(["d1", "create", DB_NAME, "--location", "weur"], { capture: true });
    process.stdout.write(stdout);
  } catch (error) {
    fail(`Could not create D1 database ${DB_NAME}.\n${error.message}`);
  }
  const created = parseCreatedDatabaseId(stdout);
  if (!created) {
    fail("D1 create succeeded but no database_id was returned.");
  }
  return created;
}

function writeDatabaseId(id) {
  const source = readFileSync(CONFIG, "utf8");
  const next = patchDatabaseId(source, id);
  if (next !== source) {
    writeFileSync(CONFIG, next);
    console.log("Bound wrangler.jsonc database_id for this cloud publish.");
  } else if (isPlaceholderDatabaseId(id)) {
    fail("D1 database_id is still a placeholder.");
  }
}

try {
  cloudAuth();
  const id = ensureDatabase();
  writeDatabaseId(id);
  console.log("Applying D1 migrations…");
  wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
  console.log("Deploying Worker shufl (custom domain from wrangler.jsonc)…");
  wrangler(["deploy"]);
  console.log("Published. Public host: https://shufl.cybush.uk");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
