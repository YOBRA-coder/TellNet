import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { r as cn } from "./utils-DITYiIRO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-iIelHC8f.js
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase", {
	variants: { tone: {
		neutral: "border-border bg-raised text-muted",
		ok: "border-ok/20 bg-ok/10 text-ok",
		warn: "border-warn/20 bg-warn/10 text-warn",
		danger: "border-danger/20 bg-danger/10 text-danger",
		accent: "border-accent/20 bg-accent/10 text-accent",
		cream: "border-cream/15 bg-cream/10 text-cream"
	} },
	defaultVariants: { tone: "neutral" }
});
function Badge({ className, tone, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ tone }), className),
		...props
	});
}
//#endregion
export { Badge as t };
