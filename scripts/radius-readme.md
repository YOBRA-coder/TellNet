# RADIUS multi-AP

1. Operator → Settings → enable RADIUS, set shared secret, save.
2. Run beside the app (production):

   `node scripts/radius-server.mjs`

   Or use FreeRADIUS with SQL pointing at active `customer_packages`.

3. On each MikroTik:

```
/radius add service=hotspot address=<APP_HOST> secret=<secret> timeout=3s
/ip hotspot profile set [find] use-radius=yes
```

Access-Accept should include Session-Timeout (remaining seconds) and Port-Limit=1.
