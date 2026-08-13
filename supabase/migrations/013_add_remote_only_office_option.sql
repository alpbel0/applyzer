alter table public.applications
  drop constraint if exists applications_office_days_per_week_check;

alter table public.applications
  add constraint applications_office_days_per_week_check
  check (
    office_days_per_week in (
      '1',
      '2',
      '3',
      '4-5',
      'relocation_needed',
      'remote_only'
    )
  );
