import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as TelNetMark } from "./brand-C8gzlPc4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portal-shell-BNHzpcbq.js
var import_jsx_runtime = require_jsx_runtime();
function PortalShell({ hotspotName, children, footer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "atmosphere flex min-h-dvh flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/portal",
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelNetMark, { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-base font-semibold tracking-tight",
						children: hotspotName
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "text-xs text-subtle hover:text-muted",
					children: "Home"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4",
				children
			}),
			footer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mx-auto w-full max-w-md px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
				children: footer
			})
		]
	});
}
//#endregion
export { PortalShell as t };
