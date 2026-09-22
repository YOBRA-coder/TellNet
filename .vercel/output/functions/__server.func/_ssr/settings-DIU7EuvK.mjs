import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { x as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { u as getSettingsAdmin, w as saveSettingsAdmin } from "./admin-B-jxD4aJ.mjs";
import { t as Card } from "./card-Bux5iIh_.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
import { t as Switch } from "./switch-BSLwVIRs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DIU7EuvK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["settings"],
		queryFn: () => getSettingsAdmin()
	});
	const [form, setForm] = (0, import_react.useState)({
		hotspotName: "TelNet Wi-Fi",
		currency: "KES",
		welcomeMessage: "Welcome to Wi-Fi",
		mpesaShortcode: "",
		mpesaConsumerKey: "",
		mpesaConsumerSecret: "",
		mpesaPasskey: "",
		mpesaEnv: "sandbox",
		mpesaCallbackUrl: "",
		defaultUploadKbps: 1024,
		ispTotalKbps: 30720,
		perUserMaxKbps: 5120,
		maxUsers: 25,
		oneDevicePerPackage: true,
		operatorPassword: "",
		radiusEnabled: false,
		radiusSecret: "",
		radiusAuthPort: 1812,
		radiusAcctPort: 1813
	});
	(0, import_react.useEffect)(() => {
		if (!q.data) return;
		setForm((f) => ({
			...f,
			hotspotName: q.data.hotspotName,
			currency: q.data.currency,
			welcomeMessage: q.data.welcomeMessage,
			mpesaShortcode: q.data.mpesaShortcode ?? "",
			mpesaEnv: q.data.mpesaEnv === "production" ? "production" : "sandbox",
			mpesaCallbackUrl: q.data.mpesaCallbackUrl ?? "",
			defaultUploadKbps: q.data.defaultUploadKbps,
			ispTotalKbps: q.data.ispTotalKbps,
			perUserMaxKbps: q.data.perUserMaxKbps,
			maxUsers: q.data.maxUsers,
			oneDevicePerPackage: q.data.oneDevicePerPackage
		}));
	}, [q.data]);
	const save = useMutation({
		mutationFn: () => saveSettingsAdmin({ data: form }),
		onSuccess: () => {
			toast.success("Settings saved");
			qc.invalidateQueries({ queryKey: ["settings"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mx-auto max-w-2xl space-y-5",
		onSubmit: (e) => {
			e.preventDefault();
			save.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Settings"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Secrets are stored server-side and never sent back to the browser."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "Captive portal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Hotspot name",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.hotspotName,
							onChange: (e) => setForm({
								...form,
								hotspotName: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Welcome message",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.welcomeMessage,
							onChange: (e) => setForm({
								...form,
								welcomeMessage: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Currency",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.currency,
							onChange: (e) => setForm({
								...form,
								currency: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Default upload (kbps)",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: 64,
							value: form.defaultUploadKbps,
							onChange: (e) => setForm({
								...form,
								defaultUploadKbps: Number(e.target.value)
							})
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "ISP capacity"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm leading-relaxed text-muted",
						children: "Pool for Airtel 5G, Safaricom 5G, Starlink, fibre and any other WAN. TelNet caps each customer at the per-user maximum even if the package is higher, and holds new activations when the hotspot is full."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Total available (Mbps)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									min: 1,
									step: 1,
									value: Math.round(form.ispTotalKbps / 1024),
									onChange: (e) => setForm({
										...form,
										ispTotalKbps: Math.max(1, Number(e.target.value) || 1) * 1024
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Per-user maximum (Mbps)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									min: 1,
									step: 1,
									value: Math.round(form.perUserMaxKbps / 1024),
									onChange: (e) => setForm({
										...form,
										perUserMaxKbps: Math.max(1, Number(e.target.value) || 1) * 1024
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Maximum connected users",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									min: 1,
									max: 500,
									value: form.maxUsers,
									onChange: (e) => setForm({
										...form,
										maxUsers: Number(e.target.value) || 1
									})
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-subtle",
						children: "Default hotspot pool: 30 Mbps total · 5 Mbps per user · 20–30 seats."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "Device sharing"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "One device per package",
					hint: "When a customer connects, the package is bound to that phone. A second device is blocked with “This package is already in use on another device.” MikroTik hotspot profile telnet-1dev uses shared-users=1 so the router enforces the same limit.",
					checked: form.oneDevicePerPackage,
					onCheckedChange: (v) => setForm({
						...form,
						oneDevicePerPackage: v
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "M-Pesa Daraja — live"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No demo STK. Payments only go out when these credentials are saved. Use sandbox for Daraja test numbers, production for live till."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							q.data?.hasMpesaKey ? "Consumer key on file." : "No consumer key stored.",
							" ",
							q.data?.hasMpesaSecret ? "Secret on file." : "No secret stored.",
							" ",
							q.data?.hasMpesaPasskey ? "Passkey on file." : "No passkey stored."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Environment",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: "h-10 w-full rounded-md border border-border bg-raised px-3 text-sm",
							value: form.mpesaEnv,
							onChange: (e) => setForm({
								...form,
								mpesaEnv: e.target.value === "production" ? "production" : "sandbox"
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "sandbox",
								children: "Sandbox (test)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "production",
								children: "Production (live)"
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Shortcode / Till",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.mpesaShortcode,
							onChange: (e) => setForm({
								...form,
								mpesaShortcode: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Callback URL (public HTTPS)",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "https://your-domain.com/api/mpesa/callback",
							value: form.mpesaCallbackUrl,
							onChange: (e) => setForm({
								...form,
								mpesaCallbackUrl: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Consumer key",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							autoComplete: "off",
							placeholder: "Leave blank to keep existing",
							value: form.mpesaConsumerKey,
							onChange: (e) => setForm({
								...form,
								mpesaConsumerKey: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Consumer secret",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							autoComplete: "off",
							placeholder: "Leave blank to keep existing",
							value: form.mpesaConsumerSecret,
							onChange: (e) => setForm({
								...form,
								mpesaConsumerSecret: e.target.value
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Passkey",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							autoComplete: "off",
							placeholder: "Leave blank to keep existing",
							value: form.mpesaPasskey,
							onChange: (e) => setForm({
								...form,
								mpesaPasskey: e.target.value
							})
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "MikroTik"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm leading-relaxed text-muted",
						children: "Add real routers on the Network page — host, REST user, password and hotspot server. Credentials never leave the server."
					}),
					q.data?.mikrotikHost ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-sm",
						children: [
							"Primary: ",
							q.data.mikrotikHost,
							q.data.mikrotikUser ? ` · ${q.data.mikrotikUser}` : ""
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-subtle",
						children: "No primary router registered yet."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin/network",
							children: "Open Network"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "RADIUS (multi-AP)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Central auth for all APs. Same package time across APs — no new bill on roam. Run ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "text-xs",
								children: "node scripts/radius-server.mjs"
							}),
							" in production or point FreeRADIUS at TelNet users."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: form.radiusEnabled,
							onChange: (e) => setForm({
								...form,
								radiusEnabled: e.target.checked
							})
						}), "Enable RADIUS"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Shared secret",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							value: form.radiusSecret,
							onChange: (e) => setForm({
								...form,
								radiusSecret: e.target.value
							}),
							placeholder: "Paste to update"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "Operator password"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Shared password for the operator console. Leave blank to keep the current password."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "New operator password (min 4 characters)",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							autoComplete: "new-password",
							value: form.operatorPassword,
							onChange: (e) => setForm({
								...form,
								operatorPassword: e.target.value
							}),
							placeholder: "Leave blank to keep unchanged"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				size: "lg",
				disabled: save.isPending,
				children: save.isPending ? "Saving…" : "Save settings"
			})
		]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		className: "mb-1.5 block",
		children: label
	}), children] });
}
function Toggle({ label, hint, checked, onCheckedChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm font-medium",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs leading-relaxed text-muted",
			children: hint
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			checked,
			onCheckedChange
		})]
	});
}
//#endregion
export { SettingsPage as component };
