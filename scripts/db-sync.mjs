// On-demand product/category sync between the local D1 (vite dev) and the remote
// D1 (bosbadrinksnack.com). The two databases are otherwise independent — run this
// when you want one to match the other.
//
// FIXED: DB was hardcoded to "bosbapremiumfoods" (fork-copy bug, never updated) —
// db:push would have silently overwritten the SIBLING site's (Bosba Premium Foods)
// live production database instead of this one's, and db:pull would have pulled
// their products/categories into this site. Now matches this project's own
// wrangler.jsonc d1_databases[0].database_name.
//
//   npm run db:pull            remote (bosbadrinksnack.com) -> local        (overwrites local)
//   npm run db:push -- --yes   local -> remote (bosbadrinksnack.com)        (overwrites PROD)
//
// Only `categories`, `products`, `product_variations`, and `product_images` are
// synced. Media image blobs, users, sessions, and orders are intentionally left
// alone. The destination is backed up to a SQL file under the OS temp dir before
// anything is overwritten.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB = "bosba-drink-snack";
// Parents before children (FK order) — product_variations and product_images
// both reference products.id with onDelete: "cascade".
const TABLES = ["categories", "products", "product_variations", "product_images"];

const dir = process.argv[2];
const confirmed = process.argv.includes("--yes");
if (dir !== "push" && dir !== "pull") {
  console.error("Usage: node scripts/db-sync.mjs <push|pull> [--yes]");
  process.exit(1);
}

const srcFlag = dir === "push" ? "--local" : "--remote";
const dstFlag = dir === "push" ? "--remote" : "--local";
const srcName = dir === "push" ? "LOCAL" : "REMOTE (bosbadrinksnack.com)";
const dstName = dir === "push" ? "REMOTE (bosbadrinksnack.com)" : "LOCAL";

if (dir === "push" && !confirmed) {
  console.error(
    `\n⚠️  This OVERWRITES production (bosbadrinksnack.com) products & categories with your LOCAL data.\n` +
      `   There is no undo for live customers. If you're sure, run:\n\n` +
      `     npm run db:push -- --yes\n`,
  );
  process.exit(1);
}

const readRows = (flag, table) => {
  const out = execSync(
    `npx wrangler d1 execute ${DB} ${flag} --json --command "SELECT * FROM ${table}"`,
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  try {
    return JSON.parse(out)[0].results;
  } catch {
    throw new Error(`Could not read ${table} from ${flag} — is the database reachable?`);
  }
};

const esc = (v) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

const insertsFor = (table, rows) =>
  rows
    .map((r) => {
      const cols = Object.keys(r);
      return `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((c) => esc(r[c])).join(",")});`;
    })
    .join("\n");

const buildReplaceSql = (dataByTable) =>
  [
    "PRAGMA foreign_keys=OFF;",
    ...[...TABLES].reverse().map((t) => `DELETE FROM ${t};`),
    ...TABLES.map((t) => insertsFor(t, dataByTable[t])),
  ].join("\n");

console.log(`\nSync ${TABLES.join(", ")}: ${srcName} -> ${dstName}\n`);

// 1. read source
const src = {};
for (const t of TABLES) {
  src[t] = readRows(srcFlag, t);
  console.log(`  source ${t}: ${src[t].length} rows`);
}

// 2. back up destination
const dst = {};
for (const t of TABLES) dst[t] = readRows(dstFlag, t);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(os.tmpdir(), `dbsync-backup-${dir}-${stamp}.sql`);
fs.writeFileSync(backupPath, buildReplaceSql(dst));
console.log(`\n  backup of ${dstName} -> ${backupPath}`);

// 3. apply source onto destination
const applyPath = path.join(os.tmpdir(), `dbsync-apply-${stamp}.sql`);
fs.writeFileSync(applyPath, buildReplaceSql(src));
execSync(`npx wrangler d1 execute ${DB} ${dstFlag} --file "${applyPath}"`, { stdio: "inherit" });

console.log(
  `\n✓ ${dstName} now matches ${srcName} (${TABLES.map((t) => `${t}:${src[t].length}`).join(", ")}).`,
);
if (dir === "pull") console.log("  Refresh your browser — React Query may still show cached data.");
