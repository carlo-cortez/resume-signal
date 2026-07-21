import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the finished Resume Signal product surface", async () => {
  const [page, layout, stylesheet, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /Resume Signal/);
  assert.match(page, /Build the version of your resume this role needs/);
  assert.match(page, /Scan & build/);
  assert.match(page, /JD library/);
  assert.match(page, /Harvard-style resume/);
  assert.match(layout, /ATS Resume Builder/);
  assert.match(stylesheet, /@media \(max-width: 540px\)/);
  assert.match(packageJson, /"dev": "next dev"/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|SkeletonPreview|react-loading-skeleton|vinext/);
});

test("uses server-only Supabase persistence", async () => {
  const [database, migration, route, environmentExample] = await Promise.all([
    readFile(new URL("db/supabase.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/20260721000000_create_job_descriptions.sql", root), "utf8"),
    readFile(new URL("app/api/job-descriptions/route.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);

  assert.match(database, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(database, /import "server-only"/);
  assert.match(migration, /create table if not exists public\.job_descriptions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from anon, authenticated/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(environmentExample, /SUPABASE_URL=/);
  assert.match(environmentExample, /SUPABASE_SERVICE_ROLE_KEY=/);
  assert.doesNotMatch(route, /D1|OAI-Sites-Authorization|localStorage|sessionStorage/);
  await assert.rejects(access(new URL(".openai/hosting.json", root)));
});
