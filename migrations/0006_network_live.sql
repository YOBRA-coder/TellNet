-- Live RouterOS probe data + ISP rows can belong to a registered MikroTik.

alter table mikrotiks
  add column if not exists insecure_tls boolean not null default false;

alter table mikrotiks
  add column if not exists interfaces_json text;

alter table isps
  add column if not exists mikrotik_id text references mikrotiks(id) on delete set null;

create index if not exists isps_mikrotik_idx on isps (mikrotik_id);
