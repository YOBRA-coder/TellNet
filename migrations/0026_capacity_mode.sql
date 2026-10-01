-- Capacity limits (total speed, per-user cap, max users) can now come from
-- each ISP path instead of one global default.
--   PER_ISP: use the ISP paths that are currently up (falls back to the
--            global values when no ISP path exists)
--   GLOBAL : always use the single set of values under Settings
alter table settings add column if not exists capacity_mode text not null default 'PER_ISP';
