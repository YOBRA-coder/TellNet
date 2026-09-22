import { asBool, asNumber, iso } from "@/lib/utils";
import type {
  Customer,
  CustomerPackage,
  Isp,
  LiveUser,
  MikroTik,
  NetworkEvent,
  Package,
  Payment,
  Settings,
} from "@/lib/types";

export type SqlRow = Record<string, unknown>;

export function mapPackage(row: SqlRow): Package {
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
  };
}

export function mapSettings(row: SqlRow): Settings {
  return {
    id: String(row.id),
    hotspotName: String(row.hotspot_name),
    currency: String(row.currency ?? "KSh"),
    welcomeMessage: String(row.welcome_message ?? "Welcome to Wi-Fi"),
    demoMode: false,
    forceActivationFailure: asBool(row.force_activation_failure),
    mpesaShortcode: row.mpesa_shortcode ? String(row.mpesa_shortcode) : null,
    mpesaEnv: String(row.mpesa_env ?? "sandbox"),
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
      status === "EXPIRED" || status === "REVOKED" || status === "ACTIVE"
        ? status
        : "ACTIVE",
    activationStatus:
      activation === "ACTIVATED" ||
      activation === "ACTIVATION_FAILED" ||
      activation === "EXPIRED" ||
      activation === "NOT_ACTIVATED"
        ? activation
        : "NOT_ACTIVATED",
    mikrotikUsername: row.mikrotik_username
      ? String(row.mikrotik_username)
      : null,
    boundDeviceToken: row.bound_device_token
      ? String(row.bound_device_token)
      : null,
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
    name: String(row.name),
    host: String(row.host),
    apiUser: String(row.api_user),
    hotspotName: String(row.hotspot_name ?? "hotspot1"),
    apiMode: row.api_mode === "api6" ? "api6" : "rest",
    apiPort: row.api_port != null ? Number(row.api_port) : null,
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
  };
}
