// kysely 0.29.2 doesn't export these migration constants, but the (unused) sqlite
// dialects bundled in @better-auth/kysely-adapter import them, which breaks the
// production rollup build's static link check. We use better-auth's drizzle adapter,
// so this code path never runs — we just re-export kysely plus the missing constants.
// "kysely-real" is a Vite alias to kysely's real dist file (bypasses both the
// package exports map and the bare-"kysely" alias that points back here).
export * from "kysely-real";

export const DEFAULT_MIGRATION_TABLE = "kysely_migration";
export const DEFAULT_MIGRATION_LOCK_TABLE = "kysely_migration_lock";
