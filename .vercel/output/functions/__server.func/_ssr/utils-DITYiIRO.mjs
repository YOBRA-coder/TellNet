import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-DITYiIRO.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function nid(prefix) {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
function iso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string" && value) {
		const d = new Date(value);
		if (!Number.isNaN(d.getTime())) return d.toISOString();
	}
	return (/* @__PURE__ */ new Date()).toISOString();
}
function asNumber(value, fallback = 0) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	if (typeof value === "bigint") return Number(value);
	return fallback;
}
function asBool(value) {
	return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}
//#endregion
export { nid as a, iso as i, asNumber as n, cn as r, asBool as t };
