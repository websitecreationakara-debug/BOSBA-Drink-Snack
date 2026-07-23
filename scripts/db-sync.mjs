// On-demand product/category sync between the local D1 (vite dev) and the remote
// D1 (camitc.com). The two databases are otherwise independent — run this when you
// want one to match the other.
//
//   npm run db:pull            remote (camitc.com) -> local        (overwrites local)
//   npm run db:push -- --yes   local -> remote (camitc.com)        (overwrites PROD)
//
// Only `categories` and `products` are synced. Media image blobs, users, sessions,
// and orders are intentionally left alone. The destination is backed up to a SQL
// file under the OS temp dir before anything is overwritten.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB = "bosbapremiumfoods";
const TABLES = ["categories", "products"]; // parents before children (FK order)

const dir = process.argv[2];
const confirmed = process.argv.includes("--yes");
if (dir !== "push" && dir !== "pull") {
  console.error("Usage: node scripts/db-sync.mjs <push|pull> [--yes]");
  process.exit(1);
}

const srcFlag = dir === "push" ? "--local" : "--remote";
const dstFlag = dir === "push" ? "--remote" : "--local";
const srcName = dir === "push" ? "LOCAL" : "REMOTE (camitc.com)";
const dstName = dir === "push" ? "REMOTE (camitc.com)" : "LOCAL";

if (dir === "push" && !confirmed) {
  console.error(
    `\n⚠️  This OVERWRITES production (camitc.com) products & categories with your LOCAL data.\n` +
      `   There is no undo for live customers. If you're sure, run:\n\n` +
      `     npm run db:push -- --yes\n`,
  );
  process.exit(1);
}

const readRows = (flag, table) => {
  const out = execSync(`npx wrangler d1 execute ${DB} ${flag} --json --command "SELECT * FROM ${table}"`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  try {
    return JSON.parse(out)[0].results;
  } catch {
    throw new Error(`Could not read ${table} from ${flag} — is the database reachable?`);
  }
};

const esc = (v) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

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

console.log(`\n✓ ${dstName} now matches ${srcName} (${TABLES.map((t) => `${t}:${src[t].length}`).join(", ")}).`);
if (dir === "pull") console.log("  Refresh your browser — React Query may still show cached data.");
