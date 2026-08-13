alter table public.applications
  add column if not exists consent_at timestamptz;

update public.applications
set consent_at = created_at
where consent_at is null;

alter table public.applications
  alter column consent_at set not null;
