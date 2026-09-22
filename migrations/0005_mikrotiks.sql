-- Real MikroTik routers managed from the Network page.
-- Billing still talks to one primary router; extra rows are standby / backup.

create table if not exists mikrotiks (
  id text primary key,
  name text not null,
  host text not null,
  api_user text not null,
  api_password text not null,
  hotspot_name text not null default 'hotspot1',
  ssl boolean not null default false,
  is_primary boolean not null default false,
  status text not null default 'UNKNOWN',
  identity text,
  version text,
  board_name text,
  uptime text,
  cpu_load integer,
  last_ping_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mikrotiks_one_primary
  on mikrotiks (is_primary)
  where is_primary = true;

create index if not exists mikrotiks_status_idx on mikrotiks (status);
