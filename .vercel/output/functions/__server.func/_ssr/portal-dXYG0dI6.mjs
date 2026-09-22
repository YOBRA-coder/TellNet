import { o as __toESM } from "../_runtime.mjs";
import { t as PACKAGE_IN_USE_MESSAGE } from "./device-CVNggkwc.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as getRouteApi, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { s as getPortalBootstrap } from "./router-B-2WsXvM.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
import { t as PackageCard } from "./package-card-DCWQSKkh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portal-dXYG0dI6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var portalRoute = getRouteApi("/portal");
function PortalHome() {
	const catalog = portalRoute.useLoaderData();
	const { device, ready, update } = useDevice();
	const q = useQuery({
		queryKey: ["portal", device?.token],
		enabled: ready && Boolean(device),
		queryFn: () => getPortalBootstrap({ data: {
			token: device.token,
			phone: device?.phone ?? void 0,
			customerId: device?.customerId ?? void 0
		} })
	});
	(0, import_react.useEffect)(() => {
		if (q.data?.access?.customer) update({
			customerId: q.data.access.customer.id,
			phone: q.data.access.customer.phone
		});
	}, [q.data, update]);
	const settings = q.data?.settings ?? catalog.settings;
	const packages = q.data?.packages ?? catalog.packages;
	const internetUp = q.data?.internetUp ?? catalog.internetUp;
	const access = q.data?.access;
	const hotspot = settings.hotspotName ?? "TelNet Wi-Fi";
	if (access && access.pack.status === "ACTIVE") {
		if (access.otherDevice) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
			hotspotName: hotspot,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-[0.2em] text-danger",
					children: "Device limit"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-4xl font-semibold tracking-tight",
					children: PACKAGE_IN_USE_MESSAGE
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 text-sm leading-relaxed text-muted",
					children: [access.pack.packageName, " is already connected on another phone. Ask the operator to release the device if this is your package."]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "xl",
					className: "mt-6 w-full",
					variant: "secondary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/packages",
						children: "Buy a new package"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/recover",
					className: "mt-4 text-center text-sm text-muted hover:text-fg",
					children: "Already paid?"
				})
			]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
			hotspotName: hotspot,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-[0.2em] text-accent",
					children: "Welcome back"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-4xl font-semibold tracking-tight",
					children: "Your package is still active."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 rounded-2xl border border-border bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Package"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-display text-2xl font-semibold",
							children: access.pack.packageName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm text-muted",
							children: "Expires"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-mono text-lg tabular-nums",
							children: new Date(access.pack.expiryTime).toLocaleString()
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "xl",
					className: "mt-6 w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/connect",
						children: "Connect"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/account",
					className: "mt-4 text-center text-sm text-muted hover:text-fg",
					children: "View account"
				})
			]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: hotspot,
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 pb-2 text-center text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/recover",
				className: "text-muted hover:text-fg",
				children: "Already paid? Recover my package"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/connect",
				className: "text-subtle hover:text-muted",
				children: "Returning customer — connect"
			})]
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mx-auto mb-6 size-20",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "radar-ring" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full border border-accent/30 bg-surface",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-full bg-accent" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-center text-xs font-medium uppercase tracking-[0.22em] text-accent",
				children: hotspot
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 text-center font-display text-4xl font-semibold tracking-tight",
				children: settings.welcomeMessage ?? "Welcome to Wi-Fi"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-center text-sm text-muted",
				children: "Choose a package. Pay with M-Pesa. You are online the moment the payment is confirmed."
			}),
			!internetUp && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 rounded-lg border border-warn/20 bg-warn/10 px-3 py-2 text-sm text-warn",
				children: "Internet connection is currently unavailable. Please try again later."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 flex flex-col gap-3",
				children: packages.map((pkg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageCard, {
					pkg,
					currency: settings.currency
				}, pkg.id))
			})
		]
	});
}
//#endregion
export { PortalHome as component };
