/**
 * Minimal MikroTik RouterOS binary API client (TCP 8728).
 * Used for RouterOS 6 (and optional API on ROS 7).
 * Protocol: length-prefixed words; sentences end with empty word.
 */
import net from "node:net";
import { createHash } from "node:crypto";

export class RouterOsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterOsApiError";
  }
}

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
  if (len < 0x200000) {
    return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  }
  if (len < 0x10000000) {
    return Buffer.from([
      (len >> 24) | 0xe0,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
  }
  return Buffer.from([
    0xf0,
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
  ]);
}

function encodeWord(word: string): Buffer {
  const data = Buffer.from(word, "utf8");
  return Buffer.concat([encodeLength(data.length), data]);
}

function encodeSentence(words: string[]): Buffer {
  const parts = words.map(encodeWord);
  parts.push(Buffer.from([0])); // empty word ends sentence
  return Buffer.concat(parts);
}

type Parsed = { type: "done" | "trap" | "re" | "other"; attrs: Record<string, string>; raw: string[] };

function parseSentences(buf: Buffer): { sentences: Parsed[]; rest: Buffer } {
  const sentences: Parsed[] = [];
  let offset = 0;

  const readLen = (): number | null => {
    if (offset >= buf.length) return null;
    const b0 = buf[offset];
    if (b0 === 0) {
      offset += 1;
      return 0;
    }
    if (b0 < 0x80) {
      offset += 1;
      return b0;
    }
    if (b0 < 0xc0) {
      if (offset + 2 > buf.length) return null;
      const len = ((b0 & 0x7f) << 8) + buf[offset + 1];
      offset += 2;
      return len;
    }
    if (b0 < 0xe0) {
      if (offset + 3 > buf.length) return null;
      const len = ((b0 & 0x3f) << 16) + (buf[offset + 1] << 8) + buf[offset + 2];
      offset += 3;
      return len;
    }
    if (b0 < 0xf0) {
      if (offset + 4 > buf.length) return null;
      const len =
        ((b0 & 0x1f) << 24) +
        (buf[offset + 1] << 16) +
        (buf[offset + 2] << 8) +
        buf[offset + 3];
      offset += 4;
      return len;
    }
    if (offset + 5 > buf.length) return null;
    const len =
      (buf[offset + 1] << 24) +
      (buf[offset + 2] << 16) +
      (buf[offset + 3] << 8) +
      buf[offset + 4];
    offset += 5;
    return len;
  };

  while (offset < buf.length) {
    const start = offset;
    const words: string[] = [];
    let ended = false;
    while (true) {
      const len = readLen();
      if (len === null) {
        return { sentences, rest: buf.subarray(start) };
      }
      if (len === 0) {
        ended = true;
        break;
      }
      if (offset + len > buf.length) {
        return { sentences, rest: buf.subarray(start) };
      }
      words.push(buf.subarray(offset, offset + len).toString("utf8"));
      offset += len;
    }
    if (!ended) break;
    const attrs: Record<string, string> = {};
    let type: Parsed["type"] = "other";
    for (const w of words) {
      if (w === "!done") type = "done";
      else if (w === "!trap") type = "trap";
      else if (w === "!re") type = "re";
      else if (w.startsWith("=")) {
        const eq = w.indexOf("=", 1);
        if (eq > 0) attrs[w.slice(1, eq)] = w.slice(eq + 1);
      }
    }
    sentences.push({ type, attrs, raw: words });
  }
  return { sentences, rest: Buffer.alloc(0) };
}

export type ApiCreds = {
  host: string;
  port: number;
  user: string;
  password: string;
};

function normalizeHost(host: string): string {
  return host
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export async function apiCall(
  creds: ApiCreds,
  sentences: string[][],
  timeoutMs = 8000,
): Promise<Parsed[]> {
  const host = normalizeHost(creds.host);
  const port = creds.port || 8728;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buf = Buffer.alloc(0);
    const collected: Parsed[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      finish(new RouterOsApiError("RouterOS API timeout."));
    }, timeoutMs);

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(collected);
    };

    socket.on("error", (e) => finish(new RouterOsApiError(e.message)));

    const send = (words: string[]) => {
      socket.write(encodeSentence(words));
    };

    let phase: "login" | "chal" | "work" = "login";
    let queue = [...sentences];

    const pumpWork = () => {
      if (!queue.length) {
        finish();
        return;
      }
      const next = queue.shift()!;
      send(next);
    };

    socket.on("connect", () => {
      // Prefer post-v6.43 login style first
      send(["/login", `=name=${creds.user}`, `=password=${creds.password}`]);
    });

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { sentences: parsed, rest } = parseSentences(buf);
      buf = rest;

      for (const s of parsed) {
        if (phase === "login" || phase === "chal") {
          if (s.type === "trap") {
            finish(
              new RouterOsApiError(
                s.attrs.message ||
                  "API login failed. On RouterOS 6 enable IP → Services → api (8728) and check user/password.",
              ),
            );
            return;
          }
          if (s.type === "done") {
            // challenge-response legacy?
            const ret = s.attrs.ret;
            if (ret && phase === "login") {
              phase = "chal";
              const chal = Buffer.from(ret, "hex");
              const hash = createHash("md5");
              hash.update(Buffer.from([0]));
              hash.update(Buffer.from(creds.password, "utf8"));
              hash.update(chal);
              const response = "00" + hash.digest("hex");
              send(["/login", `=name=${creds.user}`, `=response=${response}`]);
              continue;
            }
            phase = "work";
            pumpWork();
            continue;
          }
        } else {
          collected.push(s);
          if (s.type === "trap") {
            finish(
              new RouterOsApiError(s.attrs.message || "RouterOS API error"),
            );
            return;
          }
          if (s.type === "done") {
            if (queue.length) pumpWork();
            else finish();
          }
        }
      }
    });
  });
}

