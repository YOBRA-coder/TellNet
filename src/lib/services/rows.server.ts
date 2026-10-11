import { asBool, asNumber, iso } from "@/lib/utils";
import { asHardwareType, parseHwConfig } from "@/lib/hardware";
import type {
  Customer,
  CustomerPackage,
  Isp,
  LiveUser,
  MikroTik,
  NetworkEvent,
  Package,
  PackageBadge,
  PackageDurationKind,
  Payment,
  Settings,
  Site,
} from "@/lib/types";

export type SqlRow = Record<string, unknown>;

function durationKindOf(row: SqlRow): PackageDurationKind {
  const raw = row.duration_kind ? String(row.duration_kind) : "";
  if (raw === "HOURLY" || raw === "DAILY" || raw === "WEEKLY" || raw === "MONTHLY") {
    return raw;
  }
  const mins = asNumber(row.duration_minutes);
  if (mins <= 90) return "HOURLY";
  if (mins <= 1440) return "DAILY";
  if (mins <= 10080) return "WEEKLY";
  return "MONTHLY";
}

export function mapPackage(row: SqlRow): Package {
  const badge = row.badge ? String(row.badge) : null;
  return {
    id: String(row.id),
    name: String(row.name),
    price: asNumber(row.price),
    durationMinutes: asNumber(row.duration_minutes),
    downloadKbps: asNumber(row.download_kbps),
    uploadKbps: asNumber(row.upload_kbps),
    dataLimitMb: row.data_limit_mb == null ? null : asNumber(row.data_limit_mb),
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    sortOrder: asNumber(row.sort_order),
    siteId: row.site_id ? String(row.site_id) : null,
    badge:
      badge === "MOST_POPULAR" || badge === "BEST_VALUE"
        ? (badge as PackageBadge)
        : null,
    durationKind: durationKindOf(row),
    pointsCost: row.points_cost == null ? null : asNumber(row.points_cost),
    category: row.category === "STUDENT" ? "STUDENT" : "STANDARD",
    maxDevices: asNumber(row.max_devices, 1) >= 2 ? 2 : 1,
  };
}

export function mapSite(row: SqlRow): Site {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    notes: row.notes ? String(row.notes) : null,
  };
}

export function mapSettings(row: SqlRow): Settings {
  return {
    id: String(row.id),
    hotspotName: String(row.hotspot_name),
    apiMode: "rest",
    apiPort: null,
    currency: String(row.currency ?? "KSh"),
    welcomeMessage: String(row.welcome_message ?? "Welcome to Wi-Fi"),
    demoMode: false,
    forceActivationFailure: asBool(row.force_activation_failure),
    mpesaShortcode: row.mpesa_shortcode ? String(row.mpesa_shortcode) : null,
    mpesaEnv: String(row.mpesa_env ?? "sandbox"),
    mpesaAccountType: row.mpesa_account_type === "till" ? "till" : "paybill",
    mpesaTillNumber: row.mpesa_till_number ? String(row.mpesa_till_number) : null,
    mpesaCallbackUrl: row.mpesa_callback_url
      ? String(row.mpesa_callback_url)
      : null,
    hasMpesaKey: Boolean(row.mpesa_consumer_key),
    hasMpesaSecret: Boolean(row.mpesa_consumer_secret),
    hasMpesaPasskey: Boolean(row.mpesa_passkey),
    mikrotikHost: row.mikrotik_host ? String(row.mikrotik_host) : null,
    mikrotikUser: row.mikrotik_user ? String(row.mikrotik_user) : null,
    hasMikrotikPassword: Boolean(row.mikrotik_password),
    mikrotikHotspot: row.mikrotik_hotspot ? String(row.mikrotik_hotspot) : null,
    defaultUploadKbps: asNumber(row.default_upload_kbps, 1024),
    ispTotalKbps: asNumber(row.isp_total_kbps, 30720),
    perUserMaxKbps: asNumber(row.per_user_max_kbps, 5120),
    maxUsers: asNumber(row.max_users, 25),
    oneDevicePerPackage:
      row.one_device_per_package == null
        ? true
        : asBool(row.one_device_per_package),
    maxDevicesPerPackage: asNumber(row.max_devices_per_package, 1),
    maintenanceMode: asBool(row.maintenance_mode),
    maintenanceMessage: row.maintenance_message ? String(row.maintenance_message) : null,
    supportPhone: row.support_phone ? String(row.support_phone) : null,
    supportWhatsapp: row.support_whatsapp ? String(row.support_whatsapp) : null,
    supportMessage: row.support_message ? String(row.support_message) : null,
    loyaltyEnabled: asBool(row.loyalty_enabled),
    loyaltyPointsPerKes: asNumber(row.loyalty_points_per_kes, 1),
    referralBonusPoints: asNumber(row.referral_bonus_points, 50),
    referralEnabled:
      row.referral_enabled == null ? true : asBool(row.referral_enabled),
    referralBonusMinutes: asNumber(row.referral_bonus_minutes, 30),
    welcomeBonusMinutes: asNumber(row.welcome_bonus_minutes, 10),
    referralMinPackagePrice: asNumber(row.referral_min_package_price, 20),
    studentBlockedDomains: String(
      row.student_blocked_domains ?? "facebook.com,instagram.com,tiktok.com",
    ),
    capacityMode: row.capacity_mode === "GLOBAL" ? "GLOBAL" : "PER_ISP",
    requireAccountMultiDevice: row.require_account_multi_device == null ? true : asBool(row.require_account_multi_device),
    voucherAutoCleanDays: asNumber(row.voucher_auto_clean_days, 0),
    radiusEnabled: asBool(row.radius_enabled),
    hasRadiusSecret: Boolean(row.radius_secret),
    radiusAuthPort: asNumber(row.radius_auth_port, 1812),
    radiusAcctPort: asNumber(row.radius_acct_port, 1813),
    radiusServerHost: row.radius_server_host ? String(row.radius_server_host) : null,
    smsEnabled: asBool(row.sms_enabled),
    hasSmsKey: Boolean(row.sms_api_key),
    smsDeviceId: row.sms_device_id ? String(row.sms_device_id) : null,
    resetMethod: row.reset_method === "BOTH" || row.reset_method === "OTP" ? row.reset_method : "RECEIPT",
  };
}

