import { t as formatPhoneDisplay } from "./phone-DB_r9zkq.mjs";
import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { S as Activity, a as TriangleAlert, b as Banknote, d as Radio, i as Users, n as Wifi, r as WifiOff } from "../_libs/lucide-react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { r as cn } from "./utils-DITYiIRO.mjs";
import { t as Badge } from "./badge-iIelHC8f.mjs";
import { n as PaymentBadge, t as ActivationBadge } from "./status-badge-DGiBbKPl.mjs";
import { o as formatStamp, r as formatKes } from "./format-D87ri6cr.mjs";
import { t as Skeleton } from "./skeleton-hhtzDwAH.mjs";
import { s as getDashboard } from "./admin-B-jxD4aJ.mjs";
import { t as Card } from "./card-Bux5iIh_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-BwslmyMK.js
var import_jsx_runtime = require_jsx_runtime();
function DashboardPage() {
	const q = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard(),
		staleTime: 2e4,
		refetchInterval: 45e3,
		placeholderData: (prev) => prev
	});
	if (q.isLoading && !q.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
		children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28 rounded-xl" }, i))
	});
	if (q.isLoading && !q.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
		children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28 rounded-xl" }, i))
	});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-xl font-semibold",
				children: "Dashboard failed to load"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: q.error instanceof Error ? q.error.message : "The dashboard request failed."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-4 rounded-md border border-border px-4 py-2 text-sm",
				onClick: () => q.refetch(),
				children: "Retry"
			})
		]
	});
	if (!q.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "No dashboard data was returned."
		})
	});
	const { cards, isps, events, recent, settings, router } = q.data;
	const internet = isps.some((i) => i.status === "ONLINE") && router.reachable ? "Online" : "Degraded";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-[0.18em] text-subtle",
					children: settings.hotspotName
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-3xl font-semibold tracking-tight",
					children: "Dashboard"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: internet === "Online" ? "ok" : "warn",
					children: internet
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Today's revenue",
						value: formatKes(cards.todayRevenue, settings.currency),
						icon: Banknote
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Online users",
						value: String(cards.onlineUsers),
						icon: Wifi
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Active packages",
						value: String(cards.activePackages),
						icon: Users
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Awaiting activation",
						value: String(cards.awaitingActivation),
						icon: TriangleAlert,
						warn: cards.awaitingActivation > 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Expired packages",
						value: String(cards.expiredPackages),
						icon: WifiOff
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Total customers",
						value: String(cards.totalCustomers),
						icon: Users
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Successful payments",
						value: String(cards.todaySuccess),
						icon: Activity
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Failed payments",
						value: String(cards.todayFailed),
						icon: TriangleAlert
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-[1.2fr_0.8fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-lg font-semibold",
							children: "Recent payments"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin/payments",
							className: "text-sm text-muted hover:text-fg",
							children: "All transactions"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "divide-y divide-border",
						children: recent.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3 py-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate font-medium",
									children: [
										formatPhoneDisplay(p.phone),
										" · ",
										p.packageName
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 font-mono text-xs text-subtle",
									children: [
										p.mpesaTransactionId ?? "pending",
										" · ",
										formatStamp(p.createdAt)
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex shrink-0 flex-col items-end gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: formatKes(p.amount, settings.currency)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaymentBadge, { status: p.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivationBadge, { status: p.activationStatus })]
								})]
							})]
						}, p.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "mb-4 flex items-center gap-2 font-display text-lg font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4 text-accent" }), "ISP status"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-3",
								children: isps.map((isp) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isp.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: isp.status === "ONLINE" ? "ok" : isp.status === "DEGRADED" ? "warn" : "danger",
										children: isp.status
									})]
								}, isp.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-4 text-xs leading-relaxed text-subtle",
								children: [q.data.mikrotiks.length ? `${q.data.mikrotiks.length} MikroTik${q.data.mikrotiks.length === 1 ? "" : "s"} registered. ` : "No MikroTik registered yet — add one on Network. ", "TelNet does not steer traffic. MikroTik owns WAN failover — packages stay valid across every path."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/admin/network",
								className: "mt-3 inline-block text-sm text-accent hover:text-fg",
								children: "Manage routers"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mb-3 font-display text-lg font-semibold",
							children: "Network log"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-3",
							children: events.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs uppercase tracking-wide text-subtle",
								children: e.eventType.replaceAll("_", " ")
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm leading-relaxed text-muted",
								children: e.description
							})] }, e.id))
						})]
					})]
				})]
			})
		]
	});
}
function Stat({ label, value, icon: Icon, warn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs uppercase tracking-wide text-subtle",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("size-4", warn ? "text-warn" : "text-muted") })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 font-display text-2xl font-semibold tabular-nums",
			children: value
		})]
	});
}
//#endregion
export { DashboardPage as component };
