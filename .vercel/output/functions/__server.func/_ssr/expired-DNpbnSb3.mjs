import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { p as HOTSPOT_FALLBACK } from "./router-COCXQSBe.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/expired-DNpbnSb3.js
var import_jsx_runtime = require_jsx_runtime();
function ExpiredPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: HOTSPOT_FALLBACK,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.2em] text-subtle",
				children: "Session ended"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 font-display text-3xl font-semibold tracking-tight",
				children: "Your package has expired."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-relaxed text-muted",
				children: "Internet access was removed on the router when the timer ran out. Buy a new package to get back online — previous receipts cannot be reused."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				size: "xl",
				className: "mt-8 w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal/packages",
					children: "Purchase a new package"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/recover",
				className: "mt-4 text-center text-sm text-muted hover:text-fg",
				children: "Think this is a mistake? Recover with a receipt"
			})
		]
	});
}
//#endregion
export { ExpiredPage as component };
