-- ISP pool caps + MikroTik WAN camouflage identity.

alter table settings
  add column if not exists isp_total_kbps integer not null default 30720;
alter table settings
  add column if not exists per_user_max_kbps integer not null default 5120;
alter table settings
  add column if not exists max_users integer not null default 25;

alter table isps
  add column if not exists total_kbps integer not null default 30720;
alter table isps
  add column if not exists per_user_max_kbps integer not null default 5120;
alter table isps
  add column if not exists max_users integer not null default 25;

alter table mikrotiks
  add column if not exists camouflage text;
alter table mikrotiks
  add column if not exists camouflage_interface text;
alter table mikrotiks
  add column if not exists camouflage_mac text;
alter table mikrotiks
  add column if not exists camouflage_applied_at timestamptz;

update isps
set total_kbps = 30720,
    per_user_max_kbps = 5120,
    max_users = 25
where total_kbps is null or total_kbps = 30720;

update isps
set total_kbps = 102400, max_users = 30
where type in ('STARLINK', 'FIBRE');
