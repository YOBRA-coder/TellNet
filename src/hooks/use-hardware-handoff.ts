import { useEffect } from "react";
import { getHardwareHandoff } from "@/lib/fn/portal";

/**
 * Ruijie / Reyee: once the package is active the browser must visit the gateway's
 * auth URL to finish login. For MikroTik and Omada the server returns null and
 * nothing happens.
 */
export function useHardwareHandoff(active: boolean, token: string | undefined) {
  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    getHardwareHandoff({ data: { token } })
      .then((res) => {
        if (!cancelled && res.url) window.location.assign(res.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, token]);
}
