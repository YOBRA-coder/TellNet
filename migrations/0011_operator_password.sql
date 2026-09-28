alter table settings
  add column if not exists operator_password text not null default 'telnet-admin';

update settings
set operator_password = coalesce(nullif(operator_password, ''), 'telnet-admin')
where id = 'default';
