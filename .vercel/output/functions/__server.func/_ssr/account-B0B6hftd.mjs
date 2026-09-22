import { t as formatPhoneDisplay } from "./phone-DB_r9zkq.mjs";
import { t as PACKAGE_IN_USE_MESSAGE } from "./device-CVNggkwc.mjs";
import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { a as getAccount } from "./router-B-2WsXvM.mjs";
import { t as ActivationBadge } from "./status-badge-DGiBbKPl.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, i as formatRemaining, o as formatStamp } from "./format-D87ri6cr.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account-B0B6hftd.js
var import_jsx_runtime = require_jsx_runtime();
function AccountPage() {
	const { device, ready } = useDevice();
	const q = useQuery({
		queryKey: ["account", device?.token],
		enabled: ready && Boolean(device),
		queryFn: () => getAccount({ data: {
			token: device.token,
			phone: device?.phone ?? void 0,
			customerId: device?.customerId ?? void 0
		} })
	});
	const access = q.data?.access;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: q.data?.hotspotName ?? "TelNet Wi-Fi",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-semibold tracking-tight",
			children: "Your package"
		}), !access ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted",
			children: "No active package on this device."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			size: "lg",
			className: "mt-6 w-full",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/packages",
				children: "Buy a package"
			})
		})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-2xl",
							children: access.pack.packageName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivationBadge, { status: access.pack.activationStatus })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-5 grid grid-cols-2 gap-4 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-subtle",
								children: "Phone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "mt-1 tabular-nums",
								children: formatPhoneDisplay(access.customer.phone)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-subtle",
								children: "Speed"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "mt-1",
								children: formatSpeed(access.pack.speedLimitKbps)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-subtle",
								children: "Started"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "mt-1",
								children: formatStamp(access.pack.startTime)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-subtle",
								children: "Expires"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "mt-1",
								children: formatStamp(access.pack.expiryTime)
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-5 font-mono text-lg tabular-nums text-accent",
						children: [formatRemaining(access.pack.expiryTime), " remaining"]
					})
				]
			}), access.otherDevice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-danger",
				children: PACKAGE_IN_USE_MESSAGE
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				size: "lg",
				className: "w-full",
				variant: "secondary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/packages",
					children: "Buy a new package"
				})
			})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				size: "lg",
				className: "w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/connect",
					children: access.connected ? "You are connected" : "Connect"
				})
			})]
		})]
	});
}
//#endregion
export { AccountPage as component };
