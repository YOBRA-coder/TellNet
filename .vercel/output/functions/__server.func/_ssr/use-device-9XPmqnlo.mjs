import { o as __toESM } from "../_runtime.mjs";
import { i as readDevice, r as patchDevice } from "./device-CVNggkwc.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-device-9XPmqnlo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useDevice() {
	const [device, setDevice] = (0, import_react.useState)(() => typeof window === "undefined" ? null : readDevice());
	return {
		device,
		update: (0, import_react.useCallback)((patch) => {
			setDevice(patchDevice(patch));
		}, []),
		ready: device !== null
	};
}
//#endregion
export { useDevice as t };
