import { env } from "cloudflare:workers";

export function requireDatabase(): D1Database {
  if (!env.DB) {
    throw new Error("The hosted database binding is unavailable.");
  }
  return env.DB;
}

export async function ensureJobDescriptionSchema(database: D1Database) {
  await database.batch([
    database.prepare(
      `CREATE TABLE IF NOT EXISTS job_descriptions (
        id TEXT PRIMARY KEY NOT NULL,
        company TEXT,
        title TEXT NOT NULL,
        role_category TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        keywords_json TEXT DEFAULT '[]' NOT NULL,
        match_score INTEGER,
        outcome TEXT DEFAULT 'applied' NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS job_descriptions_role_category_idx ON job_descriptions (role_category)",
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS job_descriptions_created_at_idx ON job_descriptions (created_at)",
    ),
  ]);
}
