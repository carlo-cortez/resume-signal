create table if not exists public.rate_limit_counters (
  bucket text not null check (bucket in ('resume_parse', 'resume_scan', 'groq_requests')),
  subject text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (bucket, subject, window_start)
);

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;

comment on table public.rate_limit_counters is
  'Fixed-window request counters. Written only through the security-definer functions below.';

create or replace function public.increment_rate_limit_counter(
  p_bucket text,
  p_subject text,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_window_seconds not in (3600, 86400) then
    raise exception 'Unsupported rate limit window' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_counters as counter (bucket, subject, window_start, request_count)
  values (p_bucket, p_subject, v_window_start, 1)
  on conflict (bucket, subject, window_start)
  do update set request_count = counter.request_count + 1
  returning counter.request_count into v_count;

  delete from public.rate_limit_counters
  where bucket = p_bucket
    and subject = p_subject
    and window_start < v_window_start - interval '2 days';

  return v_count;
end;
$$;

-- Callable by signed-in users, but only ever counts against the caller's own id.
create or replace function public.consume_user_rate_limit(p_bucket text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_bucket not in ('resume_parse', 'resume_scan') then
    raise exception 'Unsupported rate limit bucket' using errcode = '22023';
  end if;
  return public.increment_rate_limit_counter(p_bucket, v_user_id::text, p_window_seconds);
end;
$$;

-- App-wide budget shared by every user. Server secret key only, so a user
-- calling the database directly cannot exhaust it for everyone else.
create or replace function public.consume_global_rate_limit(p_bucket text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bucket <> 'groq_requests' then
    raise exception 'Unsupported rate limit bucket' using errcode = '22023';
  end if;
  return public.increment_rate_limit_counter(p_bucket, 'global', p_window_seconds);
end;
$$;

revoke execute on function public.increment_rate_limit_counter(text, text, integer) from public, anon, authenticated;
revoke execute on function public.consume_user_rate_limit(text, integer) from public, anon;
revoke execute on function public.consume_global_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_user_rate_limit(text, integer) to authenticated;
grant execute on function public.consume_global_rate_limit(text, integer) to service_role;
