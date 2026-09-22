-- RouterOS 7 = REST (www). RouterOS 6 = binary API port 8728.
alter table mikrotiks
  add column if not exists api_mode text not null default 'rest';

alter table mikrotiks
  add column if not exists api_port integer;

comment on column mikrotiks.api_mode is 'rest = RouterOS 7 /rest; api6 = RouterOS 6 binary API';
