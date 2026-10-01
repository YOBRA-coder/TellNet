-- Guests (no account) can only use 1-device packages; 2-device packages need
-- a free account. Operators can switch this off in Settings.
alter table settings add column if not exists require_account_multi_device boolean not null default true;

-- Automatically delete REDEEMED vouchers this many days after redemption
-- (0 = keep forever). Managed from the Vouchers page.
alter table settings add column if not exists voucher_auto_clean_days integer not null default 0;

create index if not exists vouchers_batch_idx on vouchers (batch_label);
create index if not exists vouchers_redeemed_idx on vouchers (status, redeemed_at);
