-- One active device per purchased package. Enforced in the ledger and on
-- MikroTik via shared-users=1. Operators can release a device from the console.

alter table settings
  add column if not exists one_device_per_package boolean not null default true;

alter table customer_packages
  add column if not exists bound_device_token text;
alter table customer_packages
  add column if not exists bound_mac text;
alter table customer_packages
  add column if not exists bound_at timestamptz;

create index if not exists cp_bound_token_idx
  on customer_packages (bound_device_token)
  where bound_device_token is not null;

update customer_packages
set bound_at = coalesce(bound_at, start_time)
where id = 'cp_amina' and bound_device_token is null;
