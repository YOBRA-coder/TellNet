-- Live packages + Daraja: no simulated STK. Existing rows must be updated
-- (0003_seed used ON CONFLICT DO NOTHING, so names never changed).

alter table settings
  add column if not exists mpesa_callback_url text;

update settings
set demo_mode = false,
    force_activation_failure = false,
    currency = case when currency in ('KSh', 'Ksh') then 'KES' else currency end,
    hotspot_name = coalesce(nullif(hotspot_name, ''), 'TelNet Wi-Fi'),
    updated_at = now()
where id = 'default';

update packages set name = 'Quick Connect',  updated_at = now() where id = 'pkg_1h';
update packages set name = 'Workday',        updated_at = now() where id = 'pkg_3h';
update packages set name = 'Day Pass',       updated_at = now() where id = 'pkg_24h';
update packages set name = 'Weekly Access',  updated_at = now() where id = 'pkg_7d';
