const KEY = "telnet.device";

export const PACKAGE_IN_USE_MESSAGE =
  "This package is already in use on another device.";

export type DeviceIdentity = {
  token: string;
  phone: string | null;
  customerId: string | null;
};

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `tok_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function readDevice(): DeviceIdentity {
  if (typeof window === "undefined") {
    return { token: "tok_ssr", phone: null, customerId: null };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceIdentity;
      if (parsed.token && parsed.token.length >= 8) return parsed;
    }
  } catch {
    /* ignore */
  }
  const fresh: DeviceIdentity = { token: randomToken(), phone: null, customerId: null };
  writeDevice(fresh);
  return fresh;
}

export function writeDevice(next: DeviceIdentity) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function patchDevice(patch: Partial<DeviceIdentity>): DeviceIdentity {
  const cur = readDevice();
  const next = { ...cur, ...patch };
  writeDevice(next);
  return next;
}

export function deviceInfo(): string {
  if (typeof navigator === "undefined") return "Captive portal";
  return navigator.userAgent.slice(0, 80);
}

const SITE_KEY = "telnet.site";

/** The site/town slug from the router's portal link (?site=slug), remembered on this device. */
export function readSite(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("site");
    if (fromUrl) {
      localStorage.setItem(SITE_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(SITE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Forget a remembered site (its link went stale or the site was switched off). */
export function clearSite(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SITE_KEY);
  } catch {
    /* storage unavailable */
  }
}
