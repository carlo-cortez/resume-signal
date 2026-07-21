alter table public.job_descriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists job_descriptions_user_id_created_at_idx
  on public.job_descriptions (user_id, created_at desc);

alter table public.job_descriptions enable row level security;

revoke all on table public.job_descriptions from anon;
grant select, insert, update, delete on table public.job_descriptions to authenticated;

drop policy if exists "Users can read their own job descriptions" on public.job_descriptions;
create policy "Users can read their own job descriptions"
  on public.job_descriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own job descriptions" on public.job_descriptions;
create policy "Users can create their own job descriptions"
  on public.job_descriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own job descriptions" on public.job_descriptions;
create policy "Users can update their own job descriptions"
  on public.job_descriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own job descriptions" on public.job_descriptions;
create policy "Users can delete their own job descriptions"
  on public.job_descriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on column public.job_descriptions.user_id is
  'Supabase Auth owner. Null is permitted only for records created before authentication was added.';
