-- Sites (multi-tenant), vouchers, payment activation queue, RADIUS settings

create table if not exists sites (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into sites (id, name, slug, status)
values ('site_default', 'Main site', 'main', 'ACTIVE')
on conflict (id) do nothing;

alter table mikrotiks add column if not exists site_id text references sites(id);
alter table isps add column if not exists site_id text references sites(id);
alter table packages add column if not exists site_id text references sites(id);
alter table customers add column if not exists site_id text references sites(id);
alter table payments add column if not exists site_id text references sites(id);

update mikrotiks set site_id = 'site_default' where site_id is null;
update isps set site_id = 'site_default' where site_id is null;
update packages set site_id = 'site_default' where site_id is null;

-- Activation retry queue fields on payments
alter table payments add column if not exists activation_attempts integer not null default 0;
alter table payments add column if not exists last_activation_error text;
alter table payments add column if not exists next_activation_retry_at timestamptz;
alter table payments add column if not exists callback_received_at timestamptz;

-- Vouchers / offline codes
create table if not exists vouchers (
  id text primary key,
  code text not null unique,
  package_id text not null references packages(id),
  site_id text references sites(id),
  status text not null default 'AVAILABLE',
  batch_label text,
  redeemed_by_customer_id text references customers(id),
  redeemed_payment_id text references payments(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vouchers_status_idx on vouchers (status, package_id);
create index if not exists vouchers_code_idx on vouchers (code);

-- RADIUS (central auth for multi-AP)
alter table settings add column if not exists radius_enabled boolean not null default false;
alter table settings add column if not exists radius_secret text;
alter table settings add column if not exists radius_auth_port integer not null default 1812;
alter table settings add column if not exists radius_acct_port integer not null default 1813;

-- customer package radius password for RADIUS auth
alter table customer_packages add column if not exists radius_password text;
