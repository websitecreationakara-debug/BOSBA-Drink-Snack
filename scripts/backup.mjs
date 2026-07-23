// Full off-Cloudflare backup of the remote (production) D1 database, plus a
// source code snapshot.
//
//   npm run backup
//
// Exports the ENTIRE remote D1 (schema + all rows, incl. media image BLOBs, users,
// orders) to a timestamped .sql file under D:\Backups\bosba\, and archives the
// current git HEAD to a matching .zip there too. Lives outside the project
// folder (as a sibling of D:\Backups\phsar-ichiba\) so backups for the two
// sites never mix, and so it's not tied to this repo's gitignore. These dumps
// contain OAuth tokens and password hashes — never commit or share them.
// Restore the database with:
//   wrangler d1 execute bosbapremiumfoods --remote --file <that-file>.sql
//
// Old dumps/snapshots are pruned automatically, keeping the most recent KEEP of each,
// both locally and in the Google Drive mirror (gdrive:Bosba Premium Foods).

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB = "bosbapremiumfoods";
const KEEP = 8; // how many dumps to retain (weekly cadence -> ~2 months of history)
const RCLONE = "C:\\Users\\Demo\\.project-tracker\\bin\\rclone.exe";
const DRIVE_REMOTE = "gdrive:Bosba Premium Foods";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = "D:\\Backups\\bosba";
fs.mkdirSync(dir, { recursive: true });

const existing = (pattern) =>
  fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

const DB_PATTERN = /^d1-backup-.*\.sql$/;
const SRC_PATTERN = /^source-.*\.zip$/;

// --auto (the scheduled run) only backs up weekly: skip if the newest dump is < 6.5
// days old. The task fires daily, so a missed week self-heals the next day rather than
// waiting another full week. A manual `npm run backup` ignores this and always runs.
if (process.argv.includes("--auto")) {
  const newest = existing(DB_PATTERN)[0];
  if (newest && Date.now() - newest.t < 6.5 * 24 * 60 * 60 * 1000) {
    const days = ((Date.now() - newest.t) / 86_400_000).toFixed(1);
    console.log(`\nSkipping: newest backup is ${days} day(s) old (weekly cadence). \`npm run backup\` forces one.\n`);
    process.exit(0);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dbOut = path.join(dir, `d1-backup-${stamp}.sql`);
const srcOut = path.join(dir, `source-${stamp}.zip`);

console.log(`\nExporting remote D1 "${DB}" -> ${dbOut}\n`);
execSync(`npx wrangler d1 export ${DB} --remote --output "${dbOut}"`, { stdio: "inherit", cwd: root });
const dbBytes = fs.statSync(dbOut).size;
console.log(`\n✓ Database backup written (${(dbBytes / 1024 / 1024).toFixed(2)} MB)`);

console.log(`\nArchiving source tree (git HEAD) -> ${srcOut}\n`);
execSync(`git archive --format=zip -o "${srcOut}" HEAD`, { stdio: "inherit", cwd: root });
const srcBytes = fs.statSync(srcOut).size;
console.log(`✓ Source snapshot written (${(srcBytes / 1024 / 1024).toFixed(2)} MB)`);

console.log(`\nUploading to Google Drive (${DRIVE_REMOTE})\n`);
execSync(`"${RCLONE}" copy "${dbOut}" "${DRIVE_REMOTE}" -q`, { stdio: "inherit" });
execSync(`"${RCLONE}" copy "${srcOut}" "${DRIVE_REMOTE}" -q`, { stdio: "inherit" });
console.log("✓ Google Drive upload complete");

// prune: keep the newest KEEP of each kind, locally and on Drive
for (const pattern of [DB_PATTERN, SRC_PATTERN]) {
  const files = existing(pattern);
  for (const { f } of files.slice(KEEP)) {
    fs.unlinkSync(path.join(dir, f));
    console.log(`  pruned old local backup: ${f}`);
  }
}

const driveListing = execSync(`"${RCLONE}" lsjson "${DRIVE_REMOTE}" -q`, { encoding: "utf-8" });
const driveFiles = JSON.parse(driveListing);
for (const pattern of [DB_PATTERN, SRC_PATTERN]) {
  const matches = driveFiles
    .filter((f) => pattern.test(f.Name))
    .sort((a, b) => new Date(b.ModTime) - new Date(a.ModTime));
  for (const f of matches.slice(KEEP)) {
    execSync(`"${RCLONE}" deletefile "${DRIVE_REMOTE}/${f.Name}" -q`);
    console.log(`  pruned old Drive backup: ${f.Name}`);
  }
}

console.log(`  up to ${KEEP} of each (database, source) retained locally and on Drive\n`);
