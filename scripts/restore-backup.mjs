// Downloads a Bosba backup from Google Drive (gdrive:Bosba Premium Foods) and
// unpacks the source snapshot for inspection. Does NOT touch the live
// database — restoring overwrites production and can't be undone, so that
// step is printed as a command for you to run yourself once you're sure.
//
//   node scripts/restore-backup.mjs                  # most recent backup
//   node scripts/restore-backup.mjs 2026-07-14        # a specific date (matches the ISO stamp's date part)

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB = "bosbapremiumfoods";
const RCLONE = "C:\\Users\\Demo\\.project-tracker\\bin\\rclone.exe";
const DRIVE_REMOTE = "gdrive:Bosba Premium Foods";
const RESTORE_DIR = "D:\\Backups\\bosba\\restore";

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

const stamp = dbFile.Name.replace(/^d1-backup-/, "").replace(/\.sql$/, "");
const srcFile = files.find((f) => f.Name === `source-${stamp}.zip`);

console.log(`Restoring backup stamped ${stamp}`);
fs.mkdirSync(RESTORE_DIR, { recursive: true });

const dbLocal = path.join(RESTORE_DIR, dbFile.Name);
console.log(`Downloading ${dbFile.Name} ...`);
execSync(`"${RCLONE}" copy "${DRIVE_REMOTE}/${dbFile.Name}" "${RESTORE_DIR}" -q --progress`, { stdio: "inherit" });

if (srcFile) {
  const srcLocal = path.join(RESTORE_DIR, srcFile.Name);
  console.log(`Downloading ${srcFile.Name} ...`);
  execSync(`"${RCLONE}" copy "${DRIVE_REMOTE}/${srcFile.Name}" "${RESTORE_DIR}" -q --progress`, { stdio: "inherit" });

  const unzipDir = path.join(RESTORE_DIR, `source_${stamp}`);
  console.log(`Unpacking source snapshot to ${unzipDir} ...`);
  fs.mkdirSync(unzipDir, { recursive: true });
  execSync(`"C:\\Windows\\System32\\tar.exe" -xf "${srcLocal}" -C "${unzipDir}"`, { stdio: "inherit" });
  console.log(`\nSource code browsable at: ${unzipDir}`);
}

console.log(`\nDatabase dump downloaded but NOT applied to: ${dbLocal}`);
console.log("To restore it for real (THIS OVERWRITES PRODUCTION, cannot be undone), run:\n");
console.log(`  cd "D:\\Ecommerce\\Bosba Premium Foods"`);
console.log(`  npx wrangler d1 execute ${DB} --remote --file "${dbLocal}"\n`);
console.log("Consider restoring to a local D1 instance first (drop --remote) to sanity-check the dump.");
