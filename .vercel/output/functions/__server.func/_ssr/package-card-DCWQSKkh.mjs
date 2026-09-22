import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { x as ArrowRight } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, n as formatDuration, r as formatKes } from "./format-D87ri6cr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/package-card-DCWQSKkh.js
var import_jsx_runtime = require_jsx_runtime();
function PackageCard({ pkg, currency = "KES" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-lift",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle",
					children: formatDuration(pkg.durationMinutes)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mt-1 font-display text-xl font-semibold tracking-tight",
					children: pkg.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 font-display text-3xl font-semibold tabular-nums",
					children: [formatKes(pkg.price, currency), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-sm font-normal text-muted",
						children: formatSpeed(pkg.downloadKbps)
					})]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					width: "18",
					height: "18",
					viewBox: "0 0 24 24",
					fill: "none",
					"aria-hidden": true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M5 12.5c3.5-4 10.5-4 14 0M8 15.5c2-2.2 6-2.2 8 0M12 19h.01",
						stroke: "currentColor",
						strokeWidth: "2",
						strokeLinecap: "round"
					})
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 flex justify-end",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				size: "lg",
				className: "min-w-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/portal/payment",
					search: { packageId: pkg.id },
					children: ["Choose", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
				})
			})
		})]
	});
}
//#endregion
export { PackageCard as t };
