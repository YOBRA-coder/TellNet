-- Customer accounts (sign up / sign in with phone + PIN or password),
-- registered-only loyalty & referral codes, and a RADIUS server address.

-- A customer is "registered" once they have set a PIN/password. Everyone
-- else is a guest: they can still buy packages and use someone's referral
-- code, but they don't earn loyalty points and don't get a referral code.
alter table customers add column if not exists pin_hash text;
alter table customers add column if not exists pin_salt text;
alter table customers add column if not exists registered_at timestamptz;
alter table customers add column if not exists failed_pin_attempts integer not null default 0;
alter table customers add column if not exists pin_locked_until timestamptz;

-- Which browsers/devices are signed in as which account. The token is the
-- same per-device token the portal already uses for package binding.
create table if not exists customer_sessions (
  device_token text primary key,
  customer_id text not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists customer_sessions_customer_idx on customer_sessions(customer_id);

-- Referral codes are only issued at sign up. Earlier versions handed one to
-- every phone number that ever paid, so clear the codes of anyone who has
-- not registered (referred_by links and already-paid bonuses are untouched).
update customers set referral_code = null where registered_at is null;

-- Address the MikroTik routers should send RADIUS requests to (this app's
-- public/LAN IP or hostname). Ports/secret/enabled already exist (0013).
alter table settings add column if not exists radius_server_host text;
