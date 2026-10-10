export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type ActivationStatus =
  | "NOT_ACTIVATED"
  | "ACTIVATED"
  | "ACTIVATION_FAILED"
  | "EXPIRED"
  | "QUEUED";
export type PackageStatus = "ACTIVE" | "INACTIVE";
export type CustomerStatus = "ACTIVE" | "BLOCKED";
export type CustomerPackageStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "QUEUED";
export type SessionStatus = "ACTIVE" | "DISCONNECTED" | "EXPIRED";
export type IspStatus = "ONLINE" | "OFFLINE" | "DEGRADED";

export type SiteStatus = "ACTIVE" | "INACTIVE";

export type Site = {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  notes: string | null;
};

export type PackageBadge = "MOST_POPULAR" | "BEST_VALUE";
export type PackageCategory = "STANDARD" | "STUDENT";

export type Isp = {
  id: string;
  name: string;
  type: string;
  interfaceName: string | null;
  status: IspStatus;
  latencyMs: number | null;
  mikrotikId: string | null;
  totalKbps: number;
  perUserMaxKbps: number;
  maxUsers: number;
  siteId: string | null;
};

export type PackageDurationKind = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";

export type Package = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  downloadKbps: number;
  uploadKbps: number;
  dataLimitMb: number | null;
  status: PackageStatus;
  sortOrder: number;
  siteId: string | null;
  badge: PackageBadge | null;
  durationKind: PackageDurationKind;
  pointsCost: number | null;
  category: PackageCategory;
  /** How many devices can share a purchase of this package at once (1 or 2). */
  maxDevices: number;
};

export type Settings = {
  id: string;
  hotspotName: string;
  /** rest = ROS7 /rest; api6 = ROS6 binary API 8728 */
  apiMode: RouterOsMode;
  apiPort: number | null;
  currency: string;
  welcomeMessage: string;
  demoMode: boolean;
  forceActivationFailure: boolean;
  mpesaShortcode: string | null;
  mpesaEnv: string;
  /** paybill = CustomerPayBillOnline, till = CustomerBuyGoodsOnline */
  mpesaAccountType: "paybill" | "till";
  mpesaTillNumber: string | null;
  mpesaCallbackUrl: string | null;
  hasMpesaKey: boolean;
  hasMpesaSecret: boolean;
  hasMpesaPasskey: boolean;
  mikrotikHost: string | null;
  mikrotikUser: string | null;
  hasMikrotikPassword: boolean;
  mikrotikHotspot: string | null;
  defaultUploadKbps: number;
  ispTotalKbps: number;
  perUserMaxKbps: number;
  maxUsers: number;
  oneDevicePerPackage: boolean;
  maxDevicesPerPackage: number;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  supportMessage: string | null;
  loyaltyEnabled: boolean;
  loyaltyPointsPerKes: number;
  referralBonusPoints: number;
  /** Referral program — paid out in minutes, independent of loyaltyEnabled. */
  referralEnabled: boolean;
  referralBonusMinutes: number;
  welcomeBonusMinutes: number;
  referralMinPackagePrice: number;
  studentBlockedDomains: string;
  /** RADIUS (multi-AP). The shared secret itself is never sent to the browser. */
  capacityMode: "PER_ISP" | "GLOBAL";
  requireAccountMultiDevice: boolean;
  voucherAutoCleanDays: number;
  radiusEnabled: boolean;
  hasRadiusSecret: boolean;
  radiusAuthPort: number;
  radiusAcctPort: number;
  /** Address MikroTik routers use to reach this app's RADIUS listener. */
  radiusServerHost: string | null;
};

export type Customer = {
  id: string;
  phone: string;
  status: CustomerStatus;
  createdAt: string;
};

export type Payment = {
  id: string;
  customerId: string;
  packageId: string;
  packageName: string;
  mpesaTransactionId: string | null;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  phone: string;
  amount: number;
  status: PaymentStatus;
  activationStatus: ActivationStatus;
  resultDesc: string | null;
  transactionDate: string | null;
  createdAt: string;
};

export type CustomerPackage = {
  id: string;
  customerId: string;
  packageId: string;
  packageName: string;
  paymentId: string;
  startTime: string;
  expiryTime: string;
  speedLimitKbps: number;
  dataLimitMb: number | null;
  status: CustomerPackageStatus;
  activationStatus: ActivationStatus;
  mikrotikUsername: string | null;
  boundDeviceToken: string | null;
  boundDeviceCount: number;
  lastResumedAt: string | null;
};

export type LiveUser = {
  sessionId: string;
  customerId: string;
  phone: string;
  ipAddress: string | null;
  packageName: string;
  speedLimitKbps: number;
  sessionStart: string;
  expiryTime: string;
  bytesDown: number;
  bytesUp: number;
  status: SessionStatus;
  customerStatus: CustomerStatus;
};

export type RouterStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export type RouterOsMode = "rest" | "api6";

