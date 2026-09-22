import { r as createServerFn } from "./ssr.mjs";
import { A as boolean, D as _enum, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { t as authMiddleware } from "./middleware-DzwTqOc6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-B-jxD4aJ.js
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("646be9f450386a7d3f62c477cf1a66df87cc474ba37495b39b475d26b63e7b77"));
var listCustomersAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("f1f61f798206618a2a3acb3b8fd4c106b729e496bb3ea9673d6639567606d826"));
var customerAction = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	customerId: string(),
	action: _enum([
		"disconnect",
		"block",
		"unblock",
		"extend",
		"changePackage",
		"retry",
		"releaseDevice"
	]),
	minutes: number().optional(),
	packageId: string().optional()
}).parse(data)).handler(createSsrRpc("0cfa829a8431afd704ec928765eab5489763164a21868aa9b36916b21a4120e3"));
var listPackagesAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("0aa00b4dde7d21716291aff23be9c68390d72e97ea72df91c4cff9e895591e1a"));
var savePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(1).max(40),
	price: number().int().min(0),
	durationMinutes: number().int().min(1),
	downloadKbps: number().int().min(64),
	uploadKbps: number().int().min(64),
	dataLimitMb: number().int().min(1).nullable(),
	status: _enum(["ACTIVE", "INACTIVE"])
}).parse(data)).handler(createSsrRpc("d234638b769edf6f3aebda6603b511772a934c60a8366af7b81535cfded01b33"));
var deletePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(createSsrRpc("ebe7a968b73484f01ea9af08ae0d7c06ff566c0113fa9cd13ce3a0d098c367be"));
var listPaymentsAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	phone: string().optional(),
	packageId: string().optional(),
	status: string().optional(),
	activationStatus: string().optional(),
	period: _enum([
		"ALL",
		"TODAY",
		"WEEK",
		"MONTH"
	]).optional()
}).parse(data)).handler(createSsrRpc("cb1556ebdf94fcb5b5cb409a8c68d5cbb288e501a1fe2f44d945eb4b08687c2b"));
var retryPaymentActivation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ paymentId: string() }).parse(data)).handler(createSsrRpc("053019b17bee865f6e03d878f77381970165b006cd991cd8b087499b0a479939"));
var listLiveUsers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("a63713b734e0332b914b934e1e9be33a35be504760990a6a022594b458cc62d9"));
var kickLiveUser = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ sessionId: string() }).parse(data)).handler(createSsrRpc("c58905778fbb9432f27496411f9a112498614b5201c03c06c2cdc0e68df208c1"));
var getReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("23709e74da8e72ad5f6b87487bdb5bcc52928bdfba64a4ed6f54c8338642a711"));
var getNetwork = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("bfc7f3d612551c6299b5b46c06a50a69c754f42219484c0d3d49889383350cfe"));
var setIspStatus = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string(),
	status: _enum([
		"ONLINE",
		"OFFLINE",
		"DEGRADED"
	])
}).parse(data)).handler(createSsrRpc("1b1a40f81e9ba1ba2acfa7ba26e0306cf366710bce8d4e726edd01803fbf7092"));
var getSettingsAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("68c4bd0e128a2fc5ab0e6621d92988b9be7100f7e93aec88d18745222d60e0d3"));
var saveSettingsAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	hotspotName: string().min(2).max(60),
	currency: string().min(1).max(8),
	welcomeMessage: string().min(1).max(80),
	mpesaShortcode: string().optional(),
	mpesaConsumerKey: string().optional(),
	mpesaConsumerSecret: string().optional(),
	mpesaPasskey: string().optional(),
	mpesaEnv: _enum(["sandbox", "production"]),
	mpesaCallbackUrl: string().optional(),
	defaultUploadKbps: number().int().min(64),
	ispTotalKbps: number().int().min(1024).max(1e6),
	perUserMaxKbps: number().int().min(256).max(1e5),
	maxUsers: number().int().min(1).max(500),
	oneDevicePerPackage: boolean(),
	operatorPassword: string().optional(),
	radiusEnabled: boolean().optional(),
	radiusSecret: string().optional(),
	radiusAuthPort: number().optional(),
	radiusAcctPort: number().optional()
}).parse(data)).handler(createSsrRpc("84e12f121949828ed66a6b94905b4b97abf7f17b4c07f05d337405ab0ba17536"));
var mikrotikInput = object({
	id: string().optional(),
	name: string().min(2).max(60),
	host: string().min(3).max(200),
	port: number().int().min(1).max(65535).optional(),
	apiUser: string().min(1).max(80),
	apiPassword: string().max(120).optional(),
	hotspotName: string().min(1).max(60).default("hotspot1"),
	ssl: boolean().default(false),
	insecureTls: boolean().default(false),
	makePrimary: boolean().optional(),
	/** rest = RouterOS 7 REST; api6 = RouterOS 6 binary API */
	apiMode: _enum(["rest", "api6"]).default("rest"),
	apiPort: number().int().min(1).max(65535).optional()
});
var saveMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => mikrotikInput.parse(data)).handler(createSsrRpc("c01656b83d01987d607737a7921e4b66a4279e1051f4ec2445b7d7635e873168"));
var testMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	host: string().optional(),
	port: number().int().min(1).max(65535).optional(),
	apiUser: string().optional(),
	apiPassword: string().optional(),
	hotspotName: string().optional(),
	ssl: boolean().optional(),
	insecureTls: boolean().optional()
}).parse(data)).handler(createSsrRpc("50dd5ab7f8968ad275666c1d98bab06fb3eda700cb3b09bf35b205971ef186bb"));
var refreshMikroTiks = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("2cb326059439cd5f8563e5982fe7e033b61fb6dea396cc8609259e87cd2be6b7"));
var setPrimaryMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(createSsrRpc("6ab8ca9a1374897bdf14ededa3501fe9028733feeb796563750de2449b927443"));
var deleteMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(createSsrRpc("dc01274b892b81d8a0b7a37344a29da18507dc556042a42ca0758f90678761f3"));
var saveIsp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(2).max(40),
	type: _enum([
		"STARLINK",
		"AIRTEL",
		"SAFARICOM",
		"FIBRE",
		"LTE",
		"OTHER"
	]),
	interfaceName: string().max(40).optional(),
	mikrotikId: string().optional(),
	status: _enum([
		"ONLINE",
		"OFFLINE",
		"DEGRADED"
	]).optional(),
	totalKbps: number().int().min(1024).max(1e6).optional(),
	perUserMaxKbps: number().int().min(256).max(1e5).optional(),
	maxUsers: number().int().min(1).max(500).optional()
}).parse(data)).handler(createSsrRpc("d0e104f45636b19a235c0deb2bf9791f9f077f2bef101591bf290442349ed6b9"));
var deleteIsp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(createSsrRpc("ed47b6b148ba58f88aec397663fce6e1e9c42c7b80b2b072d74cc5d7ffd0d08c"));
var applyCamouflage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	routerId: string(),
	kind: _enum([
		"IPHONE",
		"ANDROID",
		"PC"
	]),
	interfaceName: string().max(40).optional()
}).parse(data)).handler(createSsrRpc("d1bb05de66fb9a02c3c99e116b23ba73b97b5bd1ea47d197eaf31b52f8155753"));
createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1368a8e49d0a00a23854511d76cd446f6977ce5669b600a59be0dade0bb3730a"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(2).max(80),
	slug: string().min(2).max(40).regex(/^[a-z0-9-]+$/)
}).parse(data)).handler(createSsrRpc("5fbf5d167a36e408e6bb975091d22bfe13c5c888f3f5f361307a241340ebf7fb"));
var listVouchersAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e19f37623aa53560750af1d0aabed251851be09e9c044eb6ef3a30f0f1c89a48"));
var generateVouchersAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	packageId: string(),
	count: number().int().min(1).max(200),
	batchLabel: string().max(60).optional(),
	siteId: string().optional()
}).parse(data)).handler(createSsrRpc("e4833d72042a0d0e5f832bfabf2f0f36dd0a50277d99ea104f961ccca9364a6c"));
var listActivationQueue = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("00a9eec92f408b9e49b1e44cb4be477598bf23541ad89d34521c834c1eee9781"));
var retryActivationAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ paymentId: string() }).parse(data)).handler(createSsrRpc("edbbd45ea9c1a537cda67df9248a3a2b0894d78ba052679524350d9d918fdfbf"));
//#endregion
export { savePackage as C, testMikroTik as D, setPrimaryMikroTik as E, saveMikroTik as S, setIspStatus as T, listVouchersAdmin as _, deletePackage as a, retryPaymentActivation as b, getNetwork as c, kickLiveUser as d, listActivationQueue as f, listPaymentsAdmin as g, listPackagesAdmin as h, deleteMikroTik as i, getReports as l, listLiveUsers as m, customerAction as n, generateVouchersAdmin as o, listCustomersAdmin as p, deleteIsp as r, getDashboard as s, applyCamouflage as t, getSettingsAdmin as u, refreshMikroTiks as v, saveSettingsAdmin as w, saveIsp as x, retryActivationAdmin as y };
