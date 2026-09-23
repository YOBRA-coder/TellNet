import { o as __toESM } from "../_runtime.mjs";
import { i as readDevice } from "./device-CVNggkwc.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as redeemVoucherPortal } from "./router-COCXQSBe.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/voucher-CqcbD3AN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VoucherRedeem() {
	const [code, setCode] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [ok, setOk] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		setOk(null);
		try {
			const res = await redeemVoucherPortal({ data: {
				code,
				phone,
				deviceToken: readDevice().token
			} });
			if (!res.ok) {
				setError(res.error || "Redeem failed");
				return;
			}
			setOk(res.activationOk ? `Redeemed ${res.packageName}. You are online.` : `Redeemed ${res.packageName}. Activation pending — use Already Paid if needed.`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Redeem failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-md space-y-6 px-4 py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-semibold",
				children: "Voucher code"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Enter a code from the shop. No M-Pesa prompt."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-4",
				onSubmit,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "code",
						children: "Code"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "code",
						value: code,
						onChange: (e) => setCode(e.target.value.toUpperCase()),
						required: true,
						className: "font-mono uppercase"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "phone",
						children: "Phone"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "phone",
						value: phone,
						onChange: (e) => setPhone(e.target.value),
						placeholder: "07XXXXXXXX",
						required: true
					})] }),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600",
						children: error
					}),
					ok && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700",
						children: ok
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: busy,
						children: busy ? "Redeeming…" : "Redeem voucher"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-center text-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/portal",
					className: "text-accent underline",
					children: "Back to packages"
				})
			})
		]
	});
}
//#endregion
export { VoucherRedeem as component };
