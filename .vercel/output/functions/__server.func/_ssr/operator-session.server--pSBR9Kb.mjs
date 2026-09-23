import { r as __exportAll } from "../_runtime.mjs";
import { l as setCookie$1, o as deleteCookie$1, s as getCookie, u as __exportAll$1 } from "./ssr.mjs";
import { q as jwtVerify } from "../_libs/@better-auth/core+[...].mjs";
import { r as SignJWT } from "../_libs/jose.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/operator-session.server--pSBR9Kb.js
var operator_session_server__pSBR9Kb_exports = /* @__PURE__ */ __exportAll({
	n: () => hasOperatorSession,
	r: () => operator_session_server_exports,
	t: () => createOperatorSession
});
var operator_session_server_exports = /* @__PURE__ */ __exportAll$1({
	clearOperatorSession: () => clearOperatorSession,
	createOperatorSession: () => createOperatorSession,
	hasOperatorSession: () => hasOperatorSession
});
var COOKIE_NAME = "__telnet-operator";
var SESSION_DURATION_SECONDS = 28800;
function getSecret() {
	const secret = process.env.OPERATOR_SESSION_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
	if (!secret) throw new Error("OPERATOR_SESSION_SECRET or BETTER_AUTH_SECRET must be configured");
	return new TextEncoder().encode(secret);
}
async function createOperatorSession() {
	const token = await new SignJWT({ role: "operator" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_DURATION_SECONDS}s`).setSubject("operator").sign(getSecret());
	setCookie$1(COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_SECONDS
	});
}
async function hasOperatorSession() {
	const token = getCookie(COOKIE_NAME);
	if (!token) return false;
	try {
		const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
		return payload.sub === "operator" && payload.role === "operator";
	} catch {
		return false;
	}
}
function clearOperatorSession() {
	deleteCookie$1(COOKIE_NAME, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: 0
	});
}
//#endregion
export { hasOperatorSession as n, operator_session_server__pSBR9Kb_exports as r, createOperatorSession as t };
