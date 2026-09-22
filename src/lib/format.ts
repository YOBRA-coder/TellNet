import { formatDistanceToNowStrict, format as formatDate } from "date-fns";

export function formatKes(amount: number, currency = "KES"): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function formatSpeed(kbps: number): string {
  if (kbps >= 1024 && kbps % 1024 === 0) return `${kbps / 1024} Mbps`;
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} MIN`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "24 HOURS" : `${days} DAYS`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 HOUR" : `${hours} HOURS`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRemaining(expiryIso: string, now = Date.now()): string {
  const ms = new Date(expiryIso).getTime() - now;
  if (ms <= 0) return "Expired";
  const totalMins = Math.round(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}

export function fromNow(isoStr: string): string {
  try {
    return formatDistanceToNowStrict(new Date(isoStr), { addSuffix: true });
  } catch {
    return isoStr;
  }
}

export function formatStamp(isoStr: string): string {
  try {
    return formatDate(new Date(isoStr), "dd MMM yyyy · HH:mm");
  } catch {
    return isoStr;
  }
}

export function formatTime(isoStr: string): string {
  try {
    return formatDate(new Date(isoStr), "HH:mm");
  } catch {
    return isoStr;
  }
}

export function mpesaReceipt(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "QGH";
  for (let i = 0; i < 7; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
