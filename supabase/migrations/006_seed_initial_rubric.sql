insert into public.rubric_versions (weights, is_active, description)
values (
  jsonb_build_object(
    'rest_api', 0.15,
    'llm_experience', 0.20,
    'agentic_mcp', 0.20,
    'bonus_tools', 0.15,
    'verifiability', 0.15,
    'learning_signal', 0.10,
    'cv_quality', 0.05
  ),
  true,
  'Initial rubric — REQUIREMENTS.md §6.2'
);
