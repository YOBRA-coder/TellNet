import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Badge } from "./badge-iIelHC8f.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, n as formatDuration, r as formatKes } from "./format-D87ri6cr.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-DGbpgz-6.mjs";
import { C as savePackage, a as deletePackage, h as listPackagesAdmin } from "./admin-B-jxD4aJ.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
import { t as Label } from "./label-e_QypvkD.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-BNli7mm5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/packages-CFInelWZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var empty = {
	name: "",
	price: 10,
	durationMinutes: 60,
	downloadKbps: 2048,
	uploadKbps: 1024,
	dataLimitMb: "",
	status: "ACTIVE"
};
function PackagesAdminPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["packages"],
		queryFn: () => listPackagesAdmin(),
		staleTime: 6e4
	});
	const [open, setOpen] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [form, setForm] = (0, import_react.useState)(empty);
	function startEdit(pkg) {
		if (pkg) {
			setEditing(pkg);
			setForm({
				name: pkg.name,
				price: pkg.price,
				durationMinutes: pkg.durationMinutes,
				downloadKbps: pkg.downloadKbps,
				uploadKbps: pkg.uploadKbps,
				dataLimitMb: pkg.dataLimitMb ?? "",
				status: pkg.status
			});
		} else {
			setEditing(null);
			setForm(empty);
		}
		setOpen(true);
	}
	const save = useMutation({
		mutationFn: () => savePackage({ data: {
			id: editing?.id,
			name: form.name,
			price: Number(form.price),
			durationMinutes: Number(form.durationMinutes),
			downloadKbps: Number(form.downloadKbps),
			uploadKbps: Number(form.uploadKbps),
			dataLimitMb: form.dataLimitMb === "" ? null : Number(form.dataLimitMb),
			status: form.status
		} }),
		onSuccess: () => {
			toast.success("Package saved");
			setOpen(false);
			qc.invalidateQueries({ queryKey: ["packages"] });
		}
	});
	const deactivate = useMutation({
		mutationFn: (id) => deletePackage({ data: { id } }),
		onSuccess: () => {
			toast.success("Package deactivated");
			qc.invalidateQueries({ queryKey: ["packages"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl font-semibold tracking-tight",
					children: "Packages"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Price, duration and speed are independent of which ISP is carrying traffic."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => startEdit(),
					children: "New package"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-surface",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Name" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Price" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Duration" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Speed" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Data" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Status" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableBody, { children: (q.data ?? []).map((pkg) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "font-medium",
						children: pkg.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
						className: "tabular-nums",
						children: formatKes(pkg.price)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: formatDuration(pkg.durationMinutes) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, { children: [
						formatSpeed(pkg.downloadKbps),
						" down · ",
						formatSpeed(pkg.uploadKbps),
						" up"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: pkg.dataLimitMb ? `${pkg.dataLimitMb} MB` : "Unlimited" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: pkg.status === "ACTIVE" ? "ok" : "neutral",
						children: pkg.status
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableCell, {
						className: "space-x-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => startEdit(pkg),
							children: "Edit"
						}), pkg.status === "ACTIVE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => deactivate.mutate(pkg.id),
							children: "Deactivate"
						})]
					})
				] }, pkg.id)) })] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open,
				onOpenChange: setOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: editing ? "Edit package" : "New package" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "grid gap-3 sm:grid-cols-2",
					onSubmit: (e) => {
						e.preventDefault();
						save.mutate();
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Name",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: form.name,
								onChange: (e) => setForm({
									...form,
									name: e.target.value
								}),
								required: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Price (KSh)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 0,
								value: form.price,
								onChange: (e) => setForm({
									...form,
									price: Number(e.target.value)
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Duration (minutes)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 1,
								value: form.durationMinutes,
								onChange: (e) => setForm({
									...form,
									durationMinutes: Number(e.target.value)
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Download (kbps)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 64,
								value: form.downloadKbps,
								onChange: (e) => setForm({
									...form,
									downloadKbps: Number(e.target.value)
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Upload (kbps)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 64,
								value: form.uploadKbps,
								onChange: (e) => setForm({
									...form,
									uploadKbps: Number(e.target.value)
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Data limit MB (blank = unlimited)",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 1,
								value: form.dataLimitMb,
								onChange: (e) => setForm({
									...form,
									dataLimitMb: e.target.value === "" ? "" : Number(e.target.value)
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, {
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: save.isPending,
								children: "Save package"
							})
						})
					]
				})] })
			})
		]
	});
}
function Field({ label, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			className: "mb-1.5 block",
			children: label
		}), children]
	});
}
//#endregion
export { PackagesAdminPage as component };
