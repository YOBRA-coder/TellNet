# Multi-hardware support (MikroTik + TP-Link Omada + Ruijie)

Admin: **Network -> Add router -> Hardware** = MikroTik | TP-Link Omada | Ruijie / Reyee.
Existing routers are migrated (`0032_multi_hardware.sql`) as `mikrotik` and run the original code unchanged.

## How it works
- `src/lib/services/hardware/` is the abstraction layer. Billing (activation, expiry, disconnect, block) calls it.
- A customer who arrived through an Omada/Ruijie portal is switched on by that vendor's driver (keyed by client MAC).
  Everyone else takes the original MikroTik code path.
- Payment, packages, referral and loyalty bonuses are untouched and vendor-neutral.

## TP-Link Omada (External Portal Server + Hotspot Operator API)
1. Controller: Hotspot Manager -> add an **Operator** account.
2. SSID -> Portal -> **External Portal Server**, URL = `https://<app>/api/hw/entry/<routerId>` (shown on the router card).
3. Pre-Authentication Access: your app domain + M-Pesa/Daraja domains.
4. Add the site in the admin (controller URL + port, operator + password). Controller ID is auto-detected.
- Pay -> `extPortal/auth` with the package time; the controller ends the session itself at expiry.
- Manual disconnect: re-authorizes the client for 1 second (the documented API has no "unauthorize").
- The controller must be reachable from this server (VPS-hosted controller or OC200 with port forwarding/cloud).
- A standalone AP is not enough: the portal needs a controller. A router/gateway must provide DHCP + internet.
- Package speed is NOT sent to Omada; set a rate limit on the SSID/profile.

## Ruijie / Reyee (WiFiDog external portal)
1. Gateway: Authentication Template -> External Portal -> WiFiDog **V1**, Server URL = `https://<app>/api/hw/wd/<routerId>/` (trailing slash).
2. Pre-auth allowlist: app domain + M-Pesa domains. Apply the template in an Authentication Policy.
- After payment the browser is sent to `http://<gateway>:<port>/wifidog/auth?token=...`; the gateway then asks
  `auth/` every minute or so. We answer `Auth: 0` when time ends / admin disconnects / customer blocked.
  Disconnect latency = the gateway's check-in interval.
- The captive portal runs on the Reyee **gateway** (EG series), not the AP alone. Needs HTTPS app URL reachable by clients.

## MUST be verified on real hardware before go-live
1. Omada `time` unit: default milliseconds (TP-Link doc); switch to microseconds in the form if a 1-hour test cuts off
   after seconds or never expires.
2. Omada manual disconnect (1s re-authorize) actually kicks the client on your controller version.
3. Ruijie model supports WiFiDog V1 and sends gw_address/gw_port/mac/ip.
These were tested against mock controller/gateway servers, not real devices.

## Not available on Omada/Ruijie
Student domain blocking, per-package speed, live router stats (MikroTik-only features). Opening hours DO work (see below).

## Network and Network map pages (updated)
- **Network page**: every site shows a hardware badge. Omada/Ruijie cards show portal mode, devices online and last contact, with a
  one-click **copy** of the Portal/Server URL; MikroTik-only items (camouflage, WAN interface, CPU/memory, "Use for activations")
  are hidden for them. Adding an Omada/Ruijie site keeps the dialog open after saving so the URL (it contains the site id) can be copied.
  Hardware can't be changed on a saved site. Removing a site now asks first.
- **"Primary router" is MikroTik-only.** Saving, promoting or deleting an Omada/Ruijie site no longer changes which MikroTik is primary
  (previously it could clear it).
- **Network map**: Omada/Ruijie sites appear with their badge, status (refreshed on every map refresh), devices online, and are counted in
  "Active users". Their APs show clients (matched by AP MAC, Omada only) and revenue (Omada only). Ruijie's protocol does not report
  the AP, so Ruijie APs are a list only. APs on Omada are never pinged, so they show Online while customers are connected, otherwise grey.

## Which hardware serves which site (primary / default)
- Each customer is switched on by the hardware they connected through: an Omada/Ruijie portal redirect -> that site's vendor driver;
  anything else -> the MikroTik code path. A sale is only sent to a remembered vendor site when it is the SAME site as the sale
  (a customer who used an Omada site and then buys at a MikroTik site is served by the MikroTik).
- "Primary" is a MikroTik-only flag and global (the MikroTik that creates hotspot logins). Omada/Ruijie sites never need it and never change it.
  A town can use Omada only, Ruijie only or MikroTik only; no per-site "default hardware" setting is needed.
- Reports -> "Revenue by hardware"; Live users and Transactions show site + hardware and filter by site.

## Portal: which hardware connects a customer, and ISP limits per site
- Reconnect ("Connect"), "Already paid?", vouchers and loyalty points now send the site from the portal link (?site=) so the customer
  is switched on by the hardware of the site they are AT NOW, not the site the voucher/payment belongs to (a main-site voucher redeemed
  on an Omada site used to be provisioned on the MikroTik). Points redemption now goes to the Connect page so a Ruijie login finishes.
- ISP paths limit their own site only: seats, per-user speed and the "no internet" purchase block use that site's ISP paths; a site with no ISP
  path uses Settings -> Fallback limits and is never judged "down". (Before, zero ISP paths wrongly blocked reconnects.)
- ISP status can follow the router port (migration 0033): needs a MikroTik + interface; checked every minute by the background tick.
  Link up = ONLINE, down = OFFLINE, DEGRADED stays manual; an unreachable router is never guessed. RADIUS still uses the highest per-user cap overall.

## Opening hours for Omada / Ruijie
- Same editor and weekly windows as MikroTik (Network -> site -> Opening hours). TelNet itself enforces closing: every device it switched on is
  ended, new logins are refused (portal says "We're closed…", Ruijie's gateway check-in is answered `Auth: 0`), the portal shows the Closed banner,
  purchase limits (allowed package types) and closed-time credit to Daily/Weekly/Monthly/voucher packages work as on MikroTik.
- A package bought while closed is paid and running but the device is switched on when the customer taps Reconnect after opening.
- Ruijie devices already online are cut when the gateway next checks in (about a minute). A failed disconnect is retried every minute.
- Neither vendor has an API to switch the Wi-Fi name (SSID) off, so TelNet cannot make it vanish. To also hide it, add the vendor's own schedule
  with the same hours: Omada controller -> Wi-Fi Scheduler (Radio Off); Ruijie Cloud / Reyee -> Wi-Fi timer (name varies by model).

## SMS code for PIN/password reset (TextBee)
- Settings -> **SMS & reset**: choose **All** (customer picks SMS or M-Pesa receipt), **SMS code only** or **M-Pesa receipt only**; enter the TextBee API key,
  Device ID, switch it on, and use "Send test". The API key is never shown again. If SMS is chosen but not working, customers fall back to the receipt.
- Codes: 6 digits, stored hashed, valid 10 minutes, single use, 5 wrong tries, 1 per minute and 5 per hour per number; unknown numbers get the same
  answer (nothing revealed). Needs migration `0034_sms_otp.sql`. Each code uses one SMS of the TextBee plan; "accepted" by TextBee is not "delivered".
