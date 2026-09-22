export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type ActivationStatus =
  | "NOT_ACTIVATED"
  | "ACTIVATED"
  | "ACTIVATION_FAILED"
  | "EXPIRED";
export type PackageStatus = "ACTIVE" | "INACTIVE";
export type CustomerStatus = "ACTIVE" | "BLOCKED";
export type CustomerPackageStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type SessionStatus = "ACTIVE" | "DISCONNECTED" | "EXPIRED";
export type IspStatus = "ONLINE" | "OFFLINE" | "DEGRADED";

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
};

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
};

export type RouterProbe = {
  ok: boolean;
  identity: string | null;
  version: string | null;
  boardName: string | null;
  uptime: string | null;
  cpuLoad: number | null;
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
