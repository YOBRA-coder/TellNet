import { o as __toESM } from "../_runtime.mjs";
import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { a as nid, n as asNumber } from "./utils-DITYiIRO.mjs";
import { a as mapCustomerPackage, n as getSettingsSecret, r as logEvent, t as getSettings } from "./settings.server-DGdR6vBM.mjs";
import { n as camouflageScript, r as randomMacFromOui, t as CAMOUFLAGE } from "./camouflage-COQbritr.mjs";
import { createHash } from "node:crypto";
import net from "node:net";
//#region node_modules/.nitro/vite/services/ssr/assets/mpesa.server-BgRtZTCv.js
/**
* Minimal MikroTik RouterOS binary API client (TCP 8728).
* Used for RouterOS 6 (and optional API on ROS 7).
* Protocol: length-prefixed words; sentences end with empty word.
*/
var RouterOsApiError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "RouterOsApiError";
	}
};
function encodeLength(len) {
	if (len < 128) return Buffer.from([len]);
	if (len < 16384) return Buffer.from([len >> 8 | 128, len & 255]);
	if (len < 2097152) return Buffer.from([
		len >> 16 | 192,
		len >> 8 & 255,
		len & 255
	]);
	if (len < 268435456) return Buffer.from([
		len >> 24 | 224,
		len >> 16 & 255,
		len >> 8 & 255,
		len & 255
	]);
	return Buffer.from([
		240,
		len >> 24 & 255,
		len >> 16 & 255,
		len >> 8 & 255,
		len & 255
	]);
}
function encodeWord(word) {
	const data = Buffer.from(word, "utf8");
	return Buffer.concat([encodeLength(data.length), data]);
}
function encodeSentence(words) {
	const parts = words.map(encodeWord);
	parts.push(Buffer.from([0]));
	return Buffer.concat(parts);
}
function parseSentences(buf) {
	const sentences = [];
	let offset = 0;
	const readLen = () => {
		if (offset >= buf.length) return null;
		const b0 = buf[offset];
		if (b0 === 0) {
			offset += 1;
			return 0;
		}
		if (b0 < 128) {
			offset += 1;
			return b0;
		}
		if (b0 < 192) {
			if (offset + 2 > buf.length) return null;
			const len = ((b0 & 127) << 8) + buf[offset + 1];
			offset += 2;
			return len;
		}
		if (b0 < 224) {
			if (offset + 3 > buf.length) return null;
			const len = ((b0 & 63) << 16) + (buf[offset + 1] << 8) + buf[offset + 2];
			offset += 3;
			return len;
		}
		if (b0 < 240) {
			if (offset + 4 > buf.length) return null;
			const len = ((b0 & 31) << 24) + (buf[offset + 1] << 16) + (buf[offset + 2] << 8) + buf[offset + 3];
			offset += 4;
			return len;
		}
		if (offset + 5 > buf.length) return null;
		const len = (buf[offset + 1] << 24) + (buf[offset + 2] << 16) + (buf[offset + 3] << 8) + buf[offset + 4];
		offset += 5;
		return len;
	};
	while (offset < buf.length) {
		const start = offset;
		const words = [];
		let ended = false;
		while (true) {
			const len = readLen();
			if (len === null) return {
				sentences,
				rest: buf.subarray(start)
			};
			if (len === 0) {
				ended = true;
				break;
			}
			if (offset + len > buf.length) return {
				sentences,
				rest: buf.subarray(start)
			};
			words.push(buf.subarray(offset, offset + len).toString("utf8"));
			offset += len;
		}
		if (!ended) break;
		const attrs = {};
		let type = "other";
		for (const w of words) if (w === "!done") type = "done";
		else if (w === "!trap") type = "trap";
		else if (w === "!re") type = "re";
		else if (w.startsWith("=")) {
			const eq = w.indexOf("=", 1);
			if (eq > 0) attrs[w.slice(1, eq)] = w.slice(eq + 1);
		}
		sentences.push({
			type,
			attrs,
			raw: words
		});
	}
	return {
		sentences,
		rest: Buffer.alloc(0)
	};
}
function normalizeHost(host) {
	return host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}
