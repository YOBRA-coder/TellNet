import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { C as useNavigate, S as Navigate, g as Outlet, p as useRouterState, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { S as Activity, _ as CreditCard, d as Radio, h as LayoutDashboard, i as Users, l as Settings, m as Menu, n as Wifi, o as Ticket, p as Package } from "../_libs/lucide-react.mjs";
import { f as APP_NAME } from "./router-B-2WsXvM.mjs";
import { r as cn } from "./utils-DITYiIRO.mjs";
import { t as TelNetMark } from "./brand-C8gzlPc4.mjs";
import { i as SheetTitle, n as SheetContent, r as SheetHeader, t as Sheet } from "./sheet-CYzuTo6l.mjs";
import { r as logoutOperator } from "./public-DBxIEVXF.mjs";
import { t as useOperatorSession } from "./operator-Blej1v2H.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-Bf547yNx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OperatorUserButton() {
	const navigate = useNavigate();
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function handleSignOut() {
		if (busy) return;
		setBusy(true);
		try {
			await logoutOperator();
			await navigate({ to: "/login" });
		} catch {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: handleSignOut,
		disabled: busy,
		className: "w-full rounded-md px-2.5 py-2 text-left text-sm text-muted hover:bg-raised hover:text-fg disabled:cursor-wait disabled:opacity-60",
		children: busy ? "Signing out…" : "Sign out"
	});
}
var NAV = [
	{
		to: "/admin/dashboard",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		to: "/admin/live-users",
		label: "Live users",
		icon: Wifi
	},
	{
		to: "/admin/customers",
		label: "Customers",
		icon: Users
	},
	{
		to: "/admin/packages",
		label: "Packages",
		icon: Package
	},
	{
		to: "/admin/payments",
		label: "Transactions",
		icon: CreditCard
	},
	{
		to: "/admin/vouchers",
		label: "Vouchers",
		icon: Ticket
	},
	{
		to: "/admin/reports",
		label: "Reports",
		icon: Activity
	},
	{
		to: "/admin/network",
		label: "Network",
		icon: Radio
	},
	{
		to: "/admin/settings",
		label: "Settings",
		icon: Settings
	}
];
function AdminShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [more, setMore] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 lg:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/admin/dashboard",
						className: "mb-6 flex items-center gap-2 px-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelNetMark, { className: "size-6" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display text-base font-semibold",
							children: APP_NAME
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-1 flex-col gap-0.5",
						children: NAV.map((item) => {
							const active = pathname === item.to || pathname.startsWith(item.to + "/");
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: cn("flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors", active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }), item.label]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 px-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OperatorUserButton, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex items-center justify-between border-b border-border px-4 py-3 lg:hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin/dashboard",
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelNetMark, { className: "size-6" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display font-semibold",
								children: APP_NAME
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OperatorUserButton, {})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 px-4 py-5 sm:px-6 lg:px-8",
						children
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "sticky bottom-0 grid grid-cols-4 border-t border-border bg-surface/95 px-1 py-1 lg:hidden",
						children: [NAV.slice(0, 3).map((item) => {
							const active = pathname === item.to;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: cn("flex flex-col items-center gap-1 rounded-md py-2 text-xs", active ? "text-accent" : "text-muted"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }), item.label]
							}, item.to);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: cn("flex flex-col items-center gap-1 rounded-md py-2 text-xs", more ? "text-accent" : "text-muted"),
							onClick: () => setMore(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-4" }), "More"]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: more,
				onOpenChange: setMore,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "bottom",
					className: "lg:hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
						className: "font-display",
						children: "Console"
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "mt-4 grid grid-cols-2 gap-2",
						children: [NAV.map((item) => {
							const active = pathname === item.to;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								onClick: () => setMore(false),
								className: cn("flex h-12 items-center gap-2 rounded-lg border border-border px-3 text-sm", active ? "bg-raised text-fg" : "text-muted"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }), item.label]
							}, item.to);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "col-span-2 border-t border-border pt-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OperatorUserButton, {})
						})]
					})]
				})
			})
		]
	});
}
function AdminLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { isOperator, isPending } = useOperatorSession();
	const isLogin = pathname === "/admin/login";
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-40 animate-pulse rounded-md bg-raised" })
	});
	if (isLogin) {
		if (isOperator) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/admin/dashboard" });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {});
	}
	if (!isOperator) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		search: { redirect: pathname }
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { AdminLayout as component };