export function mapCustomer(row: SqlRow): Customer {
  return {
    id: String(row.id),
    phone: String(row.phone),
    status: row.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
    createdAt: iso(row.created_at),
  };
}

export function mapPayment(row: SqlRow): Payment {
  const status = String(row.status);
  const activation = String(row.activation_status);
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    packageId: String(row.package_id),
    packageName: String(row.package_name ?? ""),
    mpesaTransactionId: row.mpesa_transaction_id
      ? String(row.mpesa_transaction_id)
      : null,
    checkoutRequestId: row.checkout_request_id
      ? String(row.checkout_request_id)
      : null,
    merchantRequestId: row.merchant_request_id
      ? String(row.merchant_request_id)
      : null,
    phone: String(row.phone),
    amount: asNumber(row.amount),
    status:
      status === "SUCCESS" ||
      status === "FAILED" ||
      status === "CANCELLED" ||
      status === "PENDING"
        ? status
        : "PENDING",
    activationStatus:
      activation === "ACTIVATED" ||
      activation === "ACTIVATION_FAILED" ||
      activation === "EXPIRED" ||
      activation === "QUEUED" ||
      activation === "NOT_ACTIVATED"
        ? activation
        : "NOT_ACTIVATED",
    resultDesc: row.result_desc ? String(row.result_desc) : null,
    transactionDate: row.transaction_date ? iso(row.transaction_date) : null,
    createdAt: iso(row.created_at),
  };
}

export function mapCustomerPackage(row: SqlRow): CustomerPackage {
  const status = String(row.status);
  const activation = String(row.activation_status);
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    packageId: String(row.package_id),
    packageName: String(row.package_name ?? ""),
    paymentId: String(row.payment_id),
    startTime: iso(row.start_time),
    expiryTime: iso(row.expiry_time),
    speedLimitKbps: asNumber(row.speed_limit_kbps),
    dataLimitMb: row.data_limit_mb == null ? null : asNumber(row.data_limit_mb),
    status:
      status === "EXPIRED" ||
      status === "REVOKED" ||
      status === "QUEUED" ||
      status === "ACTIVE"
        ? status
        : "ACTIVE",
    activationStatus:
      activation === "ACTIVATED" ||
      activation === "ACTIVATION_FAILED" ||
      activation === "EXPIRED" ||
      activation === "QUEUED" ||
      activation === "NOT_ACTIVATED"
        ? activation
        : "NOT_ACTIVATED",
    mikrotikUsername: row.mikrotik_username
      ? String(row.mikrotik_username)
      : null,
    boundDeviceToken: row.bound_device_token
      ? String(row.bound_device_token)
      : null,
    boundDeviceCount: asNumber(row.bound_device_count, row.bound_device_token ? 1 : 0),
    lastResumedAt: row.last_resumed_at ? iso(row.last_resumed_at) : null,
  };
}

export function mapLiveUser(row: SqlRow): LiveUser {
  const status = String(row.status);
  return {
    sessionId: String(row.session_id ?? row.id),
    customerId: String(row.customer_id),
    phone: String(row.phone),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    packageName: String(row.package_name ?? ""),
    speedLimitKbps: asNumber(row.speed_limit_kbps),
    sessionStart: iso(row.session_start),
    expiryTime: iso(row.expiry_time),
    bytesDown: asNumber(row.bytes_down),
    bytesUp: asNumber(row.bytes_up),
    status:
      status === "ACTIVE" || status === "DISCONNECTED" || status === "EXPIRED"
        ? status
        : "ACTIVE",
    customerStatus: row.customer_status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
    hardwareType: asHardwareType(row.hw_vendor),
    siteId: String(row.site_id ?? "site_default"),
    siteName: String(row.site_name ?? "Main site"),
    routerName: row.hw_router_name ? String(row.hw_router_name) : null,
    clientMac: row.hw_vendor && row.hw_client_mac ? String(row.hw_client_mac) : null,
    hasTraffic: !row.hw_vendor,
  };
}

