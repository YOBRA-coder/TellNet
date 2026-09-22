import { o as __toESM } from "../_runtime.mjs";
import { n as deviceInfo } from "./device-CVNggkwc.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { C as useNavigate, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { c as recoverPackage, p as HOTSPOT_FALLBACK } from "./router-B-2WsXvM.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/recover-Ci9JtBxH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RecoverPage() {
	const navigate = useNavigate();
	const { device, ready, update } = useDevice();
	const [tx, setTx] = (0, import_react.useState)("");
	const [message, setMessage] = (0, import_react.useState)(null);
	const [tone, setTone] = (0, import_react.useState)("ok");
	const mutate = useMutation({
		mutationFn: async (transactionId) => {
			if (!device) throw new Error("Device not ready");
			return recoverPackage({ data: {
				transactionId,
				token: device.token,
				phone: device.phone ?? void 0,
				deviceInfo: deviceInfo()
			} });
		},
		onSuccess: (res) => {
			if (!res.ok) {
				setTone(res.code === "expired" ? "warn" : "danger");
				setMessage(res.error);
				if (res.code === "expired") navigate({ to: "/portal/expired" });
				return;
			}
			setTone("ok");
			setMessage(res.message);
			if (res.payment?.customerId) update({
				customerId: res.payment.customerId,
				phone: res.payment.phone
			});
			if (res.activation && res.activation.ok) navigate({ to: "/portal/connect" });
		},
		onError: () => {
			setTone("danger");
			setMessage("Could not recover this package. Please try again.");
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: HOTSPOT_FALLBACK,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.2em] text-subtle",
				children: "Already paid?"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-3xl font-semibold tracking-tight",
				children: "Recover my package"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Enter the M-Pesa transaction ID from your SMS. We verify it against the ledger — never from the number you type alone."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-6 space-y-4",
				onSubmit: (e) => {
					e.preventDefault();
					setMessage(null);
					mutate.mutate(tx);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "tx",
							children: "M-Pesa transaction ID"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "tx",
							placeholder: "QGH7XXXXXX",
							value: tx,
							onChange: (e) => setTx(e.target.value.toUpperCase()),
							className: "h-12 font-mono text-base tracking-wide"
						})]
					}),
					message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: tone === "ok" ? "text-sm text-ok" : tone === "warn" ? "text-sm text-warn" : "text-sm text-danger",
						children: message
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "xl",
						className: "w-full",
						disabled: !ready || tx.length < 6 || mutate.isPending,
						children: mutate.isPending ? "Checking…" : "Recover my package"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal",
				className: "mt-6 text-center text-sm text-muted hover:text-fg",
				children: "Back to packages"
			})
		]
	});
}
//#endregion
export { RecoverPage as component };
