import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { c as ShieldCheck, n as Wifi, s as Smartphone, x as ArrowRight } from "../_libs/lucide-react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { f as APP_NAME } from "./router-COCXQSBe.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as TelNetMark } from "./brand-C8gzlPc4.mjs";
import { n as getPublicHome } from "./public-D6kztkSL.mjs";
import { t as PackageCard } from "./package-card-DCWQSKkh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BuAEcxCT.js
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const { data } = useQuery({
		queryKey: ["home"],
		queryFn: () => getPublicHome()
	});
	const hotspot = data?.hotspotName ?? "TelNet Wi-Fi";
	const packages = data?.packages ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "atmosphere min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mx-auto flex max-w-5xl items-center justify-between px-5 py-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelNetMark, { className: "size-8" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-lg font-semibold",
						children: APP_NAME
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					className: "flex items-center gap-4 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "#packages",
						className: "text-muted hover:text-fg",
						children: "Packages"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/recover",
						className: "text-muted hover:text-fg",
						children: "Already paid?"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto max-w-5xl px-5 pb-10 pt-6 sm:pt-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-[0.22em] text-accent",
						children: hotspot
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl",
						children: data?.welcomeMessage ?? "Welcome to Wi-Fi"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 max-w-md text-base leading-relaxed text-muted",
						children: "Choose a package, pay with M-Pesa, and you are online the moment payment is confirmed. Same package if you disconnect — no second charge until it expires."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-col gap-3 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							size: "xl",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: "#packages",
								children: ["View packages", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							size: "xl",
							variant: "secondary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/portal",
								children: "Open portal"
							})
						})]
					}),
					!data?.internetUp && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 max-w-md rounded-lg border border-warn/20 bg-warn/10 px-3 py-2 text-sm text-warn",
						children: "Internet connection is currently unavailable. Please try again later."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: "packages",
				className: "mx-auto max-w-5xl scroll-mt-8 px-5 pb-16",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-[0.2em] text-subtle",
							children: "Packages"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-2xl font-semibold",
							children: "Pay. Connect. Stay online."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: !data ? [
							1,
							2,
							3,
							4
						].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-48 animate-pulse rounded-2xl border border-border bg-surface" }, n)) : packages.map((pkg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageCard, {
							pkg,
							currency: data.currency
						}, pkg.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-center text-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/portal/recover",
							className: "text-muted hover:text-fg",
							children: "Already paid? Recover my package"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, { className: "size-4" }),
						title: "Connect to Wi-Fi",
						body: "Join the hotspot. This page is the captive portal — pick a package on your phone."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" }),
						title: "Pay with M-Pesa",
						body: "Enter your Kenyan number. Confirm the STK prompt. Internet turns on only after the payment is verified."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-4" }),
						title: "Come back anytime",
						body: "Switch Wi-Fi off and return later. If time remains, tap Connect. No second charge."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "mx-auto flex max-w-5xl items-center justify-between px-5 pb-10 text-xs text-subtle",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [APP_NAME, " · Independent of the ISP path carrying your traffic"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "text-subtle/40 hover:text-subtle",
					children: "Operator"
				})]
			})
		]
	});
}
function Feature({ icon, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-xl border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex size-9 items-center justify-center rounded-md border border-border bg-raised text-accent",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-4 font-display text-lg font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted",
				children: body
			})
		]
	});
}
//#endregion
export { Home as component };
