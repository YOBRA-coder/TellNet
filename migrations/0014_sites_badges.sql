-- Phase 1: expose multi-site management + package badges

alter table sites add column if not exists notes text;

-- "MOST_POPULAR" | "BEST_VALUE" | null — free label, rendered on the
-- portal package card. Kept as free text so future labels don't need
-- another migration.
alter table packages add column if not exists badge text;
