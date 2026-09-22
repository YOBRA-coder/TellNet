import { r as createServerFn } from "./ssr.mjs";
import { F as object, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/public-DBxIEVXF.js
var getPublicHome = createServerFn({ method: "GET" }).handler(createSsrRpc("244d425ccd23f160b70a11bc01b11b7ccae447761c845aed8cc8199b80bf9444"));
/** Shared operator password login — no email / OAuth. */
var loginOperator = createServerFn({ method: "POST" }).validator((data) => object({ password: string().min(1).max(200) }).parse(data)).handler(createSsrRpc("f3b99ec428423aa386239032ea6be5249734d42ceb72d5186f3dc9128938e576"));
var logoutOperator = createServerFn({ method: "POST" }).handler(createSsrRpc("c25e087b6af86a9c203198818f135284ddb17b05a94cee458ca7158e4daee190"));
//#endregion
export { loginOperator as n, logoutOperator as r, getPublicHome as t };
