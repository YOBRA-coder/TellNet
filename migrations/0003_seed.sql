insert into settings (id, hotspot_name, welcome_message, demo_mode, currency)
values ('default', 'TelNet Wi-Fi', 'Welcome to Wi-Fi', false, 'KES')
on conflict (id) do nothing;

insert into packages (id, name, price, duration_minutes, download_kbps, upload_kbps, data_limit_mb, status, sort_order)
values
  ('pkg_1h',  'Quick Connect',  10,    60,  2048, 1024, null, 'ACTIVE', 1),
  ('pkg_3h',  'Workday',        20,   180,  3072, 1024, null, 'ACTIVE', 2),
  ('pkg_24h', 'Day Pass',       50,  1440,  5120, 2048, null, 'ACTIVE', 3),
  ('pkg_7d',  'Weekly Access', 200, 10080,  5120, 2048, null, 'ACTIVE', 4)
on conflict (id) do nothing;

-- No demo customers, payments, or pre-seeded ISPs.
-- Operator adds real ISPs and routers; customers appear after real M-Pesa payments.
