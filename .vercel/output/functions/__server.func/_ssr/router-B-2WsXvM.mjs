import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as lazyRouteComponent, d as Scripts, f as HeadContent, g as Outlet, h as createRouter, v as createFileRoute, w as useRouter, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as createServerFn, u as __exportAll } from "./ssr.mjs";
import { F as object, M as literal, P as number, R as string, z as union } from "../_libs/@better-auth/core+[...].mjs";
import { t as auth } from "./server-CItOiXTe.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { a as TriangleAlert } from "../_libs/lucide-react.mjs";
import { r as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-B-2WsXvM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var APP_NAME = "TelNet";
var HOTSPOT_FALLBACK = "TelNet Wi-Fi";
function makeQueryClient() {
	return new QueryClient({ defaultOptions: { queries: {
		staleTime: 3e4,
		gcTime: 3e5,
		refetchOnWindowFocus: false,
		refetchOnReconnect: true,
		retry: 1
	} } });
}
var styles_default = "/assets/styles-D_Nb1_cF.css";
var Route$26 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "TelNet Wi-Fi — pay with M-Pesa, connect, stay online. ISP-agnostic hotspot billing."
			},
			{
				name: "theme-color",
				content: "#09090b"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Syne:wght@500;600;700;800&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	const [queryClient] = (0, import_react.useState)(() => makeQueryClient());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "min-h-dvh bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QueryClientProvider, {
					client: queryClient,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
						theme: "dark",
						position: "top-center",
						toastOptions: { style: {
							background: "#18181c",
							border: "1px solid #27272a",
							color: "#f4f4f5"
						} }
					})]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
