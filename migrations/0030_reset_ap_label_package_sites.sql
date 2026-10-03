-- 1) Customer self-service password reset: separate brute-force counters so
--    guessing receipts can't lock a customer out of normal sign in.
alter table customers add column if not exists reset_failed_attempts integer not null default 0;
alter table customers add column if not exists reset_locked_until timestamptz;

-- 2) Access points: the number/tag physically marked on the device (e.g. "3" or "A-07").
alter table access_points add column if not exists label text;

-- 3) A package can be sold at several sites. No rows (and packages.site_id null) = all sites.
--    packages.site_id is kept in step with the first selected site for older code paths.
create table if not exists package_sites (
  package_id text not null references packages(id) on delete cascade,
  site_id text not null references sites(id) on delete cascade,
  primary key (package_id, site_id)
);
create index if not exists package_sites_site_idx on package_sites (site_id);

insert into package_sites (package_id, site_id)
select p.id, p.site_id from packages p
where p.site_id is not null and exists (select 1 from sites s where s.id = p.site_id)
on conflict do nothing;
