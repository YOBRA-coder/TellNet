import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/operator-Blej1v2H.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useOperatorSession() {
	const [isOperator, setIsOperator] = (0, import_react.useState)(false);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		fetch("/api/operator/session", { credentials: "same-origin" }).then((res) => res.ok).catch(() => false).then((authenticated) => {
			if (cancelled) return;
			setIsOperator(authenticated);
			setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	return {
		isPending: !ready,
		isOperator
	};
}
//#endregion
export { useOperatorSession as t };
