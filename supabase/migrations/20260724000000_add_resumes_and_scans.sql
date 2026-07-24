create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  data_json jsonb not null,
  source_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (resume_id, version_number)
);

create table if not exists public.resume_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  company text,
  role_category text not null,
  job_description text not null,
  formatting_score integer not null check (formatting_score between 0 and 100),
  match_score integer not null check (match_score between 0 and 100),
  matched_keywords jsonb not null default '[]'::jsonb,
  missing_keywords jsonb not null default '[]'::jsonb,
  suggestions_json jsonb not null default '[]'::jsonb,
  analysis_mode text not null check (analysis_mode in ('deterministic', 'hybrid')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists resumes_user_updated_idx on public.resumes (user_id, updated_at desc);
create index if not exists resume_versions_resume_created_idx on public.resume_versions (resume_id, created_at desc);
create index if not exists resume_scans_user_created_idx on public.resume_scans (user_id, created_at desc);

alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.resume_scans enable row level security;

revoke all on public.resumes, public.resume_versions, public.resume_scans from anon;
grant select, insert, update, delete on public.resumes, public.resume_versions, public.resume_scans to authenticated;

create policy "Users manage their own resumes" on public.resumes
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own resume versions" on public.resume_versions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own resume scans" on public.resume_scans
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
