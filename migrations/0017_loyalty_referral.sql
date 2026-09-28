-- Phase 3: loyalty points + referral program

alter table settings add column if not exists loyalty_enabled boolean not null default false;
alter table settings add column if not exists loyalty_points_per_kes numeric not null default 1;
alter table settings add column if not exists referral_bonus_points integer not null default 50;

alter table customers add column if not exists referral_code text unique;
alter table customers add column if not exists referred_by_customer_id text references customers(id);
alter table customers add column if not exists loyalty_points integer not null default 0;
alter table customers add column if not exists referral_bonus_paid boolean not null default false;

-- Idempotency guard: activateFromPayment() is called more than once for
-- the same payment (device reconnects, the Phase 3 auto-resume job) —
-- this column ensures a payment only ever awards loyalty points once.
alter table payments add column if not exists loyalty_awarded_at timestamptz;

-- When set, a package can be redeemed with points instead of M-Pesa
-- ("reward package"). Null = not redeemable with points.
alter table packages add column if not exists points_cost integer;

create table if not exists loyalty_ledger (
  id text primary key,
  customer_id text not null references customers(id),
  delta integer not null,
  reason text not null,
  payment_id text references payments(id),
  package_id text references packages(id),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_customer_idx on loyalty_ledger(customer_id);

-- Backfill referral codes for customers that predate this migration.
update customers set referral_code = 'R' || upper(substr(md5(id || random()::text), 1, 6))
where referral_code is null;
