# Resume Signal

Resume Signal is a portable ATS résumé workspace based on the supplied build plan and interactive prototype. It runs as a standard Next.js application and stores its JD library in hosted Supabase Postgres.

## Localhost setup

Requires Node.js 22.13 or newer.

1. Create or choose a Supabase project.
2. Run the files in `supabase/migrations/` in filename order in the Supabase SQL editor. If the repository is linked with the Supabase CLI, `supabase db push` applies the same migrations.
3. Copy `.env.example` to `.env.local` and set the project URL, publishable key, and server-side secret key:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

4. Configure Google-only authentication:
   - In Google Auth Platform, create a **Web application** OAuth client. Add `http://localhost:3000` as an authorized JavaScript origin and use the Supabase callback URL shown under **Supabase → Authentication → Providers → Google** as the authorized redirect URI.
   - In **Supabase → Authentication → Providers**, enable Google with that client ID and secret, then disable the Email provider so password and email-link authentication cannot be used.
   - In **Supabase → Authentication → URL Configuration**, use `http://localhost:3000` as the local Site URL and allow `http://localhost:3000/auth/callback` as a redirect URL.

5. Install and start the site:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login` and continue with Google. The first successful Google sign-in creates the user automatically. The interface runs locally, while saved job descriptions are written to Supabase. The secret key stays in the local server process and is never exposed to browser code. Legacy `SUPABASE_SERVICE_ROLE_KEY` values remain supported as a fallback.

## Edit the site

- `app/page.tsx` contains the page content, sample data, and browser interactions.
- `app/globals.css` contains the visual system and responsive layout.
- `app/api/job-descriptions/route.ts` is the server-only JD library API.
- `lib/supabase/` owns cookie-session clients and route protection.
- `db/supabase.ts` is the server-only administrative client; normal user requests do not use it.
- `supabase/migrations/` contains the hosted database schema.
- `types/resume.ts` is the shared contract for future parser, scorer, renderer, and JD library work.

## What works now

- PDF/DOCX file selection in the browser (file contents are not uploaded or parsed yet)
- Job-description keyword detection with a sample JD
- Separate format-health and role-match scores
- Matched and missing keyword evidence
- Grounded suggestion diffs with explicit accept/reject decisions
- Print-friendly Harvard-style résumé preview
- Supabase-backed JD saves plus role-specific keyword-frequency views
- Google-only sign-in and automatic first-time account creation, plus sign-out
- Per-user database ownership enforced by Row Level Security
- Responsive desktop and mobile layouts

## Security model

- The Supabase secret key is server-only and must never use a `NEXT_PUBLIC_` prefix.
- Auth sessions use secure cookies through `@supabase/ssr`.
- Google is the only configured identity provider; the application does not collect or store passwords.
- Row Level Security is enabled on `job_descriptions`; authenticated users can access only rows whose `user_id` matches `auth.uid()`.
- Anonymous requests receive no table access.
- JD reads and writes go through an authenticated Next.js server route using the current user session.

## Production roadmap

1. Connect PDF and DOCX text extraction on a server route.
2. Structure extracted résumé and JD text into the shared TypeScript schema.
3. Keep format scoring deterministic and add semantic matching through a server-side model API.
4. Add DOCX export and round-trip parser tests.
5. Configure the production Google OAuth origin, Supabase callback, consent-screen branding, and deployment redirect URL before opening access publicly.

## Portability

The product uses standard Next.js, React, TypeScript, CSS, and Supabase. It no longer depends on Sites, vinext, Cloudflare Workers, or D1. It can live on GitHub and later deploy to any host that supports Next.js server routes and secure environment variables.

Useful commands:

```bash
npm run build
npm test
npm run lint
```
