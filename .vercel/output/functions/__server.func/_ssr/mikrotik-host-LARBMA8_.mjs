//#region node_modules/.nitro/vite/services/ssr/assets/mikrotik-host-LARBMA8_.js
function normalizeRouterHost(raw, ssl, port) {
	let host = raw.trim();
	if (!host) return host;
	if (/^https?:\/\//i.test(host)) return host.replace(/\/$/, "");
	host = host.replace(/\/$/, "");
	const proto = ssl ? "https" : "http";
	const defaultPort = ssl ? 443 : 80;
	if (/]:\d+$/.test(host) || /^[^[\]]+:\d+$/.test(host)) return `${proto}://${host}`;
	if (port && port !== defaultPort) return `${proto}://${host}:${port}`;
	return `${proto}://${host}`;
}
function parseRouterHost(host) {
	try {
		const u = new URL(/^https?:\/\//i.test(host) ? host : `http://${host}`);
		const ssl = u.protocol === "https:";
		const port = u.port ? Number(u.port) : ssl ? 443 : 80;
		return {
			address: u.hostname,
			port,
			ssl
		};
	} catch {
		return {
			address: host,
			port: 80,
			ssl: false
		};
	}
}
//#endregion
export { parseRouterHost as n, normalizeRouterHost as t };