export type MikroTik = {
  id: string;
  /** mikrotik (default) | omada | ruijie */
  hardwareType: "mikrotik" | "omada" | "ruijie";
  /** Vendor extras (Omada ID/site/time unit, Ruijie gateway id). */
  hwConfig: { omadacId?: string; omadaSite?: string; omadaTimeUnit?: "ms" | "us"; ruijieGwId?: string };
  /** Omada/Ruijie: last time the gateway called our WiFiDog endpoints (Ruijie heartbeat). */
  hwSeenAt: string | null;
  /** Omada/Ruijie: client devices switched on right now through this site (0 for MikroTik). */
  hwActiveDevices: number;
  name: string;
  host: string;
  apiUser: string;
  hotspotName: string;
  ssl: boolean;
  insecureTls: boolean;
  isPrimary: boolean;
  status: RouterStatus;
  identity: string | null;
  version: string | null;
  boardName: string | null;
  uptime: string | null;
  cpuLoad: number | null;
  lastPingAt: string | null;
  lastError: string | null;
  hasPassword: boolean;
  interfaces: { name: string; type: string; running: boolean }[];
  camouflage: "IPHONE" | "ANDROID" | "PC" | null;
  camouflageInterface: string | null;
  camouflageMac: string | null;
  camouflageAppliedAt: string | null;
  createdAt: string;
  siteId: string | null;
  apiMode: RouterOsMode;
  apiPort: number | null;
  /** Add outage time back to running packages when the router returns. */
  pauseOnOutage: boolean;
  downSince: string | null;
  /** Opening hours: weekly windows per day (0 = Sunday), HH:MM in the business time zone. */
  hoursEnabled: boolean;
  hoursSchedule: Record<string, [string, string][]>;
  hoursAllow: string[];
  hoursPause: boolean;
  hoursMessage: string | null;
  hoursState: "OPEN" | "CLOSED";
  memTotal: number | null;
  memFree: number | null;
};

/** What the portal needs to know about the router's opening hours. */
export type PortalOperating = {
  routerId: string;
  enabled: boolean;
  open: boolean;
  nextChangeAt: string | null;
  opensAtLabel: string | null;
  closesAtLabel: string | null;
  allowKinds: ("HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY")[];
  pause: boolean;
  message: string | null;
};

export type RouterProbe = {
  ok: boolean;
  identity: string | null;
  version: string | null;
  boardName: string | null;
  uptime: string | null;
  cpuLoad: number | null;
  /** bytes; null when the router didn't report it */
  memTotal?: number | null;
  memFree?: number | null;
  hotspotServers: string[];
  interfaces: { name: string; type: string; running: boolean }[];
  error: string | null;
};

export type NetworkEvent = {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
};

export type PortalIdentity = {
  token: string;
  phone: string | null;
  customerId: string | null;
};

export type ActiveAccess = {
  customer: Customer;
  pack: CustomerPackage;
  connected: boolean;
  otherDevice: boolean;
} | null;

// ---- Network map ---------------------------------------------------------

export type HealthState = "ONLINE" | "WARNING" | "OFFLINE" | "UNKNOWN";

export type LivePort = {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment: string | null;
  ip: string | null;
  rxBytes: number;
  txBytes: number;
  /** bits per second since the previous refresh (null on the first sample) */
  rxBps: number | null;
  txBps: number | null;
  /** hotspot clients seen behind this port (bridge host table) */
  clients: number | null;
};

export type LiveNeighbor = {
  name: string;
  ip: string | null;
  mac: string | null;
  port: string | null;
  model: string | null;
};

export type LiveRadio = { name: string; clients: number; signalDbm: number | null };

export type LiveSnapshot = {
  at: string;
  error: string | null;
  cpuLoad: number | null;
  memTotal: number | null;
  memFree: number | null;
  uptime: string | null;
  activeUsers: number | null;
  rxBps: number | null;
  txBps: number | null;
  ports: LivePort[];
  neighbors: LiveNeighbor[];
  radios: LiveRadio[];
};

export type AccessPointRow = {
  id: string;
  /** false = the router's own built-in radio (read-only, auto-detected) */
  manual: boolean;
  name: string;
  /** number/tag physically marked on the device, e.g. "3" or "A-07" */
  label: string | null;
  ip: string | null;
  mac: string | null;
  model: string | null;
  port: string | null;
  notes: string | null;
  status: HealthState;
  latencyMs: number | null;
  clients: number | null;
  signalDbm: number | null;
  checkedAt: string | null;
  /** M-Pesa revenue attributed to this AP over the chosen period; null = no router port set */
  revenue: number | null;
  paidCustomers: number | null;
  /** switched on and reachable, but no paid customers over the chosen period */
  noIncome: boolean;
};

export type MapRouter = {
  id: string;
  name: string;
  host: string;
  /** mikrotik | omada | ruijie */
  hardwareType: "mikrotik" | "omada" | "ruijie";
  /** Omada/Ruijie: devices switched on through this site now (MikroTik uses live.activeUsers). */
  hwActiveDevices: number;
  /** Omada/Ruijie: last contact from the gateway (Ruijie heartbeat). */
  hwSeenAt: string | null;
  isPrimary: boolean;
  siteId: string;
  siteName: string;
  state: HealthState;
  stateReason: string | null;
  /** scheduled opening hours */
  hours: { enabled: boolean; open: boolean; opensAtLabel: string | null; closesAtLabel: string | null };
  boardName: string | null;
  version: string | null;
  identity: string | null;
  live: LiveSnapshot | null;
  isps: { id: string; name: string; type: string; status: string; interfaceName: string | null }[];
  aps: AccessPointRow[];
};

export type MapSite = {
  site: Site;
  state: HealthState;
  routers: MapRouter[];
};

export type NetworkMapData = {
  generatedAt: string;
  sites: MapSite[];
  allSites: Site[];
  totals: {
    routers: { online: number; warning: number; offline: number };
    aps: { online: number; warning: number; offline: number; unknown: number; noIncome: number };
    activeUsers: number;
    rxBps: number;
    txBps: number;
  };
};
