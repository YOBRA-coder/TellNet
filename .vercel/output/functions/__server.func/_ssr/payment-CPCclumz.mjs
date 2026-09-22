import { o as __toESM } from "../_runtime.mjs";
import { n as isKenyanPhone, t as formatPhoneDisplay } from "./phone-DB_r9zkq.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { C as useNavigate, b as getRouteApi, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { r as Route$5, s as getPortalBootstrap, u as startPayment } from "./router-B-2WsXvM.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, n as formatDuration, r as formatKes } from "./format-D87ri6cr.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payment-CPCclumz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var portalRoute = getRouteApi("/portal");
function PaymentPage() {
	const { packageId } = Route$5.useSearch();
	const catalog = portalRoute.useLoaderData();
	const navigate = useNavigate();
	const { device, ready, update } = useDevice();
	const [phone, setPhone] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (device?.phone) setPhone((current) => current || formatPhoneDisplay(device.phone));
	}, [device]);
	const boot = useQuery({
		queryKey: ["portal", device?.token],
		enabled: ready && Boolean(device),
		queryFn: () => getPortalBootstrap({ data: {
			token: device.token,
			phone: device?.phone ?? void 0
		} })
	});
	const packages = boot.data?.packages ?? catalog.packages;
	const settings = boot.data?.settings ?? catalog.settings;
	const pkg = packages.find((p) => p.id === packageId);
	const start = useMutation({
		mutationFn: async () => {
			if (!device) throw new Error("Device not ready");
			if (!isKenyanPhone(phone)) throw new Error("Enter a valid Kenyan M-Pesa number.");
			const res = await startPayment({ data: {
				packageId,
				phone,
				token: device.token
			} });
			if (!res.ok) throw new Error(res.error);
			return res;
		},
		onSuccess: (res) => {
			update({
				phone: res.phone,
				customerId: res.customerId
			});
			navigate({
				to: "/portal/payment-status",
				search: { paymentId: res.paymentId }
			});
		},
		onError: (err) => setError(err instanceof Error ? err.message : "Failed")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: settings.hotspotName,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.2em] text-subtle",
				children: "M-Pesa"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-3xl font-semibold tracking-tight",
				children: "Pay to connect"
			}),
			pkg ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 rounded-2xl border border-border bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xl font-semibold",
						children: pkg.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							formatDuration(pkg.durationMinutes),
							" · ",
							formatSpeed(pkg.downloadKbps)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 font-display text-3xl font-semibold tabular-nums text-cream",
						children: formatKes(pkg.price, settings.currency)
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-6 text-sm text-muted",
				children: [
					"Select a package first.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/packages",
						className: "text-accent",
						children: "View packages"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-6 space-y-4",
				onSubmit: (e) => {
					e.preventDefault();
					setError(null);
					start.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "phone",
								children: "M-Pesa phone number"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "phone",
								inputMode: "tel",
								autoComplete: "tel",
								placeholder: "0712 000 000",
								value: phone,
								onChange: (e) => setPhone(e.target.value),
								className: "h-12 text-base"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-subtle",
								children: "Safaricom numbers: 07XX or 01XX."
							})
						]
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						variant: "mpesa",
						size: "xl",
						className: "w-full",
						disabled: !pkg || start.isPending,
						children: start.isPending ? "Sending prompt…" : "Pay with M-Pesa"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portal/recover",
				className: "mt-5 text-center text-sm text-muted hover:text-fg",
				children: "Already paid?"
			})
		]
	});
}
//#endregion
export { PaymentPage as component };
