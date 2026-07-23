import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

// The D1 binding lives on the Cloudflare Worker env. In dev, @cloudflare/vite-plugin
// runs server code in workerd and provides the local binding; in prod it's the real D1.
export function getDb() {
  return drizzle(env.DB, { schema });
}

export { schema };
