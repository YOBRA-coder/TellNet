/** Shared (browser + server) description of the supported network hardware. */
export const HARDWARE_TYPES = ["mikrotik", "omada", "ruijie"] as const;
export type HardwareType = (typeof HARDWARE_TYPES)[number];

export const HARDWARE_LABELS: Record<HardwareType, string> = {
  mikrotik: "MikroTik",
  omada: "TP-Link Omada",
  ruijie: "Ruijie / Reyee",
};

export function asHardwareType(v: unknown): HardwareType {
  return v === "omada" || v === "ruijie" ? v : "mikrotik";
}

/** Extra, vendor-specific settings kept in mikrotiks.hw_config (JSON). */
export type HwConfig = {
  /** Omada: controller ID (auto-discovered when empty). */
  omadacId?: string;
  /** Omada: site name as shown in the controller (used when the portal redirect omits it). */
  omadaSite?: string;
  /** Omada: unit of the `time` field of the authorize call. TP-Link's sample calls it milliseconds. */
  omadaTimeUnit?: "ms" | "us";
  /** Ruijie: gateway id (gw_id) expected from the gateway; empty = accept any. */
  ruijieGwId?: string;
};

export function parseHwConfig(raw: unknown): HwConfig {
  if (!raw) return {};
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" ? (v as HwConfig) : {};
  } catch {
    return {};
  }
}
