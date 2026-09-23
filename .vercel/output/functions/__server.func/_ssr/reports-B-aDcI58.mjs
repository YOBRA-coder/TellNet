import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { r as formatKes } from "./format-D87ri6cr.mjs";
import { l as getReports } from "./admin-bWqHMeNH.mjs";
import { t as Card } from "./card-Bux5iIh_.mjs";
import { a as Bar, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as BarChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reports-B-aDcI58.js
var import_jsx_runtime = require_jsx_runtime();
function ReportsPage() {
	const d = useQuery({
		queryKey: ["reports"],
		queryFn: () => getReports()
	}).data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Reports"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Revenue is counted from verified M-Pesa SUCCESS rows — not from frontend confirmations."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Period, {
						title: "Today",
						items: [
							["Revenue", formatKes(d?.today.revenue ?? 0)],
							["Transactions", String(d?.today.tx ?? 0)],
							["Successful", String(d?.today.success ?? 0)],
							["Failed", String(d?.today.failed ?? 0)],
							["Packages sold", String(d?.today.sold ?? 0)]
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Period, {
						title: "This week",
						items: [
							["Revenue", formatKes(d?.week.revenue ?? 0)],
							["Transactions", String(d?.week.tx ?? 0)],
							["Best seller", d?.bestWeek[0] ? `${d.bestWeek[0].name} · ${d.bestWeek[0].sold}` : "—"]
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Period, {
						title: "This month",
						items: [
							["Revenue", formatKes(d?.month.revenue ?? 0)],
							["Transactions", String(d?.month.tx ?? 0)],
							["Top package", d?.monthPerf[0] ? `${d.monthPerf[0].name} · ${formatKes(d.monthPerf[0].revenue)}` : "—"]
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-4 font-display text-lg font-semibold",
					children: "Daily revenue · 14 days"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: d?.daily ?? [],
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									stroke: "#27272a",
									vertical: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "day",
									stroke: "#71717a",
									fontSize: 11
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									stroke: "#71717a",
									fontSize: 11
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
									background: "#18181c",
									border: "1px solid #27272a",
									borderRadius: 12
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "revenue",
									fill: "#5eead4",
									radius: [
										6,
										6,
										0,
										0
									]
								})
							]
						})
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-4 font-display text-lg font-semibold",
					children: "Package performance · this month"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "divide-y divide-border",
					children: (d?.monthPerf ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums text-muted",
							children: [
								p.sold,
								" sold · ",
								formatKes(p.revenue)
							]
						})]
					}, p.name))
				})]
			})
		]
	});
}
function Period({ title, items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-lg font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
			className: "mt-4 space-y-2",
			children: items.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "text-muted",
					children: k
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular-nums",
					children: v
				})]
			}, k))
		})]
	});
}
//#endregion
export { ReportsPage as component };