export function mapIsp(row: SqlRow): Isp {
  const status = String(row.status);
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    interfaceName: row.interface_name ? String(row.interface_name) : null,
    status:
      status === "ONLINE" || status === "OFFLINE" || status === "DEGRADED"
        ? status
        : "ONLINE",
    latencyMs: row.latency_ms == null ? null : asNumber(row.latency_ms),
    mikrotikId: row.mikrotik_id ? String(row.mikrotik_id) : null,
    totalKbps: asNumber(row.total_kbps, 30720),
    perUserMaxKbps: asNumber(row.per_user_max_kbps, 5120),
    maxUsers: asNumber(row.max_users, 25),
    siteId: row.site_id ? String(row.site_id) : null,
    autoStatus: row.auto_status == null ? true : asBool(row.auto_status),
    statusCheckedAt: row.status_checked_at ? iso(row.status_checked_at) : null,
  };
}

export function mapEvent(row: SqlRow): NetworkEvent {
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    description: String(row.description),
    createdAt: iso(row.created_at),
  };
}

export function mapMikroTik(row: SqlRow): MikroTik {
  const status = String(row.status);
  let interfaces: MikroTik["interfaces"] = [];
  if (row.interfaces_json) {
    try {
      const parsed = JSON.parse(String(row.interfaces_json)) as MikroTik["interfaces"];
      if (Array.isArray(parsed)) interfaces = parsed;
    } catch {
      interfaces = [];
    }
  }
  return {
    id: String(row.id),
    hardwareType: asHardwareType(row.hardware_type),
    hwConfig: parseHwConfig(row.hw_config),
    hwSeenAt: row.hw_seen_at ? iso(row.hw_seen_at) : null,
    hwActiveDevices: 0,
    name: String(row.name),
    host: String(row.host),
    apiUser: String(row.api_user),
    hotspotName: String(row.hotspot_name ?? "hotspot1"),
    apiMode: row.api_mode === "api6" ? "api6" : "rest",
    apiPort: row.api_port != null ? Number(row.api_port) : null,
    pauseOnOutage: asBool(row.pause_on_outage),
    downSince: row.down_since ? iso(row.down_since) : null,
    hoursEnabled: asBool(row.hours_enabled),
    hoursSchedule: parseSchedule(row.hours_json ? String(row.hours_json) : null),
    hoursAllow: String(row.hours_allow ?? "WEEKLY,MONTHLY").split(",").map((x) => x.trim()).filter(Boolean),
    hoursPause: row.hours_pause == null ? true : asBool(row.hours_pause),
    hoursMessage: row.hours_message ? String(row.hours_message) : null,
    hoursState: row.hours_state === "CLOSED" ? "CLOSED" : "OPEN",
    memTotal: row.mem_total != null ? Number(row.mem_total) : null,
    memFree: row.mem_free != null ? Number(row.mem_free) : null,
    ssl: asBool(row.ssl),
    insecureTls: asBool(row.insecure_tls),
    isPrimary: asBool(row.is_primary),
    status:
      status === "ONLINE" || status === "OFFLINE" || status === "UNKNOWN"
        ? status
        : "UNKNOWN",
    identity: row.identity ? String(row.identity) : null,
    version: row.version ? String(row.version) : null,
    boardName: row.board_name ? String(row.board_name) : null,
    uptime: row.uptime ? String(row.uptime) : null,
    cpuLoad: row.cpu_load == null ? null : asNumber(row.cpu_load),
    lastPingAt: row.last_ping_at ? iso(row.last_ping_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    hasPassword: Boolean(row.api_password),
    interfaces,
    camouflage:
      row.camouflage === "IPHONE" ||
      row.camouflage === "ANDROID" ||
      row.camouflage === "PC"
        ? row.camouflage
        : null,
    camouflageInterface: row.camouflage_interface
      ? String(row.camouflage_interface)
      : null,
    camouflageMac: row.camouflage_mac ? String(row.camouflage_mac) : null,
    camouflageAppliedAt: row.camouflage_applied_at
      ? iso(row.camouflage_applied_at)
      : null,
    createdAt: iso(row.created_at),
    siteId: row.site_id ? String(row.site_id) : null,
  };
}

/** Same parser as hours.server (kept here so row mapping has no service imports). */
function parseSchedule(json: string | null): Record<string, [string, string][]> {
  const out: Record<string, [string, string][]> = {};
  let raw: Record<string, unknown> = {};
  try {
    raw = json ? JSON.parse(json) : {};
  } catch {
    raw = {};
  }
  for (let d = 0; d < 7; d++) {
    const list = Array.isArray(raw[String(d)]) ? (raw[String(d)] as unknown[]) : [];
    out[String(d)] = list
      .filter((w): w is string[] => Array.isArray(w) && /^\d{1,2}:\d{2}$/.test(String(w[0])) && /^\d{1,2}:\d{2}$/.test(String(w[1])))
      .map((w) => [String(w[0]), String(w[1])] as [string, string]);
  }
  return out;
}
