import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-iIelHC8f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-DGiBbKPl.js
var import_jsx_runtime = require_jsx_runtime();
var paymentTone = {
	SUCCESS: "ok",
	PENDING: "warn",
	FAILED: "danger",
	CANCELLED: "neutral"
};
var activationTone = {
	ACTIVATED: "ok",
	NOT_ACTIVATED: "neutral",
	ACTIVATION_FAILED: "danger",
	EXPIRED: "neutral"
};
function PaymentBadge({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: paymentTone[status],
		children: status.replace("_", " ")
	});
}
function ActivationBadge({ status }) {
	const label = status === "ACTIVATION_FAILED" ? "Awaiting activation" : status.replaceAll("_", " ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: activationTone[status],
		children: label
	});
}
function SessionBadge({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: status === "ACTIVE" ? "ok" : status === "EXPIRED" ? "neutral" : "warn",
		children: status
	});
}
//#endregion
export { PaymentBadge as n, SessionBadge as r, ActivationBadge as t };
