# Resume Signal

Resume Signal is a portable, GitHub-ready ATS resume workspace based on the supplied build plan and interactive prototype. The current version is a polished front-end prototype: it demonstrates the complete scan, suggestion-review, Harvard resume preview, and JD-library experience with local sample logic.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal. Use **Use sample** to load a realistic Business Analyst job description and run the demo scan.

## Edit the site

The main surfaces are intentionally simple:

- `app/page.tsx` contains the page content, sample data, and browser interactions.
- `app/globals.css` contains the full visual system and responsive layout.
- `types/resume.ts` is the shared schema for the future parser, scorer, renderer, and JD library.
- `app/layout.tsx` contains the site title and description.

You can upload these files to ChatGPT for targeted edits, or clone the repository into any coding tool that can access a local GitHub project.

## What works now

- PDF/DOCX file selection in the browser (file contents are not uploaded or parsed yet)
- Job description keyword detection with a sample JD
- Separate format-health and role-match scores
- Matched and missing keyword evidence
- Grounded suggestion diffs with explicit accept/reject decisions
- Print-friendly Harvard-style resume preview
- Hosted D1-backed JD saves plus role-specific keyword-frequency views
- Responsive desktop and mobile layouts

## Production roadmap

1. Connect PDF and DOCX text extraction on a server route.
2. Structure extracted resume and JD text into the shared TypeScript schema.
3. Keep format scoring deterministic and add semantic matching through a server-side model API.
4. Add DOCX export and round-trip parser tests.
5. Expand the hosted D1 schema with resume versions and application outcomes once real history is ready to collect.

Never place a model API key in browser code. Keep it in server-side environment variables on the selected host.

## Hosting and portability

The product UI uses ordinary React, TypeScript, and CSS. Hosted JD records use a small D1 adapter behind standard HTTP routes; the UI never talks to a proprietary database API. The current project can be stored on GitHub and deployed with the included worker-compatible build. On Vercel, Netlify, or another host, replace the implementation behind `db/d1.ts` and the route contracts can stay the same.

Useful commands:

```bash
npm run build
npm test
npm run lint
```
