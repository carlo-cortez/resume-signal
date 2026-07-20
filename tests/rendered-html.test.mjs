import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.doesNotMatch(`${page}\n${layout}\n${packageJson}`, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("declares hosted JD persistence and a deployable migration", async () => {
  const [hosting, schema, migration, route] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0000_remarkable_red_wolf.sql", root), "utf8"),
    readFile(new URL("app/api/job-descriptions/route.ts", root), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /jobDescriptions/);
  assert.match(migration, /CREATE TABLE `job_descriptions`/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /localStorage|sessionStorage/);
});
