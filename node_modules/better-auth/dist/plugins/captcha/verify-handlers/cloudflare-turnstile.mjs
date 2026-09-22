import { middlewareResponse } from "../../../utils/middleware-response.mjs";
import { CAPTCHA_VERIFY_TIMEOUT_MS } from "../constants.mjs";
import { EXTERNAL_ERROR_CODES, INTERNAL_ERROR_CODES } from "../error-codes.mjs";
import { betterFetch } from "@better-fetch/fetch";
//#region src/plugins/captcha/verify-handlers/cloudflare-turnstile.ts
const cloudflareTurnstile = async ({ siteVerifyURL, captchaResponse, secretKey, logger, remoteIP, expectedAction, allowedHostnames }) => {
	const response = await betterFetch(siteVerifyURL, {
		method: "POST",
		timeout: CAPTCHA_VERIFY_TIMEOUT_MS,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			secret: secretKey,
			response: captchaResponse,
			...remoteIP && { remoteip: remoteIP }
		})
	});
	if (!response.data || response.error) throw new Error(INTERNAL_ERROR_CODES.SERVICE_UNAVAILABLE.message);
	const verificationFailed = (details) => {
		logger.warn("Cloudflare Turnstile verification failed", {
			provider: "cloudflare-turnstile",
			...details
		});
		return middlewareResponse({
			message: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED.message,
			code: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED.code,
			status: 403
		});
	};
	if (!response.data.success) return verificationFailed({
		reason: "siteverify_rejected",
		errorCodes: response.data["error-codes"] ?? [],
		...response.data.hostname && { hostname: response.data.hostname },
		...response.data.action && { action: response.data.action }
	});
	if (expectedAction && response.data.action !== expectedAction) return verificationFailed({
		reason: "action_mismatch",
		expectedAction,
		actualAction: response.data.action
	});
	if (allowedHostnames && allowedHostnames.length > 0 && !(response.data.hostname && allowedHostnames.includes(response.data.hostname))) return verificationFailed({
		reason: "hostname_mismatch",
		allowedHostnames,
		actualHostname: response.data.hostname
	});
};
//#endregion
export { cloudflareTurnstile };
