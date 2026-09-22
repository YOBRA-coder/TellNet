import { n as deviceInfo } from "./device-CVNggkwc.mjs";
import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { y as Check } from "../_libs/lucide-react.mjs";
import { n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { a as getAccount, i as connectActive, p as HOTSPOT_FALLBACK } from "./router-B-2WsXvM.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { i as formatRemaining, o as formatStamp } from "./format-D87ri6cr.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
import { t as Skeleton } from "./skeleton-hhtzDwAH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/connect-ChfhwyKS.js
var import_jsx_runtime = require_jsx_runtime();
function ConnectPage() {
	const { device, ready, update } = useDevice();
	const account = useQuery({
		queryKey: [
			"account",
			device?.token,
			device?.customerId
		],
		enabled: ready && Boolean(device),
		queryFn: () => getAccount({ data: {
			token: device.token,
			phone: device?.phone ?? void 0,
			customerId: device?.customerId ?? void 0
		} })
	});
	const connect = useMutation({
		mutationFn: async () => {
			if (!device) throw new Error("Device not ready");
			return connectActive({ data: {
				token: device.token,
				phone: device.phone ?? void 0,
				customerId: device.customerId ?? void 0,
				deviceInfo: deviceInfo()
			} });
		},
		onSuccess: (res) => {
			if (res.ok && res.pack) {
				update({ customerId: res.pack.customerId });
				account.refetch();
			}
		}
	});
	const access = account.data?.access;
	const connected = Boolean(connect.isSuccess && connect.data?.ok || access?.connected);
	if (!ready || account.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: HOTSPOT_FALLBACK,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mx-auto size-16 rounded-full" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mx-auto mt-5 h-10 w-56" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-8 h-40 w-full rounded-2xl" })
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalShell, {
		hotspotName: account.data?.hotspotName ?? "TelNet Wi-Fi",
		children: connected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto flex size-16 items-center justify-center rounded-full bg-ok/15 text-ok",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-8" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-5 text-center font-display text-3xl font-semibold tracking-tight",
				children: "You are online"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-center text-sm text-muted",
				children: "This session is authorised on the router. The package stays valid if the WAN path changes."
			}),
			access?.pack && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Package"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-display text-2xl",
						children: access.pack.packageName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted",
						children: "Expires"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-mono tabular-nums",
						children: [
							formatStamp(access.pack.expiryTime),
							" · ",
							formatRemaining(access.pack.expiryTime),
							" left"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				variant: "secondary",
				className: "mt-6 w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/account",
					children: "View account"
				})
			})
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.2em] text-accent",
				children: "Welcome back"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 font-display text-3xl font-semibold tracking-tight",
				children: access ? "Your package is still active." : "Reconnect an active package"
			}),
			access?.pack ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Package"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-display text-2xl",
						children: access.pack.packageName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted",
						children: "Expires"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono",
						children: formatStamp(access.pack.expiryTime)
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "We could not recognise this device. Use Already Paid if you have an M-Pesa receipt."
			}),
			(access?.otherDevice || connect.data && !connect.data.ok && "code" in connect.data && connect.data.code === "in_use") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-danger",
				children: "This package is already in use on another device."
			}),
			connect.data && !connect.data.ok && !("code" in connect.data && connect.data.code === "in_use") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-danger",
				children: connect.data.error
			}),
			access?.otherDevice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				size: "xl",
				className: "mt-6 w-full",
				variant: "secondary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal",
					children: "Buy a new package"
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "xl",
				className: "mt-6 w-full",
				disabled: !ready || connect.isPending,
				onClick: () => connect.mutate(),
				children: connect.isPending ? "Connecting…" : "Connect"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-col gap-2 text-center text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/recover",
					className: "text-muted hover:text-fg",
					children: "Already paid?"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal",
					className: "text-subtle hover:text-muted",
					children: "Buy a package"
				})]
			})
		] })
	});
}
//#endregion
export { ConnectPage as component };
