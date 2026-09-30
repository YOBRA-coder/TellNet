-- Network map: access points (site is inherited from the parent MikroTik,
-- never stored here) and a live snapshot per router (CPU/memory/ports/traffic).

create table if not exists access_points (
  id text primary key,
  mikrotik_id text not null references mikrotiks(id) on delete cascade,
  name text not null,
  ip_address text,
  mac_address text,
  model text,
  -- router port/interface the AP is plugged into (used to count its clients)
  port text,
  notes text,
  status text not null default 'UNKNOWN',
  latency_ms integer,
  clients integer,
  last_seen_at timestamptz,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists access_points_router_idx on access_points (mikrotik_id);

alter table mikrotiks add column if not exists live_json text;
alter table mikrotiks add column if not exists live_at timestamptz;
