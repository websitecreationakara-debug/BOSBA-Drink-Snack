import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2];
const outPath = process.argv[3];
const CHUNK = 90000; // hex chars per statement (even); keeps each UPDATE < 100KB

const lines = readFileSync(inPath, "utf8").split(/\r?\n/);
const out = [];
const trailingUpdates = [];
let mediaRows = 0;
let totalChunks = 0;

const blobRe = /X'([0-9A-Fa-f]{100,})'/; // the large data blob literal
const idRe = /VALUES\('([^']+)'/;

for (const line of lines) {
  if (/^INSERT INTO "media"/.test(line)) {
    const blob = line.match(blobRe);
    const id = line.match(idRe);
    if (!blob || !id) {
      throw new Error(`could not parse media row: ${line.slice(0, 120)}...`);
    }
    const hex = blob[1];
    const rowId = id[1];
    // Insert the row with an empty blob, keeping all other column values intact.
    out.push(line.replace(blobRe, "X''"));
    // Append the blob in binary-safe hex chunks.
    for (let i = 0; i < hex.length; i += CHUNK) {
      const part = hex.slice(i, i + CHUNK);
      trailingUpdates.push(
        `UPDATE "media" SET data = unhex(hex(data) || '${part}') WHERE id = '${rowId}';`,
      );
      totalChunks++;
    }
    mediaRows++;
    continue;
  }
  out.push(line);
}

out.push("-- media blob reconstruction --");
out.push(...trailingUpdates);

writeFileSync(outPath, out.join("\n"));
console.log(`media rows: ${mediaRows}, blob chunks: ${totalChunks}`);
