-- Airtime / data / minutes / SMS shop.
create table if not exists shop_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  title text,
  notice text,
  -- how orders reach the customer's phone: ANDROID (a phone that dials USSD) or API (a reseller's HTTP API)
  fulfilment text not null default 'ANDROID',
  max_attempts integer not null default 5,
  -- how shop sales are paid: CURRENT (same M-Pesa setup as Wi-Fi) or CUSTOM (its own till / paybill)
  payment_mode text not null default 'CURRENT',
  pay_account_type text not null default 'paybill',
  pay_shortcode text,
  pay_till text,
  pay_passkey text,
  pay_key text,
  pay_secret text,
  -- reseller API (templated request)
  api_url text,
  api_method text not null default 'POST',
  api_content_type text not null default 'json',
  api_headers text,
  api_body text,
  api_success_path text,
  api_success_value text,
  updated_at timestamptz not null default now()
);
insert into shop_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists shop_products (
  id text primary key,
  kind text not null,                       -- DATA | MINUTES | SMS | AIRTIME
  name text not null,
  price integer,                            -- fixed price (null for AIRTIME: customer picks the amount)
  min_amount integer,
  max_amount integer,
  ussd_code text,                           -- ANDROID mode: e.g. *180*5*2*{phone}*1#   ({phone} {amount} {order})
  provider_code text,                       -- API mode: the provider's product / bundle code
  okoa_ok boolean not null default false,   -- shown as "Okoa accepted"
  notes text,
  site_id text,                             -- null = sold at every site
  sort_order integer not null default 0,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists shop_orders (
  id text primary key,
  product_id text,
  product_name text not null,
  kind text not null,
  amount integer not null,
  payer_phone text not null,
  target_phone text not null,
  site_id text,
  status text not null default 'PENDING',   -- PENDING | PAID | CANCELLED | FAILED
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  result_desc text,
  fulfil_status text not null default 'NONE', -- NONE | QUEUED | SENT | DONE | FAILED
  fulfil_method text,
  fulfil_attempts integer not null default 0,
  fulfil_error text,
  next_attempt_at timestamptz,
  provider_ref text,
  device_id text,
  refunded boolean not null default false,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_checkout_idx on shop_orders (checkout_request_id);
create index if not exists shop_orders_status_idx on shop_orders (fulfil_status, next_attempt_at);

create table if not exists shop_devices (
  id text primary key,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  site_id text,
  status text not null default 'ACTIVE',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
