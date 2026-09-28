-- Two fixes:
--
-- 1) Device sharing was a single global setting (settings.max_devices_per_package)
--    applied to every package. Move it onto each package instead, so an
--    operator can sell a 1-device Hourly and a 2-device Family package side
--    by side. settings.max_devices_per_package / settings.one_device_per_package
--    are left in place (the toggle still turns sharing on/off site-wide, and
--    the old numeric column now only seeds new packages' default) — nothing
--    reads the per-package cap from settings anymore.
--
-- 2) "Buying a new package while one is still active" used to disconnect the
--    live session and replace it with the new package immediately, abandoning
--    whatever time was left. There's no schema change required for that fix
--    (customer_packages.status is already free text) — activateFromPayment()
--    now inserts the new package as status = 'QUEUED' when the customer
--    already has paid-for time remaining, and expireDuePackages() promotes
--    the oldest QUEUED package to ACTIVE the moment the current one runs out.
--    This comment documents the new status value; nothing here enforces it.

alter table packages add column if not exists max_devices integer not null default 1;
alter table packages add constraint packages_max_devices_range check (max_devices in (1, 2));

-- Backfill from whatever the global setting already was, so nobody's
-- currently-active sharing arrangement changes the moment this ships.
update packages set max_devices = coalesce(
  (select max_devices_per_package from settings where id = 'default'), 1
);

-- payments.activation_status and customer_packages.status are both free
-- text (no check constraint) — activateFromPayment() writes 'QUEUED' into
-- both for a stacked purchase, read back by the app's own type guards.
