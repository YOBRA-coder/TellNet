# RADIUS (multi-AP)

RADIUS now runs **inside the app** (no separate script). Configure it in
**Admin → Settings → RADIUS (multi-AP)**:

1. Turn on *Enable RADIUS*, enter **this server's address** (the IP/hostname your
   routers can reach), a **shared secret**, and the ports (default UDP 1812/1813). Save.
2. Press **Apply to routers**. For every router this creates a `/radius` entry
   (comment `telnet-radius`, service=hotspot) and sets `use-radius=yes` on the
   hotspot server profile.
3. Press **Check routers** to read each router back and confirm the address,
   secret, ports and `use-radius` match Settings.

Requirements: the host must accept inbound **UDP** on the RADIUS ports (a VPS or a
Railway TCP/UDP service; serverless hosts such as Vercel cannot receive UDP).
Local hotspot users keep working as a fallback. Packages activated before this
update have no RADIUS password until they are next (re)activated.