var $$splitComponentImporter$23 = () => import("./routes-iNYJltip.mjs");
var Route$25 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./route-Bf547yNx.mjs");
var Route$24 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./login-Vxa_u8Bt.mjs");
var Route$23 = createFileRoute("/login")({
	validateSearch: (s) => ({ redirect: typeof s.redirect === "string" ? s.redirect : "/admin/dashboard" }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
var identitySchema = object({
	token: string().min(8).max(80),
	phone: string().optional(),
	customerId: string().optional()
});
var getPortalCatalog = createServerFn({ method: "GET" }).handler(createSsrRpc("0bb0202c5534237aea04a3f6d2db2f3ffbcbefd32851485b5de39ba4261cce44"));
var getPortalBootstrap = createServerFn({ method: "POST" }).validator((data) => identitySchema.parse(data)).handler(createSsrRpc("4b6437690822ecd493eecf8d15fb82646dc99b8bd5ad8f9c9d1f393916644573"));
createServerFn({ method: "GET" }).handler(createSsrRpc("dda9308387491e55fc8be35fa51b6b16df4ea4085efecd93f5bb945d7e6b278a"));
var startPayment = createServerFn({ method: "POST" }).validator((data) => object({
	packageId: string(),
	phone: string(),
	token: string().min(8)
}).parse(data)).handler(createSsrRpc("0d6c66c88ad6b73119dd7012d9d21072ba39ee82c3c9dd6450618b370dbe5de7"));
var getPaymentStatus = createServerFn({ method: "POST" }).validator((data) => object({ paymentId: string() }).parse(data)).handler(createSsrRpc("deb9f18db71599990d6c96a2d7334ebff8d01e0f2a0514952961cbee51a3399f"));
var recoverPackage = createServerFn({ method: "POST" }).validator((data) => object({
	transactionId: string().min(6).max(20),
	token: string().min(8),
	phone: string().optional(),
	deviceInfo: string().optional()
}).parse(data)).handler(createSsrRpc("da3c52133f84d72af6d108a241cb879a8af4ae9ff8d225df302be1c3e3830fe4"));
var connectActive = createServerFn({ method: "POST" }).validator((data) => object({
	token: string().min(8),
	phone: string().optional(),
	customerId: string().optional(),
	deviceInfo: string().optional()
}).parse(data)).handler(createSsrRpc("8d20a2a9ffe5954af479b246157120d1cfec7beb1e10512ef7ae10146f85c784"));
var getAccount = createServerFn({ method: "POST" }).validator((data) => identitySchema.parse(data)).handler(createSsrRpc("9058042af9e4ae73e9b4352eea04d5cdb22276c242cfbcd58fca3899b3e1f4a1"));
var redeemVoucherPortal = createServerFn({ method: "POST" }).validator((data) => object({
	code: string().min(4).max(32),
	phone: string().min(9).max(15),
	deviceToken: string().optional()
}).parse(data)).handler(createSsrRpc("f287903b5351366a758ac94a7e9c86d2345286f74634a6788428e82edd89d389"));
var $$splitComponentImporter$20 = () => import("./route-FRnVisLU.mjs");
var Route$22 = createFileRoute("/portal")({
	loader: () => getPortalCatalog(),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./admin-uqyrw_tn.mjs");
var Route$21 = createFileRoute("/admin/")({ component: lazyRouteComponent($$splitComponentImporter$19, "component") });
var $$splitComponentImporter$18 = () => import("./customers-D2DDlIta.mjs");
var Route$20 = createFileRoute("/admin/customers")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./dashboard-BwslmyMK.mjs");
var Route$19 = createFileRoute("/admin/dashboard")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./live-users-ff4-SFdg.mjs");
var Route$18 = createFileRoute("/admin/live-users")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./login-D9UNDDq-.mjs");
var Route$17 = createFileRoute("/admin/login")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./network-CllvF5Dr.mjs");
var Route$16 = createFileRoute("/admin/network")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var $$splitComponentImporter$13 = () => import("./packages-CFInelWZ.mjs");
var Route$15 = createFileRoute("/admin/packages")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./payments-BRxo7EpR.mjs");
var Route$14 = createFileRoute("/admin/payments")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./reports-Bol2g9zj.mjs");
var Route$13 = createFileRoute("/admin/reports")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./settings-DIU7EuvK.mjs");
var Route$12 = createFileRoute("/admin/settings")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./vouchers-CmCXW9zW.mjs");
var Route$11 = createFileRoute("/admin/vouchers")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./portal-dXYG0dI6.mjs");
var Route$10 = createFileRoute("/portal/")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./account-B0B6hftd.mjs");
var Route$9 = createFileRoute("/portal/account")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./connect-ChfhwyKS.mjs");
var Route$8 = createFileRoute("/portal/connect")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./expired-DklJ0uuP.mjs");
var Route$7 = createFileRoute("/portal/expired")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./packages-C9thOgvb.mjs");
var Route$6 = createFileRoute("/portal/packages")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./payment-CPCclumz.mjs");
var Route$5 = createFileRoute("/portal/payment")({
	validateSearch: (s) => ({ packageId: typeof s.packageId === "string" ? s.packageId : "" }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./payment-status-RUtnR9xQ.mjs");
var Route$4 = createFileRoute("/portal/payment-status")({
	validateSearch: (s) => ({ paymentId: typeof s.paymentId === "string" ? s.paymentId : "" }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./recover-Ci9JtBxH.mjs");
var Route$3 = createFileRoute("/portal/recover")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./voucher--eSu78QI.mjs");
var Route$2 = createFileRoute("/portal/voucher")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route$1 = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var Route = createFileRoute("/api/mpesa/callback")({ server: { handlers: {
	GET: () => new Response("ok"),
	POST: async ({ request }) => {
		const { handleMpesaCallback } = await import("./callback.server-D3i_WM1b.mjs");
		return handleMpesaCallback(request);
	}
} } });
var IndexRoute = Route$25.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$26
});
var AdminRouteRoute = Route$24.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$26
});
var LoginRoute = Route$23.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$26
});
var PortalRouteRoute = Route$22.update({
	id: "/portal",
	path: "/portal",
	getParentRoute: () => Route$26
});
var AdminIndexRoute = Route$21.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdminRouteRoute
});
var AdminCustomersRoute = Route$20.update({
	id: "/customers",
	path: "/customers",
	getParentRoute: () => AdminRouteRoute
});
var AdminDashboardRoute = Route$19.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => AdminRouteRoute
});
var AdminLiveUsersRoute = Route$18.update({
	id: "/live-users",
	path: "/live-users",
	getParentRoute: () => AdminRouteRoute
});
var AdminLoginRoute = Route$17.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => AdminRouteRoute
});
var AdminNetworkRoute = Route$16.update({
	id: "/network",
	path: "/network",
	getParentRoute: () => AdminRouteRoute
});
var AdminPackagesRoute = Route$15.update({
	id: "/packages",
	path: "/packages",
	getParentRoute: () => AdminRouteRoute
});
var AdminPaymentsRoute = Route$14.update({
	id: "/payments",
	path: "/payments",
	getParentRoute: () => AdminRouteRoute
});
var AdminReportsRoute = Route$13.update({
	id: "/reports",
	path: "/reports",
	getParentRoute: () => AdminRouteRoute
});
var AdminSettingsRoute = Route$12.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AdminRouteRoute
});
var AdminVouchersRoute = Route$11.update({
	id: "/vouchers",
	path: "/vouchers",
	getParentRoute: () => AdminRouteRoute
});
var PortalIndexRoute = Route$10.update({
	id: "/",
	path: "/",
	getParentRoute: () => PortalRouteRoute
});
var PortalAccountRoute = Route$9.update({
	id: "/account",
	path: "/account",
	getParentRoute: () => PortalRouteRoute
});
var PortalConnectRoute = Route$8.update({
	id: "/connect",
	path: "/connect",
	getParentRoute: () => PortalRouteRoute
});
var PortalExpiredRoute = Route$7.update({
	id: "/expired",
	path: "/expired",
	getParentRoute: () => PortalRouteRoute
});
var PortalPackagesRoute = Route$6.update({
	id: "/packages",
	path: "/packages",
	getParentRoute: () => PortalRouteRoute
});
var PortalPaymentRoute = Route$5.update({
	id: "/payment",
	path: "/payment",
	getParentRoute: () => PortalRouteRoute
});
var PortalPaymentStatusRoute = Route$4.update({
	id: "/payment-status",
	path: "/payment-status",
	getParentRoute: () => PortalRouteRoute
});
var PortalRecoverRoute = Route$3.update({
	id: "/recover",
	path: "/recover",
	getParentRoute: () => PortalRouteRoute
});
var PortalVoucherRoute = Route$2.update({
	id: "/voucher",
	path: "/voucher",
	getParentRoute: () => PortalRouteRoute
});
var ApiAuthSplatRoute = Route$1.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$26
});
var ApiMpesaCallbackRoute = Route.update({
	id: "/api/mpesa/callback",
	path: "/api/mpesa/callback",
	getParentRoute: () => Route$26
});
var AdminRouteRouteChildren = {
	AdminCustomersRoute,
	AdminDashboardRoute,
	AdminLiveUsersRoute,
	AdminLoginRoute,
	AdminNetworkRoute,
	AdminPackagesRoute,
	AdminPaymentsRoute,
	AdminReportsRoute,
	AdminSettingsRoute,
	AdminVouchersRoute,
	AdminIndexRoute
};
var AdminRouteRouteWithChildren = AdminRouteRoute._addFileChildren(AdminRouteRouteChildren);
var PortalRouteRouteChildren = {
	PortalAccountRoute,
	PortalConnectRoute,
	PortalExpiredRoute,
	PortalPackagesRoute,
	PortalPaymentRoute,
	PortalPaymentStatusRoute,
	PortalRecoverRoute,
	PortalVoucherRoute,
	PortalIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRouteRoute: AdminRouteRouteWithChildren,
	PortalRouteRoute: PortalRouteRoute._addFileChildren(PortalRouteRouteChildren),
	LoginRoute,
	ApiAuthSplatRoute,
	ApiMpesaCallbackRoute
};
var routeTree = Route$26._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getAccount as a, recoverPackage as c, Route$23 as d, APP_NAME as f, connectActive as i, redeemVoucherPortal as l, Route$4 as n, getPaymentStatus as o, HOTSPOT_FALLBACK as p, Route$5 as r, getPortalBootstrap as s, router_exports as t, startPayment as u };
