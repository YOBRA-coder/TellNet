import { useCallback, useSyncExternalStore } from "react";

const KEY = "telnet.adminSite";
const EVT = "telnet-admin-site";
export const ALL_SITES = "ALL";

function read(): string {
  if (typeof window === "undefined") return ALL_SITES;
  try {
    return localStorage.getItem(KEY) || ALL_SITES;
  } catch {
    return ALL_SITES;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * The town/site the admin is currently looking at, shared by the Network map,
 * Network, Dashboard and Reports so switching once switches everywhere.
 */
export function useAdminSite(): [string, (id: string) => void] {
  const site = useSyncExternalStore(subscribe, read, () => ALL_SITES);
  const set = useCallback((id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private mode: still works for this render */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [site, set];
}
