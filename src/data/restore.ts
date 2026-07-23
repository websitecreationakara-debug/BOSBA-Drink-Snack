import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { requireAdmin } from "./_auth";

// Cloudflare account/database identifiers — stable, matches wrangler.jsonc.
const ACCOUNT_ID = "a83815bcb10b7056fc34d19071b3b3eb";
const DATABASE_ID = "7ba2d42f-28f8-4fa2-bde6-8f7b4f65327b";

type D1ApiResponse = {
  success: boolean;
  errors?: unknown;
  result?: { success: boolean }[];
};

// Applies an uploaded SQL dump (as produced by `npm run backup`) to the LIVE
// production database via Cloudflare's D1 HTTP API — the same mechanism
// `wrangler d1 execute --remote` uses. Goes through the API rather than this
// Worker's own D1 binding because a multi-MB, multi-thousand-statement dump
// needs to be sent as one request; the binding's query() is for app queries,
// not bulk restores. Requires the admin to type "RESTORE" exactly, checked
// here (not just client-side) since this is irreversible.
export const restoreDatabase = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Expected multipart form data");
    return d;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const confirm = data.get("confirm");
    if (confirm !== "RESTORE") {
      throw new Error('Confirmation text did not match. Type "RESTORE" exactly.');
    }

    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No backup file provided");
    if (!file.name.endsWith(".sql")) throw new Error("Expected a .sql backup file");

    const sql = await file.text();
    if (!sql.trim()) throw new Error("Uploaded file is empty");

    const token = env.CLOUDFLARE_D1_RESTORE_TOKEN;
    if (!token) throw new Error("Restore is not configured on this server (missing token)");

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      },
    );

    const json = (await res.json()) as D1ApiResponse;
    if (!res.ok || !json.success) {
      throw new Error(`Restore failed: ${JSON.stringify(json.errors ?? json)}`);
    }

    const statementResults = json.result ?? [];
    const failed = statementResults.filter((r) => !r.success).length;

    return {
      ok: true,
      statementsRun: statementResults.length,
      failed,
      fileName: file.name,
      fileSizeBytes: file.size,
    };
  });
