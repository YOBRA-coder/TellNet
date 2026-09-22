//#region node_modules/.nitro/vite/services/ssr/assets/phone-DB_r9zkq.js
/** Kenyan MSISDN helpers. Canonical form is 2547XXXXXXXX / 2541XXXXXXXX. */
var KENYA_MOBILE = /^(?:254|\+254|0)?([17]\d{8})$/;
function normalizeKenyanPhone(input) {
	const match = input.replace(/[^\d+]/g, "").trim().match(KENYA_MOBILE);
	if (!match) return null;
	return `254${match[1]}`;
}
function formatPhoneDisplay(phone) {
	const n = normalizeKenyanPhone(phone) ?? phone.replace(/\D/g, "");
	if (n.startsWith("254") && n.length === 12) return `0${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
	return phone;
}
function isKenyanPhone(input) {
	return normalizeKenyanPhone(input) !== null;
}
//#endregion
export { isKenyanPhone as n, normalizeKenyanPhone as r, formatPhoneDisplay as t };
