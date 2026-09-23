import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as getOperatorSession } from "./public-D6kztkSL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/operator-_KXLRQpx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useOperatorSession() {
	const [isOperator, setIsOperator] = (0, import_react.useState)(false);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getOperatorSession().then((result) => {
			if (cancelled) return;
			setIsOperator(result.ok);
			setReady(true);
		}).catch((error) => {
			console.error("[operator] session check failed:", error);
			if (!cancelled) {
				setIsOperator(false);
				setReady(true);
			}
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
