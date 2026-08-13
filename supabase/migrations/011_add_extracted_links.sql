alter table public.applications
  add column if not exists extracted_links jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_extracted_links_array_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_extracted_links_array_check
      check (jsonb_typeof(extracted_links) = 'array');
  end if;
end
$$;
