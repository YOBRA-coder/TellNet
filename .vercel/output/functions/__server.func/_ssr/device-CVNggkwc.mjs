//#region node_modules/.nitro/vite/services/ssr/assets/device-CVNggkwc.js
var KEY = "telnet.device";
var PACKAGE_IN_USE_MESSAGE = "This package is already in use on another device.";
function randomToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return `tok_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function readDevice() {
	if (typeof window === "undefined") return {
		token: "tok_ssr",
		phone: null,
		customerId: null
	};
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed.token && parsed.token.length >= 8) return parsed;
		}
	} catch {}
	const fresh = {
		token: randomToken(),
		phone: null,
		customerId: null
	};
	writeDevice(fresh);
	return fresh;
}
function writeDevice(next) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {}
}
function patchDevice(patch) {
	const next = {
		...readDevice(),
		...patch
	};
	writeDevice(next);
	return next;
}
function deviceInfo() {
	if (typeof navigator === "undefined") return "Captive portal";
	return navigator.userAgent.slice(0, 80);
}
//#endregion
export { readDevice as i, deviceInfo as n, patchDevice as r, PACKAGE_IN_USE_MESSAGE as t };
