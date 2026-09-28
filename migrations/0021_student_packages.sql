-- Student packages: cheap, longer-duration, lower-speed packages with a
-- configurable "non-study" domain blocklist enforced on the router
-- (best-effort — see ensureStudentDomainBlock in mikrotik.server.ts).

alter table packages add column if not exists category text not null default 'STANDARD';

alter table settings add column if not exists student_blocked_domains text
  not null default 'facebook.com,instagram.com,tiktok.com,youtube.com,netflix.com,twitter.com,x.com,snapchat.com';