async function apiCall(creds, sentences, timeoutMs = 8e3) {
	const host = normalizeHost(creds.host);
	const port = creds.port || 8728;
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({
			host,
			port
		});
		let buf = Buffer.alloc(0);
		const collected = [];
		let settled = false;
		const timer = setTimeout(() => {
			finish(new RouterOsApiError("RouterOS API timeout."));
		}, timeoutMs);
		const finish = (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			if (err) reject(err);
			else resolve(collected);
		};
		socket.on("error", (e) => finish(new RouterOsApiError(e.message)));
		const send = (words) => {
			socket.write(encodeSentence(words));
		};
		let phase = "login";
		let queue = [...sentences];
		const pumpWork = () => {
			if (!queue.length) {
				finish();
				return;
			}
			const next = queue.shift();
			send(next);
		};
		socket.on("connect", () => {
			send([
				"/login",
				`=name=${creds.user}`,
				`=password=${creds.password}`
			]);
		});
		socket.on("data", (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			const { sentences: parsed, rest } = parseSentences(buf);
			buf = rest;
			for (const s of parsed) if (phase === "login" || phase === "chal") {
				if (s.type === "trap") {
					finish(new RouterOsApiError(s.attrs.message || "API login failed. On RouterOS 6 enable IP → Services → api (8728) and check user/password."));
					return;
				}
				if (s.type === "done") {
					const ret = s.attrs.ret;
					if (ret && phase === "login") {
						phase = "chal";
						const chal = Buffer.from(ret, "hex");
						const hash = createHash("md5");
						hash.update(Buffer.from([0]));
						hash.update(Buffer.from(creds.password, "utf8"));
						hash.update(chal);
						const response = "00" + hash.digest("hex");
						send([
							"/login",
							`=name=${creds.user}`,
							`=response=${response}`
						]);
						continue;
					}
					phase = "work";
					pumpWork();
					continue;
				}
			} else {
				collected.push(s);
				if (s.type === "trap") {
					finish(new RouterOsApiError(s.attrs.message || "RouterOS API error"));
					return;
				}
				if (s.type === "done") {
					if (queue.length) pumpWork();
					else finish();
				}
			}
		});
	});
}
async function apiProbe(creds) {
	const rows = await apiCall(creds, [["/system/resource/print"], ["/ip/hotspot/print"]]);
	const re = rows.filter((r) => r.type === "re");
	const resource = re.find((r) => r.attrs["board-name"] || r.attrs.version) ?? re[0];
	const hotspots = re.filter((r) => r.attrs.name && (r.attrs["idle-timeout"] !== void 0 || r.attrs.interface)).map((r) => r.attrs.name).filter(Boolean);
	const hsNames = [...new Set(rows.filter((r) => r.type === "re" && r.attrs.name).map((r) => r.attrs.name).filter((n) => n && n !== resource?.attrs["board-name"]))];
	return {
		ok: true,
		identity: resource?.attrs["board-name"] || resource?.attrs.version || "",
		version: resource?.attrs.version || "",
		boardName: resource?.attrs["board-name"] || "",
		uptime: resource?.attrs.uptime || "",
		cpuLoad: resource?.attrs["cpu-load"] ? Number(resource.attrs["cpu-load"]) : null,
		hotspotServers: hsNames.length ? hsNames : hotspots
	};
}
async function apiUpsertHotspotUser(creds, input) {
	const existing = (await apiCall(creds, [["/ip/hotspot/user/print", `?name=${input.username}`]])).find((r) => r.type === "re" && r.attrs.name === input.username);
	const setWords = [
		`=password=${input.password}`,
		`=profile=${input.profile}`,
		`=limit-uptime=${input.limitUptime}`,
		`=rate-limit=${input.rateLimit}`,
		`=comment=${input.comment}`
	];
	if (existing?.attrs[".id"]) await apiCall(creds, [[
		"/ip/hotspot/user/set",
		`=.id=${existing.attrs[".id"]}`,
		...setWords
	]]);
	else await apiCall(creds, [[
		"/ip/hotspot/user/add",
		`=name=${input.username}`,
		...setWords
	]]);
	try {
		await apiCall(creds, [[
			"/ip/hotspot/user/profile/add",
			"=name=telnet-1dev",
			"=shared-users=1",
			"=rate-limit=" + input.rateLimit
		]]);
	} catch {}
	try {
		const ex = (await apiCall(creds, [["/ip/hotspot/user/print", `?name=${input.username}`]])).find((r) => r.type === "re");
		if (ex?.attrs[".id"]) await apiCall(creds, [[
			"/ip/hotspot/user/set",
			`=.id=${ex.attrs[".id"]}`,
			"=profile=telnet-1dev"
		]]);
	} catch {}
}
async function apiDisableUser(creds, username) {
	const existing = (await apiCall(creds, [["/ip/hotspot/user/print", `?name=${username}`]])).find((r) => r.type === "re");
	if (existing?.attrs[".id"]) await apiCall(creds, [[
		"/ip/hotspot/user/set",
		`=.id=${existing.attrs[".id"]}`,
		"=disabled=yes"
	]]);
}
async function apiDisconnectUser(creds, username) {
	const found = await apiCall(creds, [["/ip/hotspot/active/print", `?user=${username}`]]);
	for (const row of found.filter((r) => r.type === "re")) if (row.attrs[".id"]) await apiCall(creds, [["/ip/hotspot/active/remove", `=.id=${row.attrs[".id"]}`]]);
}
var MikroTikError = class extends Error {
	constructor(message = "Router is currently unavailable.") {
		super(message);
		this.name = "MikroTikError";
	}
};
function usernameForPhone(phone) {
	return `u${phone.replace(/\D/g, "").slice(-9)}`;
}
function randomPassword() {
	return nid("pw").slice(3, 11);
}
async function getRouterCredentials() {
	const row = (await (await getSql())`
    select host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port
    from mikrotiks
    where is_primary = true
    limit 1
  `)[0];
	if (row?.host && row.api_user && row.api_password) return {
		host: String(row.host).replace(/\/$/, ""),
		user: String(row.api_user),
		password: String(row.api_password),
		hotspot: String(row.hotspot_name ?? "hotspot1"),
		insecureTls: Boolean(row.insecure_tls),
		apiMode: row.api_mode === "api6" ? "api6" : "rest",
		apiPort: row.api_port != null ? Number(row.api_port) : void 0
	};
	const s = await getSettingsSecret();
	if (s.mikrotikHost && s.mikrotikUser && s.mikrotikPassword) return {
		host: s.mikrotikHost.replace(/\/$/, ""),
		user: s.mikrotikUser,
		password: s.mikrotikPassword,
		hotspot: s.mikrotikHotspot ?? "hotspot1",
		apiMode: "rest"
	};
	return null;
}
async function getRouterCredentialsById(id) {
	const row = (await (await getSql())`
      select host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port
      from mikrotiks
      where id = ${id}
      limit 1
    `)[0];
	if (!row?.host || !row.api_user || !row.api_password) return null;
	return {
		host: String(row.host).replace(/\/$/, ""),
		user: String(row.api_user),
		password: String(row.api_password),
		hotspot: String(row.hotspot_name ?? "hotspot1"),
		insecureTls: Boolean(row.insecure_tls),
		apiMode: row.api_mode === "api6" ? "api6" : "rest",
		apiPort: row.api_port != null ? Number(row.api_port) : void 0
	};
}
/** Returns true when a real MikroTik is configured (live only). */
async function hasLiveRouter() {
	if ((await getSettingsSecret()).forceActivationFailure) return false;
	const creds = await getRouterCredentials();
	return Boolean(creds);
}
async function routeros(path, init = {}, creds) {
	const c = creds ?? await getRouterCredentials();
	if (!c) throw new MikroTikError();
	const host = c.host.replace(/\/$/, "");
	const auth = Buffer.from(`${c.user}:${c.password}`).toString("base64");
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8e3);
	const headers = {
		Authorization: `Basic ${auth}`,
		"Content-Type": "application/json",
		...init.headers ?? {}
	};
	const initOut = {
		...init,
		headers,
		signal: controller.signal
	};
	if (c.insecureTls) {
		const { Agent } = await import("../_libs/undici.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
		initOut.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
	}
	try {
		const res = await fetch(`${host}${path}`, initOut);
		if (!res.ok) throw new MikroTikError(res.status === 401 ? "Router rejected the username or password." : `Router returned HTTP ${res.status}.`);
		if (res.status === 204) return null;
		return await res.json();
	} catch (err) {
		if (err instanceof MikroTikError) throw err;
		if (err instanceof Error && err.name === "AbortError") throw new MikroTikError("Router timed out. Check the host and REST service.");
		throw new MikroTikError();
	} finally {
		clearTimeout(timer);
	}
}
async function probeRouter(creds) {
	if (creds.apiMode === "api6") try {
		const r = await apiProbe({
			host: creds.host,
			port: creds.apiPort || 8728,
			user: creds.user,
			password: creds.password
		});
		return {
			ok: true,
			identity: r.identity || null,
			version: r.version || null,
			boardName: r.boardName || null,
			uptime: r.uptime || null,
			cpuLoad: r.cpuLoad,
			hotspotServers: r.hotspotServers || [],
			interfaces: [],
			error: null
		};
	} catch (err) {
		return {
			ok: false,
			identity: null,
			version: null,
			boardName: null,
			uptime: null,
			cpuLoad: null,
			hotspotServers: [],
			interfaces: [],
			error: err instanceof Error ? err.message : "RouterOS 6 API failed"
		};
	}
	try {
		const resource = await routeros("/rest/system/resource", {}, creds);
		let identity = null;
		try {
			const ident = await routeros("/rest/system/identity", {}, creds);
			identity = ident?.name ? String(ident.name) : null;
		} catch {
			identity = null;
		}
		let hotspotServers = [];
		try {
			hotspotServers = (await routeros("/rest/ip/hotspot", {}, creds) ?? []).map((h) => String(h.name ?? "")).filter(Boolean);
		} catch {
			hotspotServers = [];
		}
		let interfaces = [];
		try {
			interfaces = (await routeros("/rest/interface", {}, creds) ?? []).filter((i) => i.name).slice(0, 16).map((i) => ({
				name: String(i.name),
				type: String(i.type ?? "ether"),
				running: i.running === true || i.running === "true"
			}));
		} catch {
			interfaces = [];
		}
		const cpuRaw = resource?.["cpu-load"] ?? resource?.cpu_load;
		return {
			ok: true,
			identity,
			version: resource?.version ? String(resource.version) : null,
			boardName: resource?.["board-name"] ? String(resource["board-name"]) : resource?.board_name ? String(resource.board_name) : null,
			uptime: resource?.uptime ? String(resource.uptime) : null,
			cpuLoad: cpuRaw == null || cpuRaw === "" ? null : Number.parseInt(String(cpuRaw), 10) || 0,
			hotspotServers,
			interfaces,
			error: null
		};
	} catch (err) {
		return {
			ok: false,
			identity: null,
			version: null,
			boardName: null,
			uptime: null,
			cpuLoad: null,
			hotspotServers: [],
			interfaces: [],
			error: err instanceof MikroTikError ? err.message : "Could not reach the router. Enable REST (IP → Services → www) and check the host."
		};
	}
}
async function ensureOneDeviceProfile(creds) {
	try {
		const hit = (await routeros("/rest/ip/hotspot/user/profile", {}, creds) ?? []).find((p) => p.name === "telnet-1dev");
		const body = {
			name: "telnet-1dev",
			"shared-users": "1",
			"keepalive-timeout": "2m",
			"idle-timeout": "none"
		};
		if (hit?.[".id"]) await routeros(`/rest/ip/hotspot/user/profile/${encodeURIComponent(hit[".id"])}`, {
			method: "PATCH",
			body: JSON.stringify({ "shared-users": "1" })
		}, creds);
		else await routeros("/rest/ip/hotspot/user/profile", {
			method: "PUT",
			body: JSON.stringify(body)
		}, creds);
	} catch {}
}
async function kickExtraActiveSessions(username, creds) {
	try {
		const rows = await routeros(`/rest/ip/hotspot/active?user=${encodeURIComponent(username)}`, {}, creds) ?? [];
		for (const row of rows.slice(1)) if (row[".id"]) await routeros(`/rest/ip/hotspot/active/${encodeURIComponent(row[".id"])}`, { method: "DELETE" }, creds);
	} catch {}
}
async function createAndActivateUser(input) {
	if (!await hasLiveRouter()) throw new MikroTikError("No MikroTik router configured or router unreachable.");
	const creds = await getRouterCredentials();
	if (!creds) throw new MikroTikError("No MikroTik router configured. Add one under Operator → Network.");
	if (creds.apiMode === "api6") {
		await apiUpsertHotspotUser({
			host: creds.host,
			port: creds.apiPort || 8728,
			user: creds.user,
			password: creds.password
		}, {
			username: input.username,
			password: input.password,
			profile: "default",
			limitUptime: String(input.sessionTimeoutSeconds),
			rateLimit: `${input.uploadKbps}k/${input.downloadKbps}k`,
			sharedUsers: "1",
			comment: `telnet:${input.customerId}:1dev`
		});
		try {
			await apiDisconnectUser({
				host: creds.host,
				port: creds.apiPort || 8728,
				user: creds.user,
				password: creds.password
			}, input.username);
		} catch {}
		return { username: input.username };
	}
	await ensureOneDeviceProfile(creds);
	const existing = await routeros(`/rest/ip/hotspot/user?name=${encodeURIComponent(input.username)}`, {}, creds);
	const payload = {
		name: input.username,
		password: input.password,
		profile: "telnet-1dev",
		"limit-uptime": String(input.sessionTimeoutSeconds),
		"rate-limit": `${input.uploadKbps}k/${input.downloadKbps}k`,
		"shared-users": "1",
		disabled: "false",
		comment: `telnet:${input.customerId}:1dev`
	};
	if (input.macAddress) payload["mac-address"] = input.macAddress;
	try {
		if (existing && existing[0]?.[".id"]) await routeros(`/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`, {
			method: "PATCH",
			body: JSON.stringify(payload)
		}, creds);
		else await routeros(`/rest/ip/hotspot/user`, {
			method: "PUT",
			body: JSON.stringify(payload)
		}, creds);
	} catch {
		const fallback = {
			...payload,
			profile: "default"
		};
		if (existing && existing[0]?.[".id"]) await routeros(`/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`, {
			method: "PATCH",
			body: JSON.stringify(fallback)
		}, creds);
		else await routeros(`/rest/ip/hotspot/user`, {
			method: "PUT",
			body: JSON.stringify(fallback)
		}, creds);
	}
	await kickExtraActiveSessions(input.username, creds);
	return { username: input.username };
}
async function disableUser(username) {
	if (!await hasLiveRouter()) throw new MikroTikError();
	const creds = await getRouterCredentials();
	if (!creds) throw new MikroTikError();
	if (creds.apiMode === "api6") {
		await apiDisableUser({
			host: creds.host,
			port: creds.apiPort || 8728,
			user: creds.user,
			password: creds.password
		}, username);
		return;
	}
	const existing = await routeros(`/rest/ip/hotspot/user?name=${encodeURIComponent(username)}`, {}, creds);
	if (existing?.[0]?.[".id"]) await routeros(`/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`, {
		method: "PATCH",
		body: JSON.stringify({ disabled: "true" })
	}, creds);
}
async function disconnectUser(username) {
	if (!await hasLiveRouter()) throw new MikroTikError();
	const creds = await getRouterCredentials();
	if (!creds) throw new MikroTikError();
	if (creds.apiMode === "api6") {
		await apiDisconnectUser({
			host: creds.host,
			port: creds.apiPort || 8728,
			user: creds.user,
			password: creds.password
		}, username);
		return;
	}
	const active = await routeros(`/rest/ip/hotspot/active?user=${encodeURIComponent(username)}`, {}, creds);
	for (const row of active ?? []) if (row[".id"]) await routeros(`/rest/ip/hotspot/active/${encodeURIComponent(row[".id"])}`, { method: "DELETE" }, creds);
}
async function pingRouter() {
	const creds = await getRouterCredentials();
	if (!creds) return {
		reachable: false,
		mode: "unconfigured"
	};
	return {
		reachable: (await probeRouter(creds)).ok,
		mode: "live"
	};
}
async function patchByQuery(creds, listPath, match, body) {
	const hit = (await routeros(listPath, {}, creds) ?? []).find(match);
	if (!hit?.[".id"]) return false;
	await routeros(`${listPath}/${encodeURIComponent(String(hit[".id"]))}`, {
		method: "PATCH",
		body: JSON.stringify(body)
	}, creds);
	return true;
}
async function applyCamouflage(input) {
	const profile = CAMOUFLAGE[input.kind];
	const mac = randomMacFromOui(profile.oui);
	const creds = await getRouterCredentialsById(input.routerId);
	const sql = await getSql();
	const stored = (await sql`
      select camouflage_interface, interfaces_json from mikrotiks where id = ${input.routerId} limit 1
    `)[0];
	let iface = input.interfaceName?.trim() || stored?.camouflage_interface || "";
	if (!iface && stored?.interfaces_json) try {
		const list = JSON.parse(String(stored.interfaces_json));
		iface = (list.find((i) => i.running && /ether|lte|wwan|usb|sfp|pppoe/i.test(i.name + i.type)) ?? list.find((i) => i.running) ?? list[0])?.name ?? "ether1";
	} catch {
		iface = "ether1";
	}
	if (!iface) iface = "ether1";
	const script = camouflageScript(profile, iface, mac);
	if (!creds) {
		await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        updated_at = now()
      where id = ${input.routerId}
    `;
		return {
			ok: true,
			live: false,
			mac,
			interfaceName: iface,
			script,
			error: "No REST credentials — apply the script in Winbox Terminal."
		};
	}
	const steps = [];
	try {
		try {
			await routeros("/rest/system/identity", {
				method: "PATCH",
				body: JSON.stringify({ name: profile.identity })
			}, creds);
			steps.push("identity");
		} catch {
			steps.push("identity-skip");
		}
		try {
			if (!await patchByQuery(creds, "/rest/ip/dhcp-client", (row) => String(row.interface ?? "") === iface, { "host-name": profile.hostname })) await patchByQuery(creds, "/rest/ip/dhcp-client", () => true, { "host-name": profile.hostname });
			steps.push("dhcp-hostname");
		} catch {
			steps.push("dhcp-skip");
		}
		try {
			const hit = (await routeros("/rest/interface", {}, creds) ?? []).find((i) => i.name === iface);
			if (hit?.[".id"]) {
				await routeros(`/rest/interface/${encodeURIComponent(hit[".id"])}`, {
					method: "PATCH",
					body: JSON.stringify({ "mac-address": mac })
				}, creds);
				steps.push("mac");
			}
		} catch {
			steps.push("mac-skip");
		}
		try {
			const mangles = await routeros("/rest/ip/firewall/mangle", {}, creds);
			for (const row of mangles ?? []) if (String(row.comment ?? "").includes("telnet-camouflage") && row[".id"]) await routeros(`/rest/ip/firewall/mangle/${encodeURIComponent(row[".id"])}`, { method: "DELETE" }, creds);
			await routeros("/rest/ip/firewall/mangle", {
				method: "PUT",
				body: JSON.stringify({
					chain: "postrouting",
					action: "change-ttl",
					"new-ttl": `set:${profile.ttl}`,
					passthrough: "yes",
					comment: "telnet-camouflage-ttl"
				})
			}, creds);
			steps.push("ttl");
		} catch {
			steps.push("ttl-skip");
		}
		await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        identity = ${profile.identity},
        updated_at = now()
      where id = ${input.routerId}
    `;
		const live = steps.includes("identity") || steps.includes("ttl") || steps.includes("mac");
		return {
			ok: true,
			live,
			mac,
			interfaceName: iface,
			script,
			error: live ? null : "Router did not accept REST writes. Paste the script in Winbox Terminal."
		};
	} catch (err) {
		await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        updated_at = now()
      where id = ${input.routerId}
    `;
		return {
			ok: true,
			live: false,
			mac,
			interfaceName: iface,
			script,
			error: err instanceof MikroTikError ? err.message : "Could not reach the router. Use the Terminal script."
		};
	}
}
/**
* Database is the source of truth. Run on every portal/admin read that
* depends on live access — no browser timer.
*/
async function expireDuePackages() {
	const sql = await getSql();
	const due = await sql`
    select cp.id, cp.customer_id, cp.payment_id, cp.mikrotik_username, c.phone
    from customer_packages cp
    join customers c on c.id = cp.customer_id
    where cp.status = 'ACTIVE' and cp.expiry_time <= now()
  `;
	for (const row of due) {
		await sql`
      update customer_packages
      set status = 'EXPIRED', activation_status = 'EXPIRED', updated_at = now()
      where id = ${row.id}
    `;
		await sql`
      update payments
      set activation_status = 'EXPIRED', updated_at = now()
      where id = ${row.payment_id}
    `;
		await sql`
      update sessions
      set status = 'EXPIRED', session_end = now()
      where customer_package_id = ${row.id} and status = 'ACTIVE'
    `;
		if (row.mikrotik_username) try {
			await disconnectUser(row.mikrotik_username);
			await disableUser(row.mikrotik_username);
		} catch {}
		await logEvent("EXPIRE", `Package for ${row.phone} reached expiry. Session ended, hotspot user disabled.`);
	}
	return due.length;
}
function nextIp() {
	return `10.10.0.${2 + Math.floor(Math.random() * 250)}`;
}
function randomMac() {
	const b = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
	return `02:${b()}:${b()}:${b()}:${b()}:${b()}`.toUpperCase();
}
async function activateFromPayment(paymentId, device) {
	await expireDuePackages();
	const sql = await getSql();
	const pay = (await sql`
    select p.*, pkg.name as package_name, pkg.duration_minutes, pkg.download_kbps,
           pkg.upload_kbps, pkg.data_limit_mb, c.phone as customer_phone, c.status as customer_status
    from payments p
    join packages pkg on pkg.id = p.package_id
    join customers c on c.id = p.customer_id
    where p.id = ${paymentId}
    limit 1
  `)[0];
	if (!pay) return {
		ok: false,
		reason: "not_found"
	};
	if (String(pay.status) !== "SUCCESS") return {
		ok: false,
		reason: "unpaid"
	};
	if (String(pay.customer_status) === "BLOCKED") return {
		ok: false,
		reason: "blocked"
	};
	let packRow = (await sql`
    select cp.*, pkg.name as package_name
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    where cp.payment_id = ${paymentId}
    limit 1
  `)[0];
	const settings = await getSettings();
	const durationMin = Number(pay.duration_minutes);
	const start = packRow ? new Date(String(packRow.start_time)) : /* @__PURE__ */ new Date();
	const expiry = packRow ? new Date(String(packRow.expiry_time)) : new Date(start.getTime() + durationMin * 6e4);
	if (expiry.getTime() <= Date.now()) {
		if (packRow) await sql`
        update customer_packages
        set status = 'EXPIRED', activation_status = 'EXPIRED', updated_at = now()
        where id = ${packRow.id}
      `;
		return {
			ok: false,
			reason: "expired"
		};
	}
	const boundToken = packRow?.bound_device_token ? String(packRow.bound_device_token) : null;
	if (settings.oneDevicePerPackage && boundToken && device?.token && device.token !== boundToken) {
		await logEvent("DEVICE_BLOCK", `Package for ${String(pay.phone)} refused — already bound to another device.`);
		return {
			ok: false,
			reason: "in_use"
		};
	}
	const username = packRow?.mikrotik_username || usernameForPhone(String(pay.phone));
	const password = randomPassword();
	const remaining = Math.max(60, Math.floor((expiry.getTime() - Date.now()) / 1e3));
	const online = (await sql`
      select count(*)::int as n from sessions where status = 'ACTIVE'
    `)[0];
	if (settings.maxUsers > 0 && asNumber(online?.n) >= settings.maxUsers) {
		if (!packRow) await sql`
        insert into customer_packages (
          id, customer_id, package_id, payment_id, start_time, expiry_time,
          speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
        ) values (
          ${nid("cp")}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
          ${start.toISOString()}, ${expiry.toISOString()},
          ${pay.download_kbps}, ${pay.data_limit_mb},
          'ACTIVE', 'ACTIVATION_FAILED', ${username}
        )
      `;
		await sql`
      update payments
      set activation_status = 'ACTIVATION_FAILED', updated_at = now()
      where id = ${paymentId}
    `;
		await logEvent("CAPACITY", `Hotspot at ${settings.maxUsers} users. Payment ${String(pay.mpesa_transaction_id ?? paymentId)} held for retry.`);
		return {
			ok: false,
			reason: "capacity"
		};
	}
	const downloadKbps = Math.min(Number(pay.download_kbps), settings.perUserMaxKbps || Number(pay.download_kbps));
	const uploadKbps = Math.min(Number(pay.upload_kbps), settings.perUserMaxKbps || Number(pay.upload_kbps));
	try {
		await createAndActivateUser({
			username,
			password,
			downloadKbps,
			uploadKbps,
			sessionTimeoutSeconds: remaining,
			customerId: String(pay.customer_id)
		});
	} catch (err) {
		const failed = err instanceof MikroTikError;
		if (!packRow) await sql`
        insert into customer_packages (
          id, customer_id, package_id, payment_id, start_time, expiry_time,
          speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
        ) values (
          ${nid("cp")}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
          ${start.toISOString()}, ${expiry.toISOString()},
          ${pay.download_kbps}, ${pay.data_limit_mb},
          'ACTIVE', 'ACTIVATION_FAILED', ${username}
        )
      `;
		else await sql`
        update customer_packages
        set activation_status = 'ACTIVATION_FAILED', mikrotik_username = ${username}, updated_at = now()
        where id = ${packRow.id}
      `;
		await sql`
      update payments
      set activation_status = 'ACTIVATION_FAILED', updated_at = now()
      where id = ${paymentId}
    `;
		await logEvent("ACTIVATION_FAILED", `Payment ${String(pay.mpesa_transaction_id ?? paymentId)} confirmed but the router could not activate the user.`);
		return {
			ok: false,
			reason: failed ? "router" : "router"
		};
	}
	if (!packRow) {
		const id = nid("cp");
		await sql`
      insert into customer_packages (
        id, customer_id, package_id, payment_id, start_time, expiry_time,
        speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
      ) values (
        ${id}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
        ${start.toISOString()}, ${expiry.toISOString()},
        ${pay.download_kbps}, ${pay.data_limit_mb},
        'ACTIVE', 'ACTIVATED', ${username}
      )
    `;
		packRow = (await sql`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${id}
    `)[0];
	} else {
		await sql`
      update customer_packages
      set activation_status = 'ACTIVATED', status = 'ACTIVE',
          mikrotik_username = ${username}, updated_at = now()
      where id = ${packRow.id}
    `;
		packRow = (await sql`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${packRow.id}
    `)[0];
	}
	if (settings.oneDevicePerPackage && device?.token && packRow) {
		await sql`
      update customer_packages
      set bound_device_token = coalesce(bound_device_token, ${device.token}),
          bound_at = coalesce(bound_at, now()),
          updated_at = now()
      where id = ${packRow.id}
    `;
		packRow = (await sql`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${packRow.id}
    `)[0];
	}
	await sql`
    update payments
    set activation_status = 'ACTIVATED', updated_at = now()
    where id = ${paymentId}
  `;
	if (device?.token) await sql`
      update customers set device_token = ${device.token}, updated_at = now()
      where id = ${pay.customer_id}
    `;
	await sql`
    update sessions set status = 'DISCONNECTED', session_end = now()
    where customer_id = ${pay.customer_id} and status = 'ACTIVE'
  `;
	await sql`
    insert into sessions (
      id, customer_id, package_id, customer_package_id, mikrotik_username,
      ip_address, mac_address, device_information, session_start, last_seen, status
    ) values (
      ${nid("ses")}, ${pay.customer_id}, ${pay.package_id}, ${packRow.id},
      ${username}, ${nextIp()}, ${randomMac()}, ${device?.info ?? "Captive portal"},
      now(), now(), 'ACTIVE'
    )
  `;
	await logEvent("ACTIVATED", `Hotspot user ${username} activated for ${String(pay.phone)}. Package ${String(pay.package_name)} until ${expiry.toISOString()}.`);
	return {
		ok: true,
		pack: mapCustomerPackage(packRow)
	};
}
async function reconnectCustomer(customerId, device) {
	await expireDuePackages();
	const row = (await (await getSql())`
    select cp.*, pkg.name as package_name, pkg.download_kbps, pkg.upload_kbps, c.phone, c.status as customer_status
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    join customers c on c.id = cp.customer_id
    where cp.customer_id = ${customerId}
      and cp.status = 'ACTIVE'
      and cp.expiry_time > now()
    order by cp.expiry_time desc
    limit 1
  `)[0];
	if (!row) return {
		ok: false,
		reason: "none"
	};
	if (String(row.customer_status) === "BLOCKED") return {
		ok: false,
		reason: "blocked"
	};
	return activateFromPayment(String(row.payment_id), device);
}
async function releaseDeviceBind(customerId) {
	const sql = await getSql();
	await sql`
    update customer_packages
    set bound_device_token = null,
        bound_mac = null,
        bound_at = null,
        updated_at = now()
    where customer_id = ${customerId} and status = 'ACTIVE'
  `;
	const ses = await sql`
    select id from sessions where customer_id = ${customerId} and status = 'ACTIVE'
  `;
	for (const s of ses) await disconnectSession(s.id);
	await logEvent("DEVICE_RELEASE", `Device bind released. Another phone can claim this package.`);
}
async function disconnectSession(sessionId) {
	const sql = await getSql();
	const username = (await sql`
    select mikrotik_username from sessions where id = ${sessionId} limit 1
  `)[0]?.mikrotik_username;
	if (username) try {
		await disconnectUser(username);
	} catch {}
	await sql`
    update sessions
    set status = 'DISCONNECTED', session_end = now()
    where id = ${sessionId}
  `;
}
async function blockCustomer(customerId) {
	const sql = await getSql();
	await sql`update customers set status = 'BLOCKED', updated_at = now() where id = ${customerId}`;
	const users = await sql`
    select mikrotik_username from customer_packages
    where customer_id = ${customerId} and mikrotik_username is not null
  `;
	for (const u of users) {
		if (!u.mikrotik_username) continue;
		try {
			await disconnectUser(u.mikrotik_username);
			await disableUser(u.mikrotik_username);
		} catch {}
	}
	await sql`
    update sessions set status = 'DISCONNECTED', session_end = now()
    where customer_id = ${customerId} and status = 'ACTIVE'
  `;
}
async function tickLiveUsage() {
	const sql = await getSql();
	const rows = await sql`
    select s.id, s.bytes_down, s.bytes_up, s.last_seen, cp.speed_limit_kbps
    from sessions s
    join customer_packages cp on cp.id = s.customer_package_id
    where s.status = 'ACTIVE'
  `;
	for (const row of rows) {
		const last = new Date(row.last_seen).getTime();
		const elapsed = Math.max(1, (Date.now() - last) / 1e3);
		const cap = Number(row.speed_limit_kbps) * 128;
		await sql`
      update sessions
      set bytes_down = bytes_down + ${Math.floor(cap * (.08 + Math.random() * .35) * elapsed)},
          bytes_up = bytes_up + ${Math.floor(cap * (.02 + Math.random() * .08) * elapsed)},
          last_seen = now()
      where id = ${row.id}
    `;
	}
}
var DARJA_BASE = {
	sandbox: "https://sandbox.safaricom.co.ke",
	production: "https://api.safaricom.co.ke"
};
async function darajaToken(key, secret, env) {
	const base = DARJA_BASE[env] ?? DARJA_BASE.sandbox;
	const auth = Buffer.from(`${key}:${secret}`).toString("base64");
	const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
	if (!res.ok) throw new Error("Could not reach M-Pesa. Check Daraja credentials.");
	const json = await res.json();
	if (!json.access_token) throw new Error(json.errorMessage || "Could not reach M-Pesa. Check Daraja credentials.");
	return {
		token: json.access_token,
		base
	};
}
function timestamp() {
	const d = /* @__PURE__ */ new Date();
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function requireLiveCredentials(settings) {
	if (!settings.mpesaConsumerKey || !settings.mpesaConsumerSecret || !settings.mpesaPasskey || !settings.mpesaShortcode) throw new Error("Live M-Pesa is not configured. Add Consumer Key, Secret, Passkey and Shortcode in Operator → Settings.");
	if (!settings.mpesaCallbackUrl) throw new Error("Set the M-Pesa callback URL in Operator → Settings (public HTTPS ending in /api/mpesa/callback).");
}
async function initiateStkPush(input) {
	const settings = await getSettingsSecret();
	requireLiveCredentials(settings);
	const { token, base } = await darajaToken(settings.mpesaConsumerKey, settings.mpesaConsumerSecret, settings.mpesaEnv);
	const ts = timestamp();
	const password = Buffer.from(`${settings.mpesaShortcode}${settings.mpesaPasskey}${ts}`).toString("base64");
	const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			BusinessShortCode: settings.mpesaShortcode,
			Password: password,
			Timestamp: ts,
			TransactionType: "CustomerPayBillOnline",
			Amount: input.amount,
			PartyA: input.phone,
			PartyB: settings.mpesaShortcode,
			PhoneNumber: input.phone,
			CallBackURL: settings.mpesaCallbackUrl,
			AccountReference: input.accountRef.slice(0, 12),
			TransactionDesc: input.description.slice(0, 20)
		})
	});
	const json = await res.json();
	if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) throw new Error(json.errorMessage || json.ResponseDescription || "Could not send the M-Pesa prompt. Please try again.");
	return {
		merchantRequestId: json.MerchantRequestID ?? nid("mr"),
		checkoutRequestId: json.CheckoutRequestID
	};
}
async function queryStkStatus(checkoutRequestId) {
	const settings = await getSettingsSecret();
	requireLiveCredentials(settings);
	const { token, base } = await darajaToken(settings.mpesaConsumerKey, settings.mpesaConsumerSecret, settings.mpesaEnv);
	const ts = timestamp();
	const password = Buffer.from(`${settings.mpesaShortcode}${settings.mpesaPasskey}${ts}`).toString("base64");
	const json = await (await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			BusinessShortCode: settings.mpesaShortcode,
			Password: password,
			Timestamp: ts,
			CheckoutRequestID: checkoutRequestId
		})
	})).json();
	return {
		resultCode: json.ResultCode != null ? Number(json.ResultCode) : -1,
		resultDesc: json.ResultDesc || json.errorMessage || ""
	};
}
function parseCallback(body) {
	const root = body ?? {};
	const cb = root.Body?.stkCallback ?? root.stkCallback ?? root;
	const items = cb.CallbackMetadata?.Item ?? [];
	const pick = (name) => items.find((i) => i.Name === name)?.Value ?? null;
	return {
		checkoutRequestId: cb.CheckoutRequestID ? String(cb.CheckoutRequestID) : null,
		merchantRequestId: cb.MerchantRequestID ? String(cb.MerchantRequestID) : null,
		resultCode: Number(cb.ResultCode ?? 1),
		resultDesc: String(cb.ResultDesc ?? ""),
		receipt: pick("MpesaReceiptNumber") ? String(pick("MpesaReceiptNumber")) : null,
		phone: pick("PhoneNumber") ? String(pick("PhoneNumber")) : null,
		amount: pick("Amount") != null ? Number(pick("Amount")) : null
	};
}
//#endregion
export { expireDuePackages as a, pingRouter as c, reconnectCustomer as d, releaseDeviceBind as f, disconnectSession as i, probeRouter as l, applyCamouflage as n, initiateStkPush as o, tickLiveUsage as p, blockCustomer as r, parseCallback as s, activateFromPayment as t, queryStkStatus as u };
