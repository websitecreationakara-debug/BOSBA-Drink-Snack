// One-click restore: downloads a backup from Google Drive and, after an
// explicit typed confirmation, applies it to the LIVE production D1
// database. This is the destructive counterpart to restore-backup.mjs
// (which only downloads/unpacks for inspection).
//
// Usage: double-click restore-live.cmd, or:
//   node scripts/restore-live.mjs                  # most recent backup
//   node scripts/restore-live.mjs 2026-07-14        # a specific date

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

const DB = "bosbapremiumfoods";
const RCLONE = "C:\\Users\\Demo\\.project-tracker\\bin\\rclone.exe";
const DRIVE_REMOTE = "gdrive:Bosba Premium Foods";
const RESTORE_DIR = "D:\\Backups\\bosba\\restore";
const PROJECT_DIR = "D:\\Ecommerce\\Bosba Premium Foods";

console.log("=== Bosba Premium Foods: Restore Live Database from Backup ===\n");

const wantedDate = process.argv[2] ?? null;

const listing = execSync(`"${RCLONE}" lsjson "${DRIVE_REMOTE}" -q`, { encoding: "utf-8" });
const files = JSON.parse(listing);
const dbFiles = files
  .filter((f) => /^d1-backup-.*\.sql$/.test(f.Name))
  .sort((a, b) => new Date(b.ModTime) - new Date(a.ModTime));

if (dbFiles.length === 0) {
  console.error(`No backups found on ${DRIVE_REMOTE}`);
  process.exit(1);
}

const dbFile = wantedDate
  ? dbFiles.find((f) => f.Name.startsWith(`d1-backup-${wantedDate}`))
  : dbFiles[0];

if (!dbFile) {
  console.error(`No backup found for date ${wantedDate} on ${DRIVE_REMOTE}`);
  process.exit(1);
}

console.log(`Backup: ${dbFile.Name}`);

fs.mkdirSync(RESTORE_DIR, { recursive: true });
const dbLocal = path.join(RESTORE_DIR, dbFile.Name);
if (!fs.existsSync(dbLocal)) {
  console.log("Downloading ...");
  execSync(`"${RCLONE}" copy "${DRIVE_REMOTE}/${dbFile.Name}" "${RESTORE_DIR}" -q`);
}

const sizeKb = (fs.statSync(dbLocal).size / 1024).toFixed(1);
console.log(`Local file ready: ${dbLocal} (${sizeKb} KB)\n`);

console.log("!! WARNING !!");
console.log("This will OVERWRITE the LIVE production database for Bosba Premium Foods");
console.log(`with the ${dbFile.Name} backup. Any orders or changes made after that backup`);
console.log("was taken will be permanently LOST. This cannot be undone.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("Type RESTORE (all caps, exactly) to proceed, or anything else to cancel: ");
rl.close();

if (answer !== "RESTORE") {
  console.log("\nCancelled. Nothing was changed.");
  process.exit(0);
}

console.log("\nRestoring to the live database...");
execSync(`npx wrangler d1 execute ${DB} --remote --file "${dbLocal}"`, { stdio: "inherit", cwd: PROJECT_DIR });

console.log("\nRestore complete. The live site now reflects this backup.");
