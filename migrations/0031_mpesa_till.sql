-- M-Pesa Express for Till (Buy Goods) accounts. Default stays Paybill, so nothing changes until chosen.
alter table settings add column if not exists mpesa_account_type text not null default 'paybill';
alter table settings add column if not exists mpesa_till_number text;
