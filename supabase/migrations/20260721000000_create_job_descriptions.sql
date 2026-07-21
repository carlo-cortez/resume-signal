create extension if not exists pgcrypto;

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  company text,
  title text not null,
  role_category text not null,
  raw_text text not null,
  keywords_json jsonb not null default '[]'::jsonb,
  match_score integer check (match_score between 0 and 100),
  outcome text not null default 'applied' check (
    outcome in ('applied', 'interview', 'rejected', 'offer', 'no_response')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_descriptions_role_category_idx
  on public.job_descriptions (role_category);

create index if not exists job_descriptions_created_at_idx
  on public.job_descriptions (created_at desc);

alter table public.job_descriptions enable row level security;
revoke all on table public.job_descriptions from anon, authenticated;
grant all on table public.job_descriptions to service_role;

comment on table public.job_descriptions is
  'Private Resume Signal job descriptions, accessed only through server routes.';
