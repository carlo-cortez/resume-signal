import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the production Resume Signal workspace", async () => {
  const [page, sample, layout, stylesheet, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("lib/resume/sample.ts", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /Build the version of your resume this role needs/);
  assert.match(page, /Scan & build/);
  assert.match(page, /JD library/);
  assert.match(page, /"Systems Analyst"/);
  assert.match(page, /"Project Coordinator"/);
  assert.match(page, /"Operations Analyst"/);
  assert.match(page, /"QA \/ UAT Analyst"/);
  assert.match(page, /Save postings in this category to build a keyword profile/);
  assert.match(page, /Harvard-style resume/);
  assert.match(page, /resume\.contact\.name/);
  assert.match(page, /resume\.experience\.map/);
  assert.match(page, /resume\.leadership\.map/);
  assert.match(page, /resume\.projects\.map/);
  assert.match(page, /Edit content/);
  assert.match(page, /Download DOCX/);
  assert.match(page, /Print \/ Save PDF/);
  assert.match(page, /applyResumeSuggestion/);
  assert.match(page, /\/api\/resumes\/parse/);
  assert.match(page, /\/api\/scans/);
  assert.doesNotMatch(page, /Prototype mode|Ready for the demo scan|browser demo/);
  assert.match(sample, /Taylor Rivera/);
  assert.match(sample, /Sample Technology Company/);
  assert.match(sample, /Data Analytics Intern/);
  assert.match(sample, /Leadership & Activities|leadership:/);
  assert.match(sample, /Operations Dashboard Prototype/);
  assert.match(layout, /ATS Resume Builder/);
  assert.match(stylesheet, /@media \(max-width: 540px\)/);
  assert.match(stylesheet, /\.paper \{[^}]*font: 11pt\/1\.12 Calibri/);
  assert.match(stylesheet, /\.paper \{[^}]*width: 8\.5in;[^}]*min-height: 11in;/);
  assert.match(stylesheet, /@page \{ size: Letter portrait; margin: \.65in \.55in \.4in; \}/);
  assert.match(packageJson, /"openai"/);
  assert.match(packageJson, /"mammoth"/);
  assert.match(packageJson, /"pdfjs-dist"/);
  assert.match(packageJson, /"docx"/);
});

test("uses Google-only authentication and per-user Supabase persistence", async () => {
  const [database, migration, ownershipMigration, productionMigration, route, environmentExample, authActions, authShell, page] = await Promise.all([
    readFile(new URL("db/supabase.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/20260721000000_create_job_descriptions.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20260721010000_add_user_ownership.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20260724000000_add_resumes_and_scans.sql", root), "utf8"),
    readFile(new URL("app/api/job-descriptions/route.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/auth/auth-shell.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(database, /SUPABASE_SECRET_KEY/);
  assert.match(migration, /public\.job_descriptions/);
  assert.match(ownershipMigration, /auth\.uid\(\)\) = user_id/);
  assert.match(productionMigration, /public\.resumes/);
  assert.match(productionMigration, /public\.resume_versions/);
  assert.match(productionMigration, /public\.resume_scans/);
  assert.match(productionMigration, /enable row level security/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
  assert.match(environmentExample, /OPENAI_API_KEY=/);
  assert.match(authActions, /provider: "google"/);
  assert.doesNotMatch(authActions, /signInWithPassword|signUp\(|resetPasswordForEmail|updateUser/);
  assert.doesNotMatch(authShell, /Supabase|authentication|row-level/);
  assert.match(page, /deleteSavedPosting/);
  assert.match(page, /View JD/);
  await assert.rejects(access(new URL(".openai/hosting.json", root)));
});

test("implements validated parsing, scoring, semantic fallback, and export", async () => {
  const [parser, analysis, semantic, parseRoute, scanRoute, exportRoute, docxExport] = await Promise.all([
    readFile(new URL("lib/resume/parser.ts", root), "utf8"),
    readFile(new URL("lib/resume/analysis.ts", root), "utf8"),
    readFile(new URL("lib/resume/openai.ts", root), "utf8"),
    readFile(new URL("app/api/resumes/parse/route.ts", root), "utf8"),
    readFile(new URL("app/api/scans/route.ts", root), "utf8"),
    readFile(new URL("app/api/exports/docx/route.ts", root), "utf8"),
    readFile(new URL("lib/resume/export-docx.ts", root), "utf8"),
  ]);

  assert.match(parser, /MAX_RESUME_BYTES = 5 \* 1024 \* 1024/);
  assert.match(parser, /extractRawText/);
  assert.match(parser, /pdfjs-dist/);
  assert.match(analysis, /formatHealth/);
  assert.match(analysis, /extractJobKeywords/);
  assert.match(semantic, /responses\.parse/);
  assert.match(semantic, /zodTextFormat/);
  assert.match(semantic, /Never invent/);
  assert.match(parseRoute, /authenticatedSupabase/);
  assert.match(scanRoute, /analysisMode = "hybrid"/);
  assert.match(exportRoute, /application\/vnd\.openxmlformats/);
  assert.match(docxExport, /Packer\.toBuffer/);
});
