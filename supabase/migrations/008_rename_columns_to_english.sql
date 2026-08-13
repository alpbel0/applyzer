do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'basvuru_no'
  ) then
    alter table public.applications rename column basvuru_no to application_number;
    alter table public.applications rename column ad_soyad to full_name;
    alter table public.applications rename column bolum_sinif to department_year;
    alter table public.applications rename column teknolojiler to technologies;
    alter table public.applications rename column bonus_araclar to bonus_tools;
    alter table public.applications rename column linkler to links;
    alter table public.applications rename column kendini_tanit to self_introduction;
    alter table public.applications rename column llm_deneyimi to llm_experience;
    alter table public.applications rename column ofis_gun to office_days_per_week;
    alter table public.applications rename column cv_dosya_adi to cv_file_name;
    alter table public.applications rename column cv_metni to cv_text;
    alter table public.applications rename column hata_mesaji to error_message;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'applications_basvuru_no_key'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      rename constraint applications_basvuru_no_key
      to applications_application_number_key;
  end if;

  if to_regclass('public.applications_basvuru_no_seq') is not null
    and to_regclass('public.applications_application_number_seq') is null
  then
    alter sequence public.applications_basvuru_no_seq
      rename to applications_application_number_seq;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rubric_versions'
      and column_name = 'agirliklar'
  ) then
    alter table public.rubric_versions rename column agirliklar to weights;
    alter table public.rubric_versions rename column aktif to is_active;
    alter table public.rubric_versions rename column aciklama to description;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enrichment_results'
      and column_name = 'kaynak'
  ) then
    alter table public.enrichment_results rename column kaynak to source;
    alter table public.enrichment_results rename column veri to data;
    alter table public.enrichment_results rename column hata to error;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'emails'
      and column_name = 'taslak_tipi'
  ) then
    alter table public.emails rename column taslak_tipi to draft_type;
    alter table public.emails rename column gonderildi to is_sent;
    alter table public.emails rename column gonderim_zamani to sent_at;
    alter table public.emails rename column hata to error;
  end if;
end
$$;
