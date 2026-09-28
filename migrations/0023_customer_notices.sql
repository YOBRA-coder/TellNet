-- In-portal alerts (referral bonus received, welcome bonus, etc.) so a
-- customer sees "+N minutes added" the next time they open the portal,
-- instead of the extension happening silently.
create table if not exists customer_notices (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  kind text not null,
  message text not null,
  minutes integer not null default 0,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists customer_notices_customer_idx
  on customer_notices (customer_id, seen_at, created_at desc);
