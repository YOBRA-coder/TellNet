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
Opening hours switch-off, student domain blocking, per-package speed, live router stats (MikroTik-only features).
<<<<<<< HEAD
=======

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
>>>>>>> 01303452 (fix: fix hardware activation and row service issues)
