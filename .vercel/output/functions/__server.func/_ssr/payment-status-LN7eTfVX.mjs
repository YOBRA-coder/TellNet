import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { C as useNavigate, x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as Route$4, o as getPaymentStatus, p as HOTSPOT_FALLBACK } from "./router-COCXQSBe.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { r as formatKes } from "./format-D87ri6cr.mjs";
import { t as PortalShell } from "./portal-shell-BNHzpcbq.mjs";
import { t as useDevice } from "./use-device-9XPmqnlo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payment-status-LN7eTfVX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PaymentStatusPage() {
	const { paymentId } = Route$4.useSearch();
	const navigate = useNavigate();
	const { update } = useDevice();
	const [timedOut, setTimedOut] = (0, import_react.useState)(false);
	const q = useQuery({
		queryKey: ["payment", paymentId],
		enabled: Boolean(paymentId),
		queryFn: () => getPaymentStatus({ data: { paymentId } }),
		refetchInterval: (query) => {
			if ((query.state.data?.ok ? query.state.data.payment.status : null) === "PENDING") return 3e3;
			return false;
		}
	});
	(0, import_react.useEffect)(() => {
		const t = window.setTimeout(() => setTimedOut(true), 9e4);
		return () => window.clearTimeout(t);
	}, [paymentId]);
	const payment = q.data?.ok ? q.data.payment : null;
	const access = q.data?.ok ? q.data.access : null;
	(0, import_react.useEffect)(() => {
		if (payment?.customerId) update({
			customerId: payment.customerId,
			phone: payment.phone
		});
	}, [payment, update]);
	(0, import_react.useEffect)(() => {
		if (payment?.status === "SUCCESS" && access?.connected) navigate({ to: "/portal/connect" });
	}, [
		payment,
		access,
		navigate
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PortalShell, {
		hotspotName: HOTSPOT_FALLBACK,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.2em] text-subtle",
				children: "Payment status"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-3xl font-semibold tracking-tight",
				children: payment?.status === "SUCCESS" ? "Payment received" : payment?.status === "FAILED" || payment?.status === "CANCELLED" ? "Payment did not complete" : "Waiting for M-Pesa"
			}),
			payment?.status === "PENDING" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm text-muted",
					children: [
						"Check your phone and enter your M-Pesa PIN to pay",
						" ",
						payment ? formatKes(payment.amount) : "",
						" for ",
						payment?.packageName,
						"."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 rounded-2xl border border-border bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-wide text-subtle",
							children: "Live STK Push"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 font-display text-lg font-semibold",
							children: [
								payment.packageName,
								" · ",
								formatKes(payment.amount)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "Confirm the Safaricom prompt on your phone. This page updates when Daraja reports the result — there is no demo PIN."
						})
					]
				}),
				timedOut && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 text-sm text-warn",
					children: [
						"Still waiting. If money was deducted, use",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/portal/recover",
							className: "underline",
							children: "Already Paid?"
						}),
						" ",
						"with your M-Pesa receipt."
					]
				})
			] }),
			payment?.status === "SUCCESS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-ok/20 bg-ok/10 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-ok",
							children: "M-Pesa confirmed"
						}),
						payment.mpesaTransactionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-lg tracking-wide",
							children: payment.mpesaTransactionId
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "Save this receipt. You can reconnect with it later."
						})
					]
				}), payment.activationStatus === "ACTIVATION_FAILED" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-warn",
					children: access?.otherDevice ? "This package is already in use on another device." : "Payment received. Your package could not be activated yet. Please use Already Paid? to reconnect."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "lg",
					className: "w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/recover",
						children: "Recover my package"
					})
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "lg",
					className: "w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/connect",
						children: "Connect now"
					})
				})]
			}),
			(payment?.status === "FAILED" || payment?.status === "CANCELLED") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: payment.resultDesc || "The M-Pesa request was not completed."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "lg",
					className: "w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/portal/packages",
						children: "Choose a package"
					})
				})]
			})
		]
	});
}
//#endregion
export { PaymentStatusPage as component };
