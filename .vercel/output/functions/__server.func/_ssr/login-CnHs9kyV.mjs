import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { S as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { d as Route$23, f as APP_NAME } from "./router-COCXQSBe.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { t as TelNetMark } from "./brand-C8gzlPc4.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
import { r as loginOperator } from "./public-D6kztkSL.mjs";
import { t as useOperatorSession } from "./operator-_KXLRQpx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CnHs9kyV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { redirect } = Route$23.useSearch();
	const dest = redirect && redirect.startsWith("/admin") ? redirect : "/admin/dashboard";
	const { isOperator, isPending } = useOperatorSession();
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "atmosphere grid min-h-dvh place-items-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-48 animate-pulse rounded-md bg-raised" })
	});
	if (isOperator) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/admin/dashboard" });
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const res = await loginOperator({ data: { password } });
			if (!res.ok) {
				setError(res.error || "Incorrect password.");
				return;
			}
			window.location.href = dest;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "atmosphere grid min-h-dvh place-items-center px-5 py-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center gap-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelNetMark, { className: "h-10 w-10" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-2xl font-semibold tracking-tight",
						children: "Operator login"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [APP_NAME, " — password only. Customers use the public portal."]
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "space-y-4",
					onSubmit,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "operator-password",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "operator-password",
								type: "password",
								autoComplete: "current-password",
								value: password,
								onChange: (e) => setPassword(e.target.value),
								placeholder: "Operator password",
								required: true,
								autoFocus: true
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "w-full",
							disabled: busy || !password,
							children: busy ? "Checking…" : "Enter operator console"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-center text-xs text-muted",
					children: [
						"Default password is ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "rounded bg-raised px-1",
							children: "telnet-admin"
						}),
						". Change it under Settings after login."
					]
				})
			]
		})
	});
}
//#endregion
export { Login as component };
