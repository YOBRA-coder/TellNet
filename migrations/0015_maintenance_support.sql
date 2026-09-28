-- Phase 2: maintenance mode + captive portal support section

alter table settings add column if not exists maintenance_mode boolean not null default false;
alter table settings add column if not exists maintenance_message text;

-- Captive portal "Need help?" section. All optional — the portal only
-- shows the ones that are filled in.
alter table settings add column if not exists support_phone text;
alter table settings add column if not exists support_whatsapp text;
alter table settings add column if not exists support_message text;

-- "Delete customer info" — soft-delete + PII redaction rather than a hard
-- row delete, since payments/sessions/customer_packages reference the
-- customer and payments.phone must stay reconcilable against M-Pesa
-- statements for accounting. deleted_at marks the row as scrubbed so the
-- admin UI can hide it from normal lists.
alter table customers add column if not exists deleted_at timestamptz;
