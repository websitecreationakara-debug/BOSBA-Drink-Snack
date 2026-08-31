// `npm run dev:live` — same dev server as `npm run dev`, but its DB binding is
// wired to the REAL Cloudflare D1 (see DEV_LIVE handling in vite.config.ts).
//
// Every product / category / order / user change you make in the local admin at
// http://localhost:8080 is written straight to production and is live on
// bosbadrinksnack.com immediately. There is no undo. Needs `wrangler login`.
//
// Use plain `npm run dev` for the safe local sandbox.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, "dev"], {
  stdio: "inherit",
  env: { ...process.env, DEV_LIVE: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
