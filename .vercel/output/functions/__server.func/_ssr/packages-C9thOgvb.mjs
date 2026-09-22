import { b as getRouteApi, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { s as getPortalBootstrap } from "./router-B-2WsXvM.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
import { t as PackageCard } from "./package-card-DCWQSKkh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/packages-C9thOgvb.js
var import_jsx_runtime = require_jsx_runtime();
var portalRoute = getRouteApi("/portal");
function PackagesPage() {
	const catalog = portalRoute.useLoaderData();
	const { device, ready } = useDevice();
	const q = useQuery({
		queryKey: ["portal", device?.token],
		enabled: ready && Boolean(device),
		queryFn: () => getPortalBootstrap({ data: {
			token: device.token,
			phone: device?.phone ?? void 0
		} })
	});
	const settings = q.data?.settings ?? catalog.settings;
	const packages = q.data?.packages ?? catalog.packages;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: settings.hotspotName,
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "pb-2 text-center text-sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/recover",
				className: "text-muted hover:text-fg",
				children: "Already paid?"
			})
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Available packages"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Speed is enforced per package on the router. Duration is counted by the server, not your phone."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex flex-col gap-3",
				children: packages.map((pkg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageCard, {
					pkg,
					currency: settings.currency
				}, pkg.id))
			})
		]
	});
}
//#endregion
export { PackagesPage as component };
