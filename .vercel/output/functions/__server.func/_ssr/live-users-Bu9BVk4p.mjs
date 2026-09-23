import { t as formatPhoneDisplay } from "./phone-DB_r9zkq.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as SessionBadge } from "./status-badge-DGiBbKPl.mjs";
import { t as Button } from "./button-Dgy6fku4.mjs";
import { a as formatSpeed, i as formatRemaining, o as formatStamp, t as formatBytes } from "./format-D87ri6cr.mjs";
import { a as TableHeader, i as TableHead, n as TableBody, o as TableRow, r as TableCell, t as Table } from "./table-DGbpgz-6.mjs";
import { d as kickLiveUser, m as listLiveUsers } from "./admin-bWqHMeNH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/live-users-Bu9BVk4p.js
var import_jsx_runtime = require_jsx_runtime();
function LiveUsersPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["live"],
		queryFn: () => listLiveUsers(),
		refetchInterval: 8e3
	});
	const kick = useMutation({
		mutationFn: (sessionId) => kickLiveUser({ data: { sessionId } }),
		onSuccess: () => {
			toast.success("Disconnected");
			qc.invalidateQueries({ queryKey: ["live"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-semibold tracking-tight",
			children: "Live users"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "Currently authorised on the hotspot. Disconnecting ends the session, not the paid package."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "overflow-hidden rounded-xl border border-border bg-surface",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Table, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Phone" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "IP" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Package" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Speed" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Started" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Remaining" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Down" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Up" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, { children: "Status" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHead, {})
			] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableBody, { children: [(q.data ?? []).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableRow, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
				colSpan: 10,
				className: "py-10 text-center text-muted",
				children: "No one is online right now."
			}) }), (q.data ?? []).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableRow, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "font-medium tabular-nums",
					children: formatPhoneDisplay(u.phone)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "font-mono text-xs",
					children: u.ipAddress ?? "—"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: u.packageName }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: formatSpeed(u.speedLimitKbps) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "text-muted",
					children: formatStamp(u.sessionStart)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "tabular-nums",
					children: formatRemaining(u.expiryTime)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "tabular-nums",
					children: formatBytes(u.bytesDown)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, {
					className: "tabular-nums",
					children: formatBytes(u.bytesUp)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionBadge, { status: u.status }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableCell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => kick.mutate(u.sessionId),
					children: "Disconnect"
				}) })
			] }, u.sessionId))] })] })
		})]
	});
}
//#endregion
export { LiveUsersPage as component };
