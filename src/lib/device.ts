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
