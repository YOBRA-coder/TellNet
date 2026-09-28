-- Lets a host see *what* is connected on their shared package (phone B
-- joining by entering the host's phone number), not just how many slots
-- are used.

alter table customer_package_devices add column if not exists device_info text;
