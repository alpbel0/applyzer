create table if not exists public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now(),
  constraint mcp_oauth_clients_redirect_uris_check
    check (cardinality(redirect_uris) between 1 and 10)
);

create table if not exists public.mcp_oauth_codes (
  code_hash text primary key,
  client_id uuid not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'admin',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mcp_oauth_codes_client_id_fkey
    foreign key (client_id)
    references public.mcp_oauth_clients (id)
    on delete cascade
);

create index if not exists mcp_oauth_codes_expires_at_idx
  on public.mcp_oauth_codes (expires_at);

create table if not exists public.mcp_rate_limits (
  key text primary key,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  constraint mcp_rate_limits_attempts_check check (attempts >= 0)
);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_rate_limits enable row level security;

revoke all on table public.mcp_oauth_clients from anon, authenticated;
revoke all on table public.mcp_oauth_codes from anon, authenticated;
revoke all on table public.mcp_rate_limits from anon, authenticated;
grant all on table public.mcp_oauth_clients to service_role;
grant all on table public.mcp_oauth_codes to service_role;
grant all on table public.mcp_rate_limits to service_role;

create or replace function public.consume_mcp_submission_limit(
  p_key text,
  p_limit integer default 5
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if length(p_key) <> 64 or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid rate limit input';
  end if;

  insert into public.mcp_rate_limits (key, attempts)
  values (p_key, 1)
  on conflict (key) do update
    set attempts = public.mcp_rate_limits.attempts + 1
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

revoke all on function public.consume_mcp_submission_limit(text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_mcp_submission_limit(text, integer)
  to service_role;
