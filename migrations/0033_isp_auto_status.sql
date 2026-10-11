-- ISP status can follow the router port it is plugged into (link up = ONLINE, down = OFFLINE)
-- instead of being set by hand. Only applies when the ISP has a MikroTik AND an interface name.
alter table isps add column if not exists auto_status boolean not null default true;
alter table isps add column if not exists status_checked_at timestamptz;
