-- Operator console accounts: each person signs in with their own phone number + password.
-- While this table is empty the old shared operator password still works (so nobody is locked out on upgrade);
-- once the first owner exists the shared password stops working.
create table if not exists operators (
  id text primary key,
  name text not null,
  phone text not null unique,
  pw_hash text not null,
  pw_salt text not null,
  role text not null default 'OPERATOR',      -- OWNER | OPERATOR
  status text not null default 'ACTIVE',      -- ACTIVE | DISABLED
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Keep customer reset codes and operator reset codes apart (same table, different purpose).
create index if not exists otp_codes_purpose_idx on otp_codes (purpose, phone, created_at desc);
