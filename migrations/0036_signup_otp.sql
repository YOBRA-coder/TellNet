-- Optional: customers must confirm their phone with an SMS code when creating an account (needs TextBee).
alter table settings add column if not exists signup_otp boolean not null default false;
