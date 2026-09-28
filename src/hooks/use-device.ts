import { useCallback, useState } from "react";
import {
  type DeviceIdentity,
  patchDevice,
  readDevice,
} from "@/lib/device";

export function useDevice() {
  const [device, setDevice] = useState<DeviceIdentity | null>(() =>
    typeof window === "undefined" ? null : readDevice(),
  );

  const update = useCallback((patch: Partial<DeviceIdentity>) => {
    setDevice(patchDevice(patch));
  }, []);

  return { device, update, ready: device !== null };
}