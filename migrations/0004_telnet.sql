-- Rebrand hotspot identity from Nuru to TelNet without touching live sessions.
update settings
set hotspot_name = 'TelNet Wi-Fi',
    updated_at = now()
where id = 'default'
  and hotspot_name = 'Nuru Wi-Fi';
