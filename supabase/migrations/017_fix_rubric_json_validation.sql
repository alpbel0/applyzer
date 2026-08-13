-- Migration 016 was already applied to the live project before its JSON key
-- count was exercised. Replace the unavailable jsonb_object_length call in
-- that installed function. On a clean install, 016 already contains the
-- corrected expression and this migration is intentionally a no-op.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.create_rubric_version_and_recalculate(jsonb,text)'::regprocedure
  ) into v_definition;

  if position('jsonb_object_length(p_weights)' in v_definition) > 0 then
    execute replace(
      v_definition,
      'jsonb_object_length(p_weights)',
      '(select count(*) from jsonb_object_keys(p_weights))'
    );
  end if;
end;
$migration$;
