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
  assert.match(page, /Taylor Rivera/);
  assert.match(page, /Sample Technology Company/);
  assert.match(page, /Projects/);
  assert.match(page, /Operations Dashboard Prototype/);
  assert.match(page, /Leadership & Activities/);
  assert.match(page, /Skills & Interests/);
  assert.match(page, /GPA:<\/strong> 3\.70 \/ 4\.00/);
  assert.match(page, /Awards:<\/strong> Dean’s List; Academic Merit Scholarship/);
  assert.doesNotMatch(page, /Relevant Coursework|Systems Analysis, Database Management/);
  assert.ok(page.indexOf('title="Education"') < page.indexOf('title="Experience"'));
  assert.doesNotMatch(page, /Carlo Reyes|Philippine Airlines|De La Salle University|DLSU|Makati City/);
  assert.match(layout, /ATS Resume Builder/);
  assert.match(stylesheet, /@media \(max-width: 540px\)/);
  assert.match(stylesheet, /Calibri, Arial, Helvetica, sans-serif/);
  assert.match(stylesheet, /@page \{ size: Letter portrait/);
  assert.match(packageJson, /"dev": "next dev"/);
  assert.match(packageJson, /"@supabase\/ssr"/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|SkeletonPreview|react-loading-skeleton|vinext/);
});

test("uses Google-only authentication and per-user Supabase persistence", async () => {
  const [database, migration, ownershipMigration, route, environmentExample, serverClient, proxy, sessionProxy, login, register, authActions, authShell] = await Promise.all([
    readFile(new URL("db/supabase.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/20260721000000_create_job_descriptions.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20260721010000_add_user_ownership.sql", root), "utf8"),
    readFile(new URL("app/api/job-descriptions/route.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("lib/supabase/server.ts", root), "utf8"),
    readFile(new URL("proxy.ts", root), "utf8"),
    readFile(new URL("lib/supabase/proxy.ts", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/register/page.tsx", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/auth/auth-shell.tsx", root), "utf8"),
  ]);

  assert.match(database, /SUPABASE_SECRET_KEY/);
  assert.match(database, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(database, /import "server-only"/);
  assert.match(migration, /create table if not exists public\.job_descriptions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from anon, authenticated/);
  assert.match(ownershipMigration, /user_id uuid references auth\.users/);
  assert.match(ownershipMigration, /auth\.uid\(\)\) = user_id/);
  assert.match(ownershipMigration, /to authenticated/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /auth\.getClaims\(\)/);
  assert.match(route, /user_id: userId/);
  assert.doesNotMatch(route, /getSupabaseAdmin/);
  assert.match(environmentExample, /SUPABASE_URL=/);
  assert.match(environmentExample, /SUPABASE_PUBLISHABLE_KEY=/);
  assert.match(environmentExample, /SUPABASE_SECRET_KEY=/);
  assert.match(serverClient, /createServerClient/);
  assert.match(proxy, /updateSession/);
  assert.match(sessionProxy, /retiredAuthPages/);
  assert.match(sessionProxy, /pathname === "\/auth\/callback"/);
  assert.match(login, /Continue with Google/);
  assert.doesNotMatch(login, /type="password"|Forgot password|Email address/);
  assert.match(register, /redirect\("\/login"\)/);
  assert.match(authActions, /signInWithOAuth/);
  assert.match(authActions, /provider: "google"/);
  assert.match(authActions, /skipBrowserRedirect: true/);
  assert.doesNotMatch(authActions, /signInWithPassword|signUp\(|resetPasswordForEmail|updateUser/);
  assert.doesNotMatch(authShell, /Supabase|authentication|row-level/);
  assert.doesNotMatch(route, /Authentication required/);
  assert.doesNotMatch(route, /D1|OAI-Sites-Authorization|localStorage|sessionStorage/);
  await assert.rejects(access(new URL("app/forgot-password/page.tsx", root)));
  await assert.rejects(access(new URL("app/update-password/page.tsx", root)));
  await assert.rejects(access(new URL("app/auth/confirm/route.ts", root)));
  await assert.rejects(access(new URL(".openai/hosting.json", root)));
});
