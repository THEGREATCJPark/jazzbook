-- Isolated, non-exposed schema. No access from browser Data API roles.
create schema if not exists jazzbook;
revoke all on schema jazzbook from public, anon, authenticated;
create table jazzbook.settings (id boolean primary key default true check(id), password_hash text not null, auth_version integer not null default 1, updated timestamptz not null default now());
create table jazzbook.sets (id text primary key, share text unique not null, archived boolean not null default false, data jsonb not null, version integer not null default 1, updated timestamptz not null default now());
create table jazzbook.sessions (token_hash text primary key, auth_version integer not null, expires timestamptz not null);
create table jazzbook.login_attempts (bucket text primary key, attempts integer not null, started timestamptz not null);
alter table jazzbook.settings enable row level security;
alter table jazzbook.sets enable row level security;
alter table jazzbook.sessions enable row level security;
alter table jazzbook.login_attempts enable row level security;
revoke all on all tables in schema jazzbook from public, anon, authenticated;
-- Bootstrap only. Applying again must never reset an existing administrator password.
insert into jazzbook.settings(id,password_hash) values(true,extensions.crypt('0000',extensions.gen_salt('bf',10))) on conflict(id) do nothing;
