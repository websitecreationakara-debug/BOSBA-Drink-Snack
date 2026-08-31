// Dynamic products CLI — read/write the LIVE bosbadrinksnack.com catalogue from
// your machine, the same way NOVA POS pushes changes to the real domain. Every
// write here takes effect on production immediately; there is no local copy.
//
//   npm run product:list                       all published products (id + title)
//   npm run product:list -- --all              include drafts (needs token)
//   npm run product:get -- <id|slug>          one product as JSON
//   npm run product:set -- <id|slug> <k=v...>  patch fields (see keys below)
//   npm run product:create -- <k=v...>        new product (title=... required)
//   npm run product:delete -- <id|slug>       delete (cascades variations/images/tabs)
//
// Field keys for set/create:
//   title description price sale_price stock status(published|draft) type(simple|variable)
//   category_id image_url badge rating weight pcs featured(true|false) pre_order(true|false)
//   promotion_id video_url
// Example:
//   npm run product:set -- hojicha price=3.50 stock=40 status=published
//
// Config comes from .dev.vars (PRODUCTS_API_URL, PRODUCTS_API_TOKEN) or the
// matching environment variables. Token is only required for writes and --all.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDevVars() {
  const file = path.join(ROOT, ".dev.vars");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const vars = loadDevVars();
const BASE = (process.env.PRODUCTS_API_URL || vars.PRODUCTS_API_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.PRODUCTS_API_TOKEN || vars.PRODUCTS_API_TOKEN || "";

if (!BASE) {
  console.error("Missing PRODUCTS_API_URL (set it in .dev.vars or the environment).");
  process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);

// Parse `key=value` pairs into a JSON body, coercing obvious types.
function parseFields(pairs) {
  const body = {};
  for (const p of pairs) {
    const i = p.indexOf("=");
    if (i < 0) {
      console.error(`Bad field "${p}" — expected key=value`);
      process.exit(1);
    }
    const key = p.slice(0, i);
    let val = p.slice(i + 1);
    if (val === "true" || val === "false") body[key] = val === "true";
    else if (val === "null" || val === "") body[key] = null;
    else if (
      /^-?\d+(\.\d+)?$/.test(val) &&
      ["price", "sale_price", "stock", "rating", "pcs"].includes(key)
    )
      body[key] = Number(val);
    else body[key] = val;
  }
  return body;
}

async function api(method, subpath = "", body) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${subpath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    console.error(`${method} ${BASE}${subpath} -> ${res.status}`);
    console.error(typeof json === "string" ? json : JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

function requireToken() {
  if (!TOKEN) {
    console.error("This command needs PRODUCTS_API_TOKEN (set it in .dev.vars).");
    process.exit(1);
  }
}

switch (cmd) {
  case "list": {
    const all = rest.includes("--all");
    if (all) requireToken();
    const data = await api("GET", all ? "?status=all" : "");
    for (const p of data.products) {
      console.log(`${p.id}  ${p.status.padEnd(9)}  ${p.price}\t${p.title}`);
    }
    console.log(`\n${data.count} products`);
    break;
  }
  case "get": {
    if (!rest[0]) {
      console.error("Usage: npm run product:get -- <id|slug>");
      process.exit(1);
    }
    const data = await api("GET", `/${encodeURIComponent(rest[0])}`);
    console.log(JSON.stringify(data.product, null, 2));
    break;
  }
  case "set": {
    requireToken();
    const [target, ...pairs] = rest;
    if (!target || pairs.length === 0) {
      console.error("Usage: npm run product:set -- <id|slug> <key=value ...>");
      process.exit(1);
    }
    const data = await api("PATCH", `/${encodeURIComponent(target)}`, parseFields(pairs));
    console.log("Updated:");
    console.log(JSON.stringify(data.product, null, 2));
    break;
  }
  case "create": {
    requireToken();
    if (rest.length === 0) {
      console.error('Usage: npm run product:create -- title="..." price=... [key=value ...]');
      process.exit(1);
    }
    const data = await api("POST", "", parseFields(rest));
    console.log("Created:");
    console.log(JSON.stringify(data.product, null, 2));
    break;
  }
  case "delete": {
    requireToken();
    if (!rest[0]) {
      console.error("Usage: npm run product:delete -- <id|slug>");
      process.exit(1);
    }
    const data = await api("DELETE", `/${encodeURIComponent(rest[0])}`);
    console.log(JSON.stringify(data, null, 2));
    break;
  }
  default:
    console.error(
      [
        "Usage:",
        "  npm run product:list [-- --all]",
        "  npm run product:get -- <id|slug>",
        "  npm run product:set -- <id|slug> <key=value ...>",
        '  npm run product:create -- title="..." price=... [key=value ...]',
        "  npm run product:delete -- <id|slug>",
      ].join("\n"),
    );
    process.exit(1);
}
