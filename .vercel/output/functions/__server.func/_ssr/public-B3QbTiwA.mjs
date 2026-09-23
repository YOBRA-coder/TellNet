import { r as createServerFn } from "./ssr.mjs";
import { F as object, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { s as mapIsp, t as getSettings, u as mapPackage } from "./settings.server-DGdR6vBM.mjs";
import { t as createOperatorSession } from "./operator-session.server--pSBR9Kb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/public-B3QbTiwA.js
var getPublicHome_createServerFn_handler = createServerRpc({
	id: "244d425ccd23f160b70a11bc01b11b7ccae447761c845aed8cc8199b80bf9444",
	name: "getPublicHome",
	filename: "src/lib/fn/public.ts"
}, (opts) => getPublicHome.__executeServer(opts));
var getPublicHome = createServerFn({ method: "GET" }).handler(getPublicHome_createServerFn_handler, async () => {
	const sql = await getSql();
	const settings = await getSettings();
	const packages = (await sql`
      select * from packages where status = 'ACTIVE' order by sort_order, price
    `).map(mapPackage);
	const isps = (await sql`select * from isps order by sort_order`).map(mapIsp);
	return {
		hotspotName: settings.hotspotName,
		welcomeMessage: settings.welcomeMessage,
		currency: settings.currency,
		demoMode: false,
		packages,
		internetUp: isps.some((i) => i.status !== "OFFLINE")
	};
});
var loginOperator_createServerFn_handler = createServerRpc({
	id: "f3b99ec428423aa386239032ea6be5249734d42ceb72d5186f3dc9128938e576",
	name: "loginOperator",
	filename: "src/lib/fn/public.ts"
}, (opts) => loginOperator.__executeServer(opts));
var loginOperator = createServerFn({ method: "POST" }).validator((data) => object({ password: string().min(1).max(200) }).parse(data)).handler(loginOperator_createServerFn_handler, async ({ data }) => {
	const expected = ((await (await getSql())`
        select operator_password from settings where id = 'default' limit 1
      `)[0]?.operator_password || "telnet-admin").trim();
	if (data.password !== expected) return {
		ok: false,
		error: "Incorrect operator password."
	};
	await createOperatorSession();
	return { ok: true };
});
var getOperatorSession_createServerFn_handler = createServerRpc({
	id: "772500541de960e3beaf3d44e35d6833e6fb1cc36fa9be510bd398136ce156ad",
	name: "getOperatorSession",
	filename: "src/lib/fn/public.ts"
}, (opts) => getOperatorSession.__executeServer(opts));
var getOperatorSession = createServerFn({ method: "GET" }).handler(getOperatorSession_createServerFn_handler, async () => {
	const { hasOperatorSession } = await import("./operator-session.server--pSBR9Kb.mjs").then((n) => n.r).then((n) => n.r);
	return { ok: await hasOperatorSession() };
});
var logoutOperator_createServerFn_handler = createServerRpc({
	id: "c25e087b6af86a9c203198818f135284ddb17b05a94cee458ca7158e4daee190",
	name: "logoutOperator",
	filename: "src/lib/fn/public.ts"
}, (opts) => logoutOperator.__executeServer(opts));
var logoutOperator = createServerFn({ method: "POST" }).handler(logoutOperator_createServerFn_handler, async () => {
	const { clearOperatorSession } = await import("./operator-session.server--pSBR9Kb.mjs").then((n) => n.r).then((n) => n.r);
	clearOperatorSession();
	return { ok: true };
});
//#endregion
export { getOperatorSession_createServerFn_handler, getPublicHome_createServerFn_handler, loginOperator_createServerFn_handler, logoutOperator_createServerFn_handler };
