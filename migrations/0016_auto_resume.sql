-- Phase 3: auto-resume after router recovery

-- Explicit duration category per package, since "Hourly/Daily/Weekly/Monthly"
-- is a billing concept the client cares about (resume eligibility), not
-- something safe to infer from duration_minutes alone (e.g. is a 3-day
-- package "daily" or "weekly"?). Backfilled from duration_minutes as a
-- reasonable default; admins can override per package.
alter table packages add column if not exists duration_kind text;

update packages set duration_kind = case
  when duration_minutes <= 90 then 'HOURLY'
  when duration_minutes <= 1440 then 'DAILY'
  when duration_minutes <= 10080 then 'WEEKLY'
  else 'MONTHLY'
end
where duration_kind is null;

-- Audit trail: when a package was last auto/manually resumed after a router
-- outage, shown on the customer row so an operator can see it happened.
alter table customer_packages add column if not exists last_resumed_at timestamptz;
