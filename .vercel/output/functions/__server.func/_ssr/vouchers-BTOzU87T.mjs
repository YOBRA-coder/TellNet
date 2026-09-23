import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { _ as listVouchersAdmin, h as listPackagesAdmin, o as generateVouchersAdmin } from "./admin-bWqHMeNH.mjs";
import { t as Card } from "./card-Bux5iIh_.mjs";
import { t as Input } from "./input-KXgmVYwX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vouchers-BTOzU87T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VouchersPage() {
	const qc = useQueryClient();
	const pkgs = useQuery({
		queryKey: ["packages"],
		queryFn: () => listPackagesAdmin()
	});
	const list = useQuery({
		queryKey: ["vouchers"],
		queryFn: () => listVouchersAdmin()
	});
	const [packageId, setPackageId] = (0, import_react.useState)("");
	const [count, setCount] = (0, import_react.useState)(10);
	const [batch, setBatch] = (0, import_react.useState)("");
	const [lastCodes, setLastCodes] = (0, import_react.useState)([]);
	const gen = useMutation({
		mutationFn: () => generateVouchersAdmin({ data: {
			packageId: packageId || (pkgs.data?.[0]?.id ?? ""),
			count,
			batchLabel: batch || void 0
		} }),
		onSuccess: (res) => {
			if (res.ok) {
				setLastCodes(res.codes);
				toast.success(`Created ${res.codes.length} vouchers`);
				qc.invalidateQueries({ queryKey: ["vouchers"] });
			} else toast.error("Could not generate vouchers");
		},
		onError: () => toast.error("Could not generate vouchers")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-4xl space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Vouchers"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Offline codes for cash desks. Redeem on the portal without STK."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold",
						children: "Generate batch"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "text-sm",
								children: ["Package", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									className: "mt-1 w-full rounded-md border border-border bg-bg px-3 py-2",
									value: packageId || pkgs.data?.[0]?.id || "",
									onChange: (e) => setPackageId(e.target.value),
									children: (pkgs.data ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: p.id,
										children: [
											p.name,
											" — KES ",
											p.price
										]
									}, p.id))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "text-sm",
								children: ["Count", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									min: 1,
									max: 200,
									className: "mt-1",
									value: count,
									onChange: (e) => setCount(Number(e.target.value) || 1)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "text-sm",
								children: ["Batch label", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1",
									value: batch,
									onChange: (e) => setBatch(e.target.value),
									placeholder: "Shop till 1"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: gen.isPending || !(packageId || pkgs.data?.[0]?.id),
						onClick: () => gen.mutate(),
						children: gen.isPending ? "Generating…" : "Generate codes"
					}),
					lastCodes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "max-h-40 overflow-auto rounded-md bg-raised p-3 text-xs",
						children: lastCodes.join("\n")
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "overflow-x-auto p-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "border-b border-border text-xs uppercase text-subtle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Code"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Package"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Batch"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: (list.data ?? []).map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2 font-mono text-xs",
								children: v.code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2",
								children: v.packageName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2",
								children: v.status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2 text-muted",
								children: v.batchLabel ?? "—"
							})
						]
					}, v.id)) })]
				})
			})
		]
	});
}
//#endregion
export { VouchersPage as component };
