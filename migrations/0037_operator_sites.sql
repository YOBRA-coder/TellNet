-- An operator belongs to ONE site and only sees/acts on that site. Owners (site_id null) see and control every site.
alter table operators add column if not exists site_id text;
