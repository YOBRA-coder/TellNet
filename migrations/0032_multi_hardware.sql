-- Multi-hardware support: each router/site can be MikroTik (default, unchanged),
-- TP-Link Omada (External Portal + controller API) or Ruijie (WiFiDog external portal).
--
-- Existing rows default to 'mikrotik', so current sites behave exactly as before.
-- Core credentials keep using host / api_user / api_password; vendor extras
-- (Omada ID, site name, time unit, Ruijie gateway id ...) live in hw_config (JSON text).

alter table mikrotiks add column if not exists hardware_type text not null default 'mikrotik';
alter table mikrotiks add column if not exists hw_config text;
-- Ruijie: last time the gateway called our WiFiDog ping/auth endpoints (its heartbeat).
alter table mikrotiks add column if not exists hw_seen_at timestamptz;

-- What a captive-portal redirect told us about a client (MAC, AP, SSID ...).
-- Linked to the customer's browser (device_token) once the portal page loads.
create table if not exists hw_clients (
  id text primary key,
  router_id text references mikrotiks(id) on delete cascade,
  vendor text not null,
  device_token text,
  client_mac text not null,
  mac_norm text not null,
  client_ip text,
  ap_mac text,
  ssid text,
  radio_id text,
  site_name text,
  extra text,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists hw_clients_token_idx on hw_clients (device_token, seen_at desc);
create index if not exists hw_clients_mac_idx on hw_clients (mac_norm, seen_at desc);

-- One row per client device switched on by a package (the vendor-side "login").
create table if not exists hw_authorizations (
  id text primary key,
  customer_package_id text references customer_packages(id) on delete set null,
  router_id text references mikrotiks(id) on delete cascade,
  vendor text not null,
  username text not null,
  client_mac text not null,
  mac_norm text not null,
  token text,
  status text not null default 'ACTIVE',
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  handoff_done boolean not null default false,
  extra text
);
create index if not exists hw_auth_user_idx on hw_authorizations (username, status);
create index if not exists hw_auth_token_idx on hw_authorizations (token) where token is not null;
create index if not exists hw_auth_mac_idx on hw_authorizations (mac_norm, status);
