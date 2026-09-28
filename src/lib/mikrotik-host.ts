export function normalizeRouterHost(raw: string, ssl: boolean, port?: number) {
  let host = raw.trim();
  if (!host) return host;
  if (/^https?:\/\//i.test(host)) {
    return host.replace(/\/$/, "");
  }
  host = host.replace(/\/$/, "");
  const proto = ssl ? "https" : "http";
  const defaultPort = ssl ? 443 : 80;
  const hasPort = /]:\d+$/.test(host) || /^[^[\]]+:\d+$/.test(host);
  if (hasPort) return `${proto}://${host}`;
  if (port && port !== defaultPort) return `${proto}://${host}:${port}`;
  return `${proto}://${host}`;
}

export function parseRouterHost(host: string): {
  address: string;
  port: number;
  ssl: boolean;
} {
  try {
    const u = new URL(/^https?:\/\//i.test(host) ? host : `http://${host}`);
    const ssl = u.protocol === "https:";
    const port = u.port ? Number(u.port) : ssl ? 443 : 80;
    return { address: u.hostname, port, ssl };
  } catch {
    return { address: host, port: 80, ssl: false };
  }
}
