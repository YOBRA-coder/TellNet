-- TextBee SMS + one-time codes for PIN/password reset.
-- reset_method: BOTH = customer may use SMS code or M-Pesa receipt; OTP = SMS code only; RECEIPT = receipt only.
alter table settings add column if not exists sms_enabled boolean not null default false;
alter table settings add column if not exists sms_api_key text;
alter table settings add column if not exists sms_device_id text;
alter table settings add column if not exists reset_method text not null default 'RECEIPT';

create table if not exists otp_codes (
  id text primary key,
  customer_id text not null,
  phone text not null,
  code_hash text not null,
  code_salt text not null,
  purpose text not null default 'RESET',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists otp_codes_phone_idx on otp_codes (phone, created_at desc);
