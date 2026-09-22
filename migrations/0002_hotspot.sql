-- TelNet hotspot billing schema. ISP-agnostic: packages, payments and sessions
-- never bind to a specific WAN / provider.

create table if not exists settings (
  id text primary key default 'default',
  hotspot_name text not null default 'TelNet Wi-Fi',
  currency text not null default 'KSh',
  welcome_message text not null default 'Welcome to Wi-Fi',
  demo_mode boolean not null default false,
  force_activation_failure boolean not null default false,
  mpesa_shortcode text,
  mpesa_consumer_key text,
  mpesa_consumer_secret text,
  mpesa_passkey text,
  mpesa_env text not null default 'sandbox',
  mikrotik_host text,
  mikrotik_user text,
  mikrotik_password text,
  mikrotik_hotspot text default 'hotspot1',
  default_upload_kbps integer not null default 1024,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists packages (
  id text primary key,
  name text not null,
  price integer not null,
  duration_minutes integer not null,
  download_kbps integer not null,
  upload_kbps integer not null,
  data_limit_mb integer,
  status text not null default 'ACTIVE',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id text primary key,
  phone text not null unique,
  device_token text,
  status text not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  customer_id text not null references customers(id),
  package_id text not null references packages(id),
  mpesa_transaction_id text,
  checkout_request_id text,
  merchant_request_id text,
  phone text not null,
  amount integer not null,
  status text not null default 'PENDING',
  activation_status text not null default 'NOT_ACTIVATED',
  result_code integer,
  result_desc text,
  transaction_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payments_mpesa_tx_uidx
  on payments (mpesa_transaction_id)
  where mpesa_transaction_id is not null;

create index if not exists payments_checkout_idx on payments (checkout_request_id);
create index if not exists payments_phone_idx on payments (phone);
create index if not exists payments_status_idx on payments (status, created_at desc);
create index if not exists payments_customer_idx on payments (customer_id);

create table if not exists customer_packages (
  id text primary key,
  customer_id text not null references customers(id),
  package_id text not null references packages(id),
  payment_id text not null references payments(id),
  start_time timestamptz not null,
  expiry_time timestamptz not null,
  speed_limit_kbps integer not null,
  data_limit_mb integer,
  status text not null default 'ACTIVE',
  activation_status text not null default 'NOT_ACTIVATED',
  mikrotik_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cp_customer_idx on customer_packages (customer_id, status);
create index if not exists cp_expiry_idx on customer_packages (expiry_time);
create index if not exists cp_payment_idx on customer_packages (payment_id);

create table if not exists sessions (
  id text primary key,
  customer_id text not null references customers(id),
  package_id text not null references packages(id),
  customer_package_id text references customer_packages(id),
  mikrotik_username text,
  ip_address text,
  mac_address text,
  device_information text,
  bytes_down bigint not null default 0,
  bytes_up bigint not null default 0,
  session_start timestamptz not null default now(),
  session_end timestamptz,
  last_seen timestamptz not null default now(),
  status text not null default 'ACTIVE'
);

create index if not exists sessions_status_idx on sessions (status);
create index if not exists sessions_customer_idx on sessions (customer_id);

create table if not exists isps (
  id text primary key,
  name text not null,
  type text not null,
  interface_name text,
  status text not null default 'ONLINE',
  latency_ms integer,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists network_events (
  id text primary key,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists network_events_created_idx on network_events (created_at desc);

create table if not exists recovery_attempts (
  id text primary key,
  phone text,
  transaction_id text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists recovery_attempts_created_idx on recovery_attempts (created_at desc);

create table if not exists mikrotik_users (
  username text primary key,
  password text not null,
  profile text,
  disabled boolean not null default false,
  download_kbps integer,
  upload_kbps integer,
  session_timeout_seconds integer,
  customer_id text,
  created_at timestamptz not null default now()
);
