alter table public.applications
  add column if not exists location_note text;

alter table public.applications
  drop constraint if exists applications_location_note_length_check;

alter table public.applications
  add constraint applications_location_note_length_check
  check (location_note is null or char_length(location_note) <= 300);
