import { o as __toESM } from "../_runtime.mjs";
import { t as formatPhoneDisplay } from "./phone-DB_r9zkq.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { g as Ellipsis } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as cn } from "./utils-DITYiIRO.mjs";
import { t as Badge } from "./badge-iIelHC8f.mjs";
import { r as SessionBadge, t as ActivationBadge } from "./status-badge-DGiBbKPl.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { i as formatRemaining, o as formatStamp, r as formatKes } from "./format-D87ri6cr.mjs";
import { i as SheetTitle, n as SheetContent, r as SheetHeader, t as Sheet } from "./sheet-CYzuTo6l.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-DGbpgz-6.mjs";
import { h as listPackagesAdmin, n as customerAction, p as listCustomersAdmin } from "./admin-B-jxD4aJ.mjs";
import { a as Root2, i as Portal2, n as Item2, o as Separator2, r as Label2, s as Trigger, t as Content2 } from "../_libs/@radix-ui/react-dropdown-menu+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/customers-D2DDlIta.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DropdownMenu = Root2;
var DropdownMenuTrigger = Trigger;
var DropdownMenuContent = import_react.forwardRef(({ className, sideOffset = 6, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	sideOffset,
	className: cn("z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface p-1 text-fg shadow-lift", className),
	...props
}) }));
DropdownMenuContent.displayName = "DropdownMenuContent";
var DropdownMenuItem = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2, {
	ref,
	className: cn("relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors focus:bg-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	...props
}));
DropdownMenuItem.displayName = "DropdownMenuItem";
var DropdownMenuSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator2, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-border", className),
	...props
}));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
var DropdownMenuLabel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label2, {
	ref,
	className: cn("px-2 py-1.5 text-xs font-medium text-muted", className),
	...props
}));
DropdownMenuLabel.displayName = "DropdownMenuLabel";
function CustomersPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomersAdmin()
	});
	const pkgs = useQuery({
		queryKey: ["packages"],
		queryFn: () => listPackagesAdmin()
	});
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const selected = q.data?.find((r) => r.customer.id === openId);
	const act = useMutation({
		mutationFn: (input) => customerAction({ data: input }),
		onSuccess: (res, vars) => {
			if (!res.ok) toast.error(res.error);
			else toast.success(vars.action === "releaseDevice" ? "Device released. Another phone can connect." : "Updated");
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["live"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Customers"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Disconnect, block, extend, release a bound device or retry activation without touching the ISP."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-surface",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Phone" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Package" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Payment" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Start" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Expiry" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Status" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Connection" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableBody, { children: (q.data ?? []).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "font-medium tabular-nums",
						children: formatPhoneDisplay(row.customer.phone)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: row.pack?.packageName ?? "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: row.paymentAmount != null ? formatKes(row.paymentAmount) : "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-muted",
						children: row.pack ? formatStamp(row.pack.startTime) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "text-muted",
						children: row.pack ? formatRemaining(row.pack.expiryTime) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: row.customer.status === "BLOCKED" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: "danger",
						children: "Blocked"
					}) : row.pack ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivationBadge, { status: row.pack.activationStatus }) : "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionBadge, { status: row.connectionStatus }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-4" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
						align: "end",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => setOpenId(row.customer.id),
								children: "View"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "disconnect"
								}),
								children: "Disconnect"
							}),
							row.pack?.boundDeviceToken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "releaseDevice"
								}),
								children: "Release device"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "retry"
								}),
								children: "Retry activation"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "extend",
									minutes: 60
								}),
								children: "Extend 1 hour"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
							row.customer.status === "BLOCKED" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "unblock"
								}),
								children: "Unblock"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "block"
								}),
								children: "Block"
							}),
							(pkgs.data ?? []).filter((p) => p.status === "ACTIVE").map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
								onClick: () => act.mutate({
									customerId: row.customer.id,
									action: "changePackage",
									packageId: p.id
								}),
								children: ["Change to ", p.name]
							}, p.id))
						]
					})] }) })
				] }, row.customer.id)) })] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: Boolean(selected),
				onOpenChange: () => setOpenId(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
					className: "font-display",
					children: formatPhoneDisplay(selected.customer.phone)
				}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-4 space-y-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Status",
							v: selected.customer.status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Package",
							v: selected.pack?.packageName ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Activation",
							v: selected.pack?.activationStatus ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Receipt",
							v: selected.mpesaTransactionId ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Expires",
							v: selected.pack ? formatStamp(selected.pack.expiryTime) : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Connection",
							v: selected.connectionStatus
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "Device",
							v: selected.pack?.boundDeviceToken ? "Bound to one device" : "Not bound"
						})
					]
				})] }) })
			})
		]
	});
}
function Row({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between gap-4 border-b border-border py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-subtle",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "text-right font-medium",
			children: v
		})]
	});
}
//#endregion
export { CustomersPage as component };
