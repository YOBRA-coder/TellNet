-- Referral program: switch the referral reward from loyalty points to a
-- straight minutes top-up. The general loyalty-points system (earn per KES,
-- redeem for reward packages) is untouched — this only replaces what a
-- referral itself pays out.

alter table settings add column if not exists referral_enabled boolean not null default true;
alter table settings add column if not exists referral_bonus_minutes integer not null default 30;
alter table settings add column if not exists welcome_bonus_minutes integer not null default 10;
alter table settings add column if not exists referral_min_package_price numeric not null default 20;

-- Minutes a customer is owed but that haven't been applied to a package
-- yet (e.g. they referred a friend while they had no active package).
-- Applied automatically the next time they activate a package.
alter table customers add column if not exists bonus_minutes_balance integer not null default 0;

-- Idempotency guard, mirroring payments.loyalty_awarded_at: activation can
-- run more than once for the same payment (reconnects, auto-resume), so
-- this ensures the referral/welcome minutes for a given payment are only
-- ever granted once.
alter table payments add column if not exists referral_minutes_awarded_at timestamptz;
