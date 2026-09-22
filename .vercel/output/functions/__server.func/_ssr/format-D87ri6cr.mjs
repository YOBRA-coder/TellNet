import { t as format } from "../_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/format-D87ri6cr.js
function formatKes(amount, currency = "KES") {
	return `${currency} ${Math.round(amount).toLocaleString("en-KE")}`;
}
function formatSpeed(kbps) {
	if (kbps >= 1024 && kbps % 1024 === 0) return `${kbps / 1024} Mbps`;
	if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
	return `${kbps} Kbps`;
}
function formatDuration(minutes) {
	if (minutes < 60) return `${minutes} MIN`;
	if (minutes % 1440 === 0) {
		const days = minutes / 1440;
		return days === 1 ? "24 HOURS" : `${days} DAYS`;
	}
	if (minutes % 60 === 0) {
		const hours = minutes / 60;
		return hours === 1 ? "1 HOUR" : `${hours} HOURS`;
	}
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function formatBytes(bytes) {
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
	return `${(bytes / 1073741824).toFixed(2)} GB`;
}
function formatRemaining(expiryIso, now = Date.now()) {
	const ms = new Date(expiryIso).getTime() - now;
	if (ms <= 0) return "Expired";
	const totalMins = Math.round(ms / 6e4);
	const days = Math.floor(totalMins / 1440);
	const hours = Math.floor(totalMins % 1440 / 60);
	const mins = totalMins % 60;
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${mins}m`;
	return `${Math.max(mins, 1)}m`;
}
function formatStamp(isoStr) {
	try {
		return format(new Date(isoStr), "dd MMM yyyy · HH:mm");
	} catch {
		return isoStr;
	}
}
//#endregion
export { formatSpeed as a, formatRemaining as i, formatDuration as n, formatStamp as o, formatKes as r, formatBytes as t };
