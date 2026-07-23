import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error("usage: node reorder-d1-dump.mjs <in.sql> <out.sql>");
  process.exit(1);
}

const lines = readFileSync(inPath, "utf8").split(/\r?\n/);

const pragma = [];
const indexes = [];
const blocks = new Map(); // table -> lines[]
let current = null;

const tableRe = /^CREATE TABLE\s+[`"]?(\w+)[`"]?/i;
const indexRe = /^CREATE\s+(?:UNIQUE\s+)?INDEX/i;

for (const line of lines) {
  if (/^PRAGMA/i.test(line)) {
    pragma.push(line);
    continue;
  }
  if (indexRe.test(line)) {
    indexes.push(line);
    continue;
  }
  const m = line.match(tableRe);
  if (m) {
    current = m[1];
    if (!blocks.has(current)) blocks.set(current, []);
  }
  if (current) blocks.get(current).push(line);
}

// Parents before children; tables with no FKs can go anywhere.
const order = [
  "d1_migrations",
  "user",
  "categories",
  "account",
  "session",
  "products",
  "orders",
  "store_settings",
  "verification",
  "media",
  "hero_slides",
];

const seen = new Set();
const out = [...pragma];
for (const t of order) {
  if (blocks.has(t)) {
    out.push(...blocks.get(t));
    seen.add(t);
  }
}
// Append any tables not listed above (safety net), preserving discovery order.
for (const [t, blk] of blocks) {
  if (!seen.has(t)) out.push(...blk);
}
out.push(...indexes);

writeFileSync(outPath, out.join("\n"));
console.log(
  `tables written: ${[...seen, ...[...blocks.keys()].filter((t) => !seen.has(t))].join(", ")}`,
);
console.log(`index statements: ${indexes.length}, pragma lines: ${pragma.length}`);
