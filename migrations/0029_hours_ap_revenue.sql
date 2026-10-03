-- Per-router opening hours (customizable schedule), closed-time handling,
-- memory figures from the router, and per-AP usage samples for revenue.

alter table mikrotiks add column if not exists hours_enabled boolean not null default false;
-- {"0":[["06:00","22:00"]],"1":[...],...}  keys: 0=Sunday .. 6=Saturday. A window whose end <= start crosses midnight.
alter table mikrotiks add column if not exists hours_json text;
alter table mikrotiks add column if not exists hours_state text not null default 'OPEN';
alter table mikrotiks add column if not exists hours_applied boolean not null default true;
alter table mikrotiks add column if not exists closed_since timestamptz;
-- package kinds customers may still buy while closed (comma separated)
alter table mikrotiks add column if not exists hours_allow text not null default 'WEEKLY,MONTHLY';
-- don't count closed hours against Daily/Weekly/Monthly/voucher packages
alter table mikrotiks add column if not exists hours_pause boolean not null default true;
alter table mikrotiks add column if not exists hours_message text;

alter table mikrotiks add column if not exists mem_total bigint;
alter table mikrotiks add column if not exists mem_free bigint;

-- Which AP each paying customer's package was connected through (sampled).
create table if not exists ap_usage (
  ap_key text not null,
  package_id text not null,
  customer_id text not null,
  samples integer not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (ap_key, package_id)
);
create index if not exists ap_usage_pkg_idx on ap_usage (package_id);
create index if not exists ap_usage_seen_idx on ap_usage (last_seen);
