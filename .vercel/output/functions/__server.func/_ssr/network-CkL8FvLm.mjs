import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { d as Radio, f as Plus, n as Wifi, s as Smartphone, u as Router } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as cn } from "./utils-DITYiIRO.mjs";
import { t as Badge } from "./badge-iIelHC8f.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, o as formatStamp } from "./format-D87ri6cr.mjs";
import { t as CAMOUFLAGE } from "./camouflage-COQbritr.mjs";
import { n as parseRouterHost } from "./mikrotik-host-LARBMA8_.mjs";
import { D as testMikroTik, E as setPrimaryMikroTik, S as saveMikroTik, T as setIspStatus, c as getNetwork, i as deleteMikroTik, r as deleteIsp, t as applyCamouflage, v as refreshMikroTiks, x as saveIsp } from "./admin-bWqHMeNH.mjs";
import { t as Card } from "./card-Bux5iIh_.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, r as DialogDescription, t as Dialog } from "./dialog-BNli7mm5.mjs";
import { t as Switch } from "./switch-BSLwVIRs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/network-CkL8FvLm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-24 w-full rounded-md border border-border bg-raised px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50", className),
		ref,
		...props
	});
});
Textarea.displayName = "Textarea";
var emptyRouter = {
	name: "",
	host: "",
	port: 80,
	apiUser: "admin",
	apiPassword: "",
	hotspotName: "hotspot1",
	ssl: false,
	insecureTls: false,
	apiMode: "rest",
	apiPort: 8728,
	makePrimary: true
};
var emptyIsp = {
	id: "",
	name: "",
	type: "AIRTEL",
	interfaceName: "",
	mikrotikId: "",
	totalKbps: 30720,
	perUserMaxKbps: 5120,
	maxUsers: 25
};
function NetworkPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["network"],
		queryFn: () => getNetwork(),
		refetchInterval: 45e3,
		staleTime: 2e4,
		placeholderData: (prev) => prev
	});
	const [open, setOpen] = (0, import_react.useState)(false);
	const [ispOpen, setIspOpen] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [form, setForm] = (0, import_react.useState)(emptyRouter);
	const [ispForm, setIspForm] = (0, import_react.useState)(emptyIsp);
	const [probe, setProbe] = (0, import_react.useState)(null);
	const [scriptOpen, setScriptOpen] = (0, import_react.useState)(false);
	const [scriptText, setScriptText] = (0, import_react.useState)("");
	const [scriptTitle, setScriptTitle] = (0, import_react.useState)("");
	const d = q.data;
	const routers = d?.mikrotiks ?? [];
	const isps = d?.isps ?? [];
	function startAdd(mt) {
		setProbe(null);
		if (mt) {
			const parsed = parseRouterHost(mt.host);
			setEditing(mt);
			setForm({
				name: mt.name,
				host: parsed.address,
				port: parsed.port,
				apiUser: mt.apiUser,
				apiPassword: "",
				hotspotName: mt.hotspotName,
				apiMode: mt.apiMode === "api6" ? "api6" : "rest",
				apiPort: mt.apiPort || 8728,
				ssl: mt.ssl,
				insecureTls: mt.insecureTls,
				makePrimary: mt.isPrimary
			});
		} else {
			setEditing(null);
			setForm({
				...emptyRouter,
				makePrimary: routers.length === 0
			});
		}
		setOpen(true);
	}
	const save = useMutation({
		mutationFn: () => saveMikroTik({ data: {
			id: editing?.id,
			name: form.name,
			host: form.host,
			port: form.port,
			apiUser: form.apiUser,
			apiPassword: form.apiPassword || void 0,
			hotspotName: form.hotspotName,
			ssl: form.ssl,
			apiMode: form.apiMode,
			apiPort: form.apiMode === "api6" ? form.apiPort || form.port || 8728 : form.port,
			insecureTls: form.insecureTls,
			makePrimary: form.makePrimary
		} }),
		onSuccess: (res) => {
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			setProbe(res.probe);
			if (res.probe.hotspotServers.length) setForm((f) => res.probe.hotspotServers.includes(f.hotspotName) ? f : {
				...f,
				hotspotName: res.probe.hotspotServers[0] ?? f.hotspotName
			});
			toast.success(res.live ? "Router reachable. Activations go to this live MikroTik." : res.probe.ok ? "Router saved and reachable." : "Router saved. REST probe failed — check IP → Services → www.");
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["settings"] });
			if (res.probe.ok) setOpen(false);
		},
		onError: () => toast.error("Could not save the router.")
	});
	const test = useMutation({
		mutationFn: (input) => {
			if ("id" in input && input.id) return testMikroTik({ data: { id: input.id } });
			const f = input;
			return testMikroTik({ data: {
				host: f.host,
				port: f.port,
				apiUser: f.apiUser,
				apiPassword: f.apiPassword || void 0,
				hotspotName: f.hotspotName,
				ssl: f.ssl,
				apiMode: f.apiMode,
				apiPort: f.apiMode === "api6" ? f.apiPort || f.port || 8728 : f.port,
				insecureTls: f.insecureTls,
				id: editing?.id
			} });
		},
		onSuccess: (res) => {
			if (res.probe) setProbe(res.probe);
			if (res.ok) toast.success("RouterOS REST is reachable.");
			else toast.error(res.error ?? "Unreachable.");
			if (res.probe?.hotspotServers.length) setForm((f) => res.probe.hotspotServers.includes(f.hotspotName) ? f : {
				...f,
				hotspotName: res.probe.hotspotServers[0] ?? f.hotspotName
			});
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	const primary = useMutation({
		mutationFn: (id) => setPrimaryMikroTik({ data: { id } }),
		onSuccess: (res) => {
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			toast.success("This router now handles live activations.");
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["settings"] });
		}
	});
	const remove = useMutation({
		mutationFn: (id) => deleteMikroTik({ data: { id } }),
		onSuccess: (res) => {
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			toast.success("Router removed.");
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	useMutation({
		mutationFn: () => refreshMikroTiks(),
		onSuccess: (res) => {
			toast.success(res.total === 0 ? "No routers to probe." : `Probed ${res.total} router${res.total === 1 ? "" : "s"} · ${res.online} online.`);
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: () => toast.error("Could not probe routers.")
	});
	const setStatus = useMutation({
		mutationFn: (input) => setIspStatus({ data: input }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const savePath = useMutation({
		mutationFn: (input) => saveIsp({ data: input }),
		onSuccess: (res) => {
			if (!res.ok) {
				toast.error("Could not save this path.");
				return;
			}
			toast.success("ISP path saved.");
			setIspOpen(false);
			setIspForm(emptyIsp);
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const removePath = useMutation({
		mutationFn: (id) => deleteIsp({ data: { id } }),
		onSuccess: () => {
			toast.success("ISP path removed.");
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	const disguise = useMutation({
		mutationFn: (input) => applyCamouflage({ data: input }),
		onSuccess: (res, vars) => {
			if (!res.ok) {
				toast.error("error" in res ? res.error : "Could not apply camouflage.");
				return;
			}
			setScriptTitle(`${CAMOUFLAGE[vars.kind].label} · ${res.interfaceName}`);
			setScriptText(res.script);
			if (res.live && !res.error) toast.success(`WAN now appears as ${CAMOUFLAGE[vars.kind].label} (${res.mac}).`);
			else {
				toast.message(res.error ?? "REST write skipped. Copy the Terminal script.");
				setScriptOpen(true);
			}
			qc.invalidateQueries({ queryKey: ["network"] });
		},
		onError: () => toast.error("Could not apply camouflage.")
	});
	function alreadyIsp(interfaceName) {
		return isps.some((i) => i.interfaceName === interfaceName);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl font-semibold tracking-tight",
					children: "Network"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-muted",
					children: "Register a real MikroTik with RouterOS REST. TelNet never load-balances WANs — it only activates users. When a path drops, the same package stays valid."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => startAdd(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add router"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Router, { className: "size-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "Add routers"
					})]
				}), routers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg font-semibold",
							children: "Add a real MikroTik"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-lg text-sm leading-relaxed text-muted",
							children: "Register any RouterOS 7 box — hAP, RB750, CCR, HEX, LTE. TelNet supports RouterOS 7 REST (www) and RouterOS 6 binary API (8728) — pick below when adding a router. After it is reachable, one-click camouflage can make the WAN look like a phone or PC to the ISP."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
							className: "mt-4 max-w-lg space-y-2 text-sm text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "1. ROS7: IP → Services → www/www-ssl. ROS6: IP → Services → api (8728)." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "2. Create a user in the full group, or a group that can write hotspot users." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "3. If this app is in the cloud, expose REST with a tunnel or public IP — 192.168.88.1 will not route from here." })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-5",
							onClick: () => startAdd(),
							children: "Add router"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 lg:grid-cols-2",
					children: routers.map((mt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RouterCard, {
						mt,
						isps,
						onTest: () => test.mutate({ id: mt.id }),
						onPrimary: () => primary.mutate(mt.id),
						onEdit: () => startAdd(mt),
						onRemove: () => remove.mutate(mt.id),
						testing: test.isPending,
						promoting: primary.isPending,
						removing: remove.isPending,
						disguising: disguise.isPending,
						onCamouflage: (kind, iface) => disguise.mutate({
							routerId: mt.id,
							kind,
							interfaceName: iface
						}),
						onImportIface: (iface) => {
							if (alreadyIsp(iface.name)) {
								toast.message("That interface is already an ISP path.");
								return;
							}
							savePath.mutate({
								name: iface.name,
								type: "OTHER",
								interfaceName: iface.name,
								mikrotikId: mt.id,
								status: iface.running ? "ONLINE" : "OFFLINE",
								totalKbps: 30720,
								perUserMaxKbps: 5120,
								maxUsers: 25
							});
						}
					}, mt.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, { className: "size-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-lg font-semibold",
							children: "ISP paths"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							setIspForm(emptyIsp);
							setIspOpen(true);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add ISP"]
					})]
				}), isps.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "p-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No ISP paths yet. Add Starlink, Airtel, Safaricom or fibre so the dashboard can show WAN health. TelNet still will not steer traffic."
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 md:grid-cols-3",
					children: isps.map((isp) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs uppercase tracking-wide text-subtle",
									children: isp.type
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "mt-1 font-display text-xl font-semibold",
									children: isp.name
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: isp.status === "ONLINE" ? "ok" : isp.status === "DEGRADED" ? "warn" : "danger",
									children: isp.status
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-sm text-muted",
								children: [isp.interfaceName ?? "WAN", isp.latencyMs != null ? ` · ${isp.latencyMs} ms` : ""]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm tabular-nums text-fg",
								children: [
									formatSpeed(isp.totalKbps),
									" pool · ",
									formatSpeed(isp.perUserMaxKbps),
									"/user · ",
									isp.maxUsers,
									" seats"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-subtle",
								children: d ? `${d.onlineUsers} online now` : ""
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex flex-wrap gap-2",
								children: [
									[
										"ONLINE",
										"DEGRADED",
										"OFFLINE"
									].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: isp.status === s ? "accent" : "outline",
										onClick: () => setStatus.mutate({
											id: isp.id,
											status: s
										}),
										children: s
									}, s)),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => {
											setIspForm({
												id: isp.id,
												name: isp.name,
												type: [
													"STARLINK",
													"AIRTEL",
													"SAFARICOM",
													"FIBRE",
													"LTE",
													"OTHER"
												].includes(isp.type) ? isp.type : "OTHER",
												interfaceName: isp.interfaceName ?? "",
												mikrotikId: isp.mikrotikId ?? "",
												totalKbps: isp.totalKbps,
												perUserMaxKbps: isp.perUserMaxKbps,
												maxUsers: isp.maxUsers
											});
											setIspOpen(true);
										},
										children: "Capacity"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => removePath.mutate(isp.id),
										children: "Remove"
									})
								]
							})
						]
					}, isp.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "Events"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-4",
					children: (d?.events ?? []).map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "border-b border-border pb-3 last:border-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs uppercase tracking-wide text-subtle",
							children: [
								e.eventType.replaceAll("_", " "),
								" · ",
								formatStamp(e.createdAt)
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed",
							children: e.description
						})]
					}, e.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open,
				onOpenChange: setOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "max-h-[90dvh] overflow-y-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editing ? "Edit MikroTik" : "Add MikroTik" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "RouterOS 7 REST — IP → Services → www (80) or www-ssl (443). Not the Winbox API on 8728. Credentials stay on the server." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "space-y-3",
						onSubmit: (e) => {
							e.preventDefault();
							save.mutate();
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-border p-3 space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium",
										children: "RouterOS version"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: "v7 uses REST (www). v6 uses the binary API on port 8728."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: `rounded-full px-3 py-1.5 text-xs font-medium border ${form.apiMode === "rest" ? "border-accent bg-accent/10 text-fg" : "border-border text-muted"}`,
											onClick: () => setForm({
												...form,
												apiMode: "rest",
												port: form.ssl ? 443 : 80
											}),
											children: "RouterOS 7 (REST)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: `rounded-full px-3 py-1.5 text-xs font-medium border ${form.apiMode === "api6" ? "border-accent bg-accent/10 text-fg" : "border-border text-muted"}`,
											onClick: () => setForm({
												...form,
												apiMode: "api6",
												port: 8728,
												apiPort: 8728,
												ssl: false
											}),
											children: "RouterOS 6 (API 8728)"
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Name",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									required: true,
									placeholder: "Main RB750",
									value: form.name,
									onChange: (e) => setForm({
										...form,
										name: e.target.value
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-[1fr_7rem]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Address",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										required: true,
										placeholder: "192.168.88.1",
										value: form.host,
										onChange: (e) => setForm({
											...form,
											host: e.target.value
										})
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "REST port",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										required: true,
										type: "number",
										min: 1,
										max: 65535,
										value: form.port,
										onChange: (e) => setForm({
											...form,
											port: Number(e.target.value) || 80
										})
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "User",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										required: true,
										value: form.apiUser,
										onChange: (e) => setForm({
											...form,
											apiUser: e.target.value
										})
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Password",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "password",
										autoComplete: "off",
										required: !editing,
										placeholder: editing ? "Leave blank to keep" : "",
										value: form.apiPassword,
										onChange: (e) => setForm({
											...form,
											apiPassword: e.target.value
										})
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Hotspot server",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: form.hotspotName,
									onChange: (e) => setForm({
										...form,
										hotspotName: e.target.value
									})
								})
							}),
							probe && probe.hotspotServers.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5",
								children: probe.hotspotServers.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-fg",
									onClick: () => setForm({
										...form,
										hotspotName: name
									}),
									children: name
								}, name))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: "HTTPS (www-ssl)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "REST on 443 instead of 80."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: form.ssl,
									onCheckedChange: (v) => setForm({
										...form,
										ssl: v,
										port: form.port === 80 || form.port === 443 ? v ? 443 : 80 : form.port
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: "Allow self-signed TLS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "Needed for most RouterOS certificates."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: form.insecureTls,
									onCheckedChange: (v) => setForm({
										...form,
										insecureTls: v
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: "Primary router"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "Live activations and hotspot users are created on this router."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: form.makePrimary,
									onCheckedChange: (v) => setForm({
										...form,
										makePrimary: v
									})
								})]
							}),
							probe && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: probe.ok ? "rounded-lg border border-ok/20 bg-ok/10 px-3 py-2 text-sm text-ok" : "rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger",
								children: probe.ok ? `Reachable${probe.identity ? ` · ${probe.identity}` : ""}${probe.version ? ` · ${probe.version}` : ""}${probe.interfaces.length ? ` · ${probe.interfaces.filter((i) => i.running).length} interfaces up` : ""}` : probe.error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								disabled: test.isPending || !form.host || !form.apiUser,
								onClick: () => test.mutate(form),
								children: test.isPending ? "Testing…" : "Test REST"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: save.isPending,
								children: save.isPending ? "Saving…" : editing ? "Save router" : "Add router"
							})] })
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: ispOpen,
				onOpenChange: setIspOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: ispForm.id ? "Edit ISP path" : "Add ISP path" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Monitoring plus pool caps. MikroTik still owns failover. Typical 5G pack: 30 Mbps total, 5 Mbps per user, 20–30 seats." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "space-y-3",
					onSubmit: (e) => {
						e.preventDefault();
						savePath.mutate({
							id: ispForm.id || void 0,
							name: ispForm.name,
							type: ispForm.type,
							interfaceName: ispForm.interfaceName || void 0,
							mikrotikId: ispForm.mikrotikId || void 0,
							totalKbps: ispForm.totalKbps,
							perUserMaxKbps: ispForm.perUserMaxKbps,
							maxUsers: ispForm.maxUsers
						});
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Name",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								required: true,
								placeholder: "Starlink",
								value: ispForm.name,
								onChange: (e) => setIspForm({
									...ispForm,
									name: e.target.value
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Type",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm",
								value: ispForm.type,
								onChange: (e) => {
									const type = e.target.value;
									const mobile = type === "AIRTEL" || type === "SAFARICOM" || type === "LTE";
									setIspForm({
										...ispForm,
										type,
										totalKbps: mobile ? 30720 : ispForm.totalKbps,
										maxUsers: mobile ? 25 : ispForm.maxUsers
									});
								},
								children: [
									"STARLINK",
									"AIRTEL",
									"SAFARICOM",
									"FIBRE",
									"LTE",
									"OTHER"
								].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: t,
									children: t
								}, t))
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Router interface (optional)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "ether1",
								value: ispForm.interfaceName,
								onChange: (e) => setIspForm({
									...ispForm,
									interfaceName: e.target.value
								})
							})
						}),
						routers.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "MikroTik",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm",
								value: ispForm.mikrotikId,
								onChange: (e) => setIspForm({
									...ispForm,
									mikrotikId: e.target.value
								}),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "Any / unassigned"
								}), routers.map((mt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: mt.id,
									children: mt.name
								}, mt.id))]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Total (Mbps)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										min: 1,
										value: Math.round(ispForm.totalKbps / 1024),
										onChange: (e) => setIspForm({
											...ispForm,
											totalKbps: Math.max(1, Number(e.target.value) || 1) * 1024
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Per user (Mbps)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										min: 1,
										value: Math.round(ispForm.perUserMaxKbps / 1024),
										onChange: (e) => setIspForm({
											...ispForm,
											perUserMaxKbps: Math.max(1, Number(e.target.value) || 1) * 1024
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Max users",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										min: 1,
										max: 500,
										value: ispForm.maxUsers,
										onChange: (e) => setIspForm({
											...ispForm,
											maxUsers: Number(e.target.value) || 1
										})
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: savePath.isPending,
							children: savePath.isPending ? "Saving…" : ispForm.id ? "Save path" : "Add path"
						}) })
					]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: scriptOpen,
				onOpenChange: setScriptOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: scriptTitle || "Terminal script" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "REST could not write the identity. Paste this into Winbox Terminal so the WAN still looks like a phone or PC to the ISP." })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						readOnly: true,
						className: "min-h-40 font-mono text-xs",
						value: scriptText
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: async () => {
							try {
								await navigator.clipboard.writeText(scriptText);
								toast.success("Script copied.");
							} catch {
								toast.message("Copy from the box above.");
							}
						},
						children: "Copy script"
					}) })
				] })
			})
		]
	});
}
function RouterCard({ mt, isps, onTest, onPrimary, onEdit, onRemove, onImportIface, onCamouflage, testing, promoting, removing, disguising }) {
	const [wan, setWan] = (0, import_react.useState)(mt.camouflageInterface || mt.interfaces.find((i) => i.running)?.name || mt.interfaces[0]?.name || "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs uppercase tracking-wide text-subtle",
						children: [mt.boardName ?? "RouterOS", mt.isPrimary ? " · Primary" : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-1 font-display text-xl font-semibold",
						children: mt.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-mono text-xs text-muted",
						children: mt.host
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: mt.status === "ONLINE" ? "ok" : mt.status === "OFFLINE" ? "danger" : "neutral",
					children: mt.status
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-4 grid grid-cols-2 gap-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs uppercase tracking-wide text-subtle",
						children: "Identity"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-0.5",
						children: mt.identity ?? "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs uppercase tracking-wide text-subtle",
						children: "Version"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-0.5",
						children: mt.version ?? "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs uppercase tracking-wide text-subtle",
						children: "Hotspot"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
						className: "mt-0.5",
						children: [
							mt.hotspotName,
							" · ",
							mt.apiMode === "api6" ? "ROS6 API" : "ROS7 REST"
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs uppercase tracking-wide text-subtle",
						children: "CPU"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-0.5",
						children: mt.cpuLoad == null ? "—" : `${mt.cpuLoad}%`
					})] })
				]
			}),
			mt.interfaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-1.5",
				children: mt.interfaces.slice(0, 8).map((iface) => {
					const linked = isps.some((i) => i.interfaceName === iface.name);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-muted",
							children: [iface.name, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "ml-2 uppercase tracking-wide text-subtle",
								children: [iface.type, iface.running ? " · up" : " · down"]
							})]
						}), !linked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-accent hover:text-fg",
							onClick: () => onImportIface(iface),
							children: "Add as ISP"
						})]
					}, iface.name);
				})
			}),
			mt.lastError && mt.status !== "ONLINE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-danger",
				children: mt.lastError
			}),
			mt.lastPingAt && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-subtle",
				children: ["Last probe ", formatStamp(mt.lastPingAt)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-lg border border-border p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: "WAN camouflage"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-muted",
						children: "One click makes this MikroTik look like an iPhone, Android phone or PC to the ISP — identity, DHCP hostname, MAC OUI and TTL."
					}),
					(mt.interfaces.length > 0 || wan) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-2 block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] uppercase tracking-wide text-subtle",
							children: "WAN interface"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: "mt-1 flex h-9 w-full rounded-md border border-border bg-raised px-2 text-xs",
							value: wan,
							onChange: (e) => setWan(e.target.value),
							children: [mt.interfaces.length === 0 && wan ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: wan,
								children: wan
							}) : null, mt.interfaces.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: i.name,
								children: [i.name, i.running ? " · up" : ""]
							}, i.name))]
						})]
					}),
					mt.camouflage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-accent",
						children: [
							"Appearing as ",
							CAMOUFLAGE[mt.camouflage].label,
							mt.camouflageMac ? ` · ${mt.camouflageMac}` : "",
							mt.camouflageInterface ? ` on ${mt.camouflageInterface}` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [
							"IPHONE",
							"ANDROID",
							"PC"
						].map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: mt.camouflage === kind ? "accent" : "outline",
							disabled: disguising,
							onClick: () => onCamouflage(kind, wan || void 0),
							children: CAMOUFLAGE[kind].label
						}, kind))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: onTest,
						disabled: testing,
						children: "Test REST"
					}),
					!mt.isPrimary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "accent",
						onClick: onPrimary,
						disabled: promoting,
						children: "Use for activations"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: onEdit,
						children: "Edit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "danger",
						onClick: onRemove,
						disabled: removing,
						children: "Remove"
					})
				]
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
//#endregion
export { NetworkPage as component };
