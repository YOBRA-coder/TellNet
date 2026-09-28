# Advanced updates (1, 3, 4, 5, 8)

## 3 — Payment reliability
- Idempotent M-Pesa callback settle
- SUCCESS + ACTIVATION_FAILED queues for retry
- Auto retry on callback settle and via Transactions page / `listActivationQueue`
- `activation_attempts`, `last_activation_error`, `next_activation_retry_at`

## 1 — RADIUS multi-AP
- Settings: enable RADIUS + secret
- Helpers in `src/lib/services/radius.server.ts`
- See `scripts/radius-readme.md`

## 5 — Vouchers
- Operator → Vouchers: generate offline codes
- Portal `/portal/voucher` redeem by code + phone
- Creates SUCCESS payment + activates package

## 8 — Multi-site
- `sites` table (default Main site)
- `site_id` on mikrotiks, isps, packages, customers, payments
- Operator `listSites` / `saveSite` APIs

## 4 — ROS 6 API hardening
- Clearer API login errors
- Best-effort `telnet-1dev` profile with `shared-users=1`