export async function apiProbe(creds: ApiCreds) {
  const rows = await apiCall(creds, [
    ["/system/resource/print"],
    ["/ip/hotspot/print"],
  ]);
  const re = rows.filter((r) => r.type === "re");
  const resource = re.find((r) => r.attrs["board-name"] || r.attrs.version) ?? re[0];
  const hotspots = re
    .filter((r) => r.attrs.name && (r.attrs["idle-timeout"] !== undefined || r.attrs.interface))
    .map((r) => r.attrs.name)
    .filter(Boolean);
  // hotspot print may mix with resource; also accept name-only from second query
  const hsNames = [
    ...new Set(
      rows
        .filter((r) => r.type === "re" && r.attrs.name)
        .map((r) => r.attrs.name)
        .filter((n) => n && n !== resource?.attrs["board-name"]),
    ),
  ];
  return {
    ok: true as const,
    identity: resource?.attrs["board-name"] || resource?.attrs.version || "",
    version: resource?.attrs.version || "",
    boardName: resource?.attrs["board-name"] || "",
    uptime: resource?.attrs.uptime || "",
    cpuLoad: resource?.attrs["cpu-load"] ? Number(resource.attrs["cpu-load"]) : null,
    hotspotServers: hsNames.length ? hsNames : hotspots,
  };
}

export async function apiUpsertHotspotUser(
  creds: ApiCreds,
  input: {
    username: string;
    password: string;
    profile: string;
    limitUptime: string;
    rateLimit: string;
    sharedUsers: string;
    comment: string;
  },
) {
  // find existing
  const found = await apiCall(creds, [
    ["/ip/hotspot/user/print", `?name=${input.username}`],
  ]);
  const existing = found.find((r) => r.type === "re" && r.attrs.name === input.username);
  const setWords = [
    `=password=${input.password}`,
    `=profile=${input.profile}`,
    `=limit-uptime=${input.limitUptime}`,
    `=rate-limit=${input.rateLimit}`,
    // shared-users may be on profile; also try on user where supported
    `=comment=${input.comment}`,
  ];
  if (existing?.attrs[".id"]) {
    await apiCall(creds, [
      [
        "/ip/hotspot/user/set",
        `=.id=${existing.attrs[".id"]}`,
        ...setWords,
      ],
    ]);
  } else {
    await apiCall(creds, [
      [
        "/ip/hotspot/user/add",
        `=name=${input.username}`,
        ...setWords,
      ],
    ]);
  }
  // Best-effort: ensure one-device profile exists (ROS6)
  try {
    await apiCall(creds, [
      [
        "/ip/hotspot/user/profile/add",
        "=name=telnet-1dev",
        "=shared-users=1",
        "=rate-limit=" + input.rateLimit,
      ],
    ]);
  } catch {
    /* profile may already exist */
  }
  try {
    const found2 = await apiCall(creds, [
      ["/ip/hotspot/user/print", `?name=${input.username}`],
    ]);
    const ex = found2.find((r) => r.type === "re");
    if (ex?.attrs[".id"]) {
      await apiCall(creds, [
        [
          "/ip/hotspot/user/set",
          `=.id=${ex.attrs[".id"]}`,
          "=profile=telnet-1dev",
        ],
      ]);
    }
  } catch {
    /* keep default profile */
  }
}

export async function apiDisableUser(creds: ApiCreds, username: string) {
  const found = await apiCall(creds, [
    ["/ip/hotspot/user/print", `?name=${username}`],
  ]);
  const existing = found.find((r) => r.type === "re");
  if (existing?.attrs[".id"]) {
    await apiCall(creds, [
      ["/ip/hotspot/user/set", `=.id=${existing.attrs[".id"]}`, "=disabled=yes"],
    ]);
  }
}

export async function apiDisconnectUser(creds: ApiCreds, username: string) {
  const found = await apiCall(creds, [
    ["/ip/hotspot/active/print", `?user=${username}`],
  ]);
  for (const row of found.filter((r) => r.type === "re")) {
    if (row.attrs[".id"]) {
      await apiCall(creds, [
        ["/ip/hotspot/active/remove", `=.id=${row.attrs[".id"]}`],
      ]);
    }
  }
}
