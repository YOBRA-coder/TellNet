-- "Add another toggle for 2dev" — device sharing was previously a hard
-- single-device lock (customer_packages.bound_device_token, one slot). This
-- adds a real multi-device binding table so the limit can be 1 or 2, plus
-- the setting that picks which.

alter table settings add column if not exists max_devices_per_package integer not null default 1;
alter table settings add constraint max_devices_per_package_range check (max_devices_per_package in (1, 2));

create table if not exists customer_package_devices (
  customer_package_id text not null references customer_packages(id),
  device_token text not null,
  bound_at timestamptz not null default now(),
  primary key (customer_package_id, device_token)
);

-- Carry over any existing single-token bindings so nobody already bound
-- under the old column loses their slot when this ships.
insert into customer_package_devices (customer_package_id, device_token, bound_at)
select id, bound_device_token, coalesce(bound_at, now())
from customer_packages
where bound_device_token is not null
on conflict do nothing;
