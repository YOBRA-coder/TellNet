-- Live-only cleanup: remove demo seed rows. Packages (Quick Connect etc.) stay.
-- ISPs must be added by the operator — no pre-seeded "ready" uplinks.

update settings
set demo_mode = false,
    updated_at = now()
where id = 'default';

-- Ensure package names match live catalog
update packages set name = 'Quick Connect',  price = 10,  duration_minutes = 60,   download_kbps = 2048, upload_kbps = 1024, sort_order = 1, status = 'ACTIVE' where id = 'pkg_1h';
update packages set name = 'Workday',        price = 20,  duration_minutes = 180,  download_kbps = 3072, upload_kbps = 1024, sort_order = 2, status = 'ACTIVE' where id = 'pkg_3h';
update packages set name = 'Day Pass',       price = 50,  duration_minutes = 1440, download_kbps = 5120, upload_kbps = 2048, sort_order = 3, status = 'ACTIVE' where id = 'pkg_24h';
update packages set name = 'Weekly Access',  price = 200, duration_minutes = 10080, download_kbps = 5120, upload_kbps = 2048, sort_order = 4, status = 'ACTIVE' where id = 'pkg_7d';

insert into packages (id, name, price, duration_minutes, download_kbps, upload_kbps, data_limit_mb, status, sort_order)
values
  ('pkg_1h',  'Quick Connect',  10,    60,  2048, 1024, null, 'ACTIVE', 1),
  ('pkg_3h',  'Workday',        20,   180,  3072, 1024, null, 'ACTIVE', 2),
  ('pkg_24h', 'Day Pass',       50,  1440,  5120, 2048, null, 'ACTIVE', 3),
  ('pkg_7d',  'Weekly Access', 200, 10080,  5120, 2048, null, 'ACTIVE', 4)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  download_kbps = excluded.download_kbps,
  upload_kbps = excluded.upload_kbps,
  status = 'ACTIVE',
  sort_order = excluded.sort_order;

-- Packages (Quick Connect / Workday / Day Pass / Weekly Access) are REAL catalog — never delete them.
-- Drop seeded demo traffic only
delete from sessions;
delete from customer_packages;
delete from payments;
delete from customers;
delete from mikrotik_users;
delete from isps;


