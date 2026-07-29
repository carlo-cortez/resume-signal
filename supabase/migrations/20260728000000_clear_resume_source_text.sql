alter table public.resume_versions
  alter column source_text drop not null;

update public.resume_versions
set source_text = null
where source_text is not null;

comment on column public.resume_versions.source_text is
  'Deprecated privacy transition field. Raw extracted resume text is no longer retained.';
