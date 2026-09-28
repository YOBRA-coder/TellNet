/**
 * Minimal RADIUS auth + accounting for TelNet hotspot billing.
 * Reads active packages from the TelNet ledger — does not create new billing sessions.
 * AP roaming: same username + remaining Session-Timeout on every AP.
 */
const dgram = require("dgram");
const crypto = require("crypto");
const { readStore } = require("./store");

const CODE = {
  ACCESS_REQUEST: 1,
  ACCESS_ACCEPT: 2,
  ACCESS_REJECT: 3,
  ACCOUNTING_REQUEST: 4,
  ACCOUNTING_RESPONSE: 5,
};

const ATTR = {
  UserName: 1,
  UserPassword: 2,
  CHAPPassword: 3,
  NASIPAddress: 4,
  NASPort: 5,
  ServiceType: 6,
  FramedProtocol: 7,
  ReplyMessage: 18,
  State: 24,
  Class: 25,
  SessionTimeout: 27,
  IdleTimeout: 28,
  CalledStationId: 30,
  CallingStationId: 31,
  NASIdentifier: 32,
  ProxyState: 33,
  CHAPChallenge: 60,
  NASPortType: 61,
  PortLimit: 62,
  MessageAuthenticator: 80,
};

const MIKROTIK_VENDOR = 14988;
const MIKROTIK_RATE_LIMIT = 8; // string "rx/tx" in k or M

function md5(...parts) {
  const h = crypto.createHash("md5");
  for (const p of parts) h.update(p);
  return h.digest();
}

function decodeAttrs(buf, offset, end) {
  const attrs = [];
  let i = offset;
  while (i + 2 <= end) {
    const type = buf[i];
    const len = buf[i + 1];
    if (len < 2 || i + len > end) break;
    const value = buf.subarray(i + 2, i + len);
    attrs.push({ type, value });
    i += len;
  }
  return attrs;
}

function encodeAttr(type, value) {
  const v = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  if (v.length > 253) throw new Error("RADIUS attribute too long");
  return Buffer.concat([Buffer.from([type, v.length + 2]), v]);
}

function encodeVendorAttr(vendorId, vendorType, value) {
  const v = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  const vendorHeader = Buffer.alloc(6);
  vendorHeader.writeUInt32BE(vendorId, 0);
  vendorHeader[4] = vendorType;
  vendorHeader[5] = v.length + 2;
  const body = Buffer.concat([vendorHeader, v]);
  return encodeAttr(26, body); // Vendor-Specific
}

/** Decrypt PAP User-Password */
function decryptPapPassword(encrypted, secret, requestAuth) {
  if (!encrypted || encrypted.length < 16 || encrypted.length % 16 !== 0) return null;
  const secretBuf = Buffer.from(secret, "utf8");
  let prev = requestAuth;
  const out = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i += 16) {
    const b = md5(secretBuf, prev);
    for (let j = 0; j < 16; j++) out[i + j] = encrypted[i + j] ^ b[j];
    prev = encrypted.subarray(i, i + 16);
  }
  // strip trailing nulls
  let end = out.length;
  while (end > 0 && out[end - 1] === 0) end--;
  return out.subarray(0, end).toString("utf8");
}

function verifyChap(password, chapPassword, chapChallenge, requestAuth) {
  // chapPassword: 1 byte id + 16 byte hash
  if (!chapPassword || chapPassword.length < 17) return false;
  const id = chapPassword[0];
  const response = chapPassword.subarray(1, 17);
  const challenge = chapChallenge && chapChallenge.length ? chapChallenge : requestAuth;
  const expected = md5(
    Buffer.from([id]),
    Buffer.from(password, "utf8"),
    challenge,
  );
  return expected.equals(response);
}

function remainingSeconds(expiryIso) {
  const ms = new Date(expiryIso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

function rateLimitString(uploadKbps, downloadKbps) {
  const up = Math.max(64, Number(uploadKbps) || 1024);
  const down = Math.max(64, Number(downloadKbps) || 2048);
  // MikroTik format: rx/tx where rx=upload from client view? Actually Mikrotik-Rate-Limit is rx/tx in the attribute docs as upload/download from user
  // Common: "1M/2M" = upload/download
  const fmt = (k) => (k >= 1024 && k % 1024 === 0 ? `${k / 1024}M` : `${k}k`);
  return `${fmt(up)}/${fmt(down)}`;
}

/**
 * Find active package for RADIUS User-Name.
 * Username formats: u712345678, phone, or explicit mikrotikUsername.
 */
function findActivePackage(username) {
  const store = readStore();
  const now = Date.now();
  const name = String(username || "").trim();
  if (!name) return null;

  const packs = (store.customerPackages || []).filter(
    (c) => c.status === "ACTIVE" && new Date(c.expiryTime).getTime() > now,
  );

  let pack =
    packs.find((c) => c.mikrotikUsername === name) ||
    packs.find((c) => c.phone === name) ||
    packs.find((c) => `u${String(c.phone).slice(-9)}` === name) ||
    null;

  if (!pack) return null;

  // Password convention matches REST activation
  const password = pack.radiusPassword || (pack.mikrotikUsername || name).slice(-8);
  const remain = remainingSeconds(pack.expiryTime);
  if (remain <= 0) return null;

  return {
    pack,
    password,
    sessionTimeout: remain,
    uploadKbps: store.settings?.defaultUploadKbps || 1024,
    downloadKbps: pack.speedLimitKbps || 2048,
  };
}

function buildResponse({ code, id, requestAuth, secret, attrs }) {
  const attrBufs = attrs.map((a) =>
    a.vendor
      ? encodeVendorAttr(a.vendor, a.vendorType, a.value)
      : encodeAttr(a.type, a.value),
  );
  const attrsJoined = Buffer.concat(attrBufs);
  const length = 20 + attrsJoined.length;
  const header = Buffer.alloc(4);
  header[0] = code;
  header[1] = id;
  header.writeUInt16BE(length, 2);

  // Response authenticator = MD5(Code+ID+Length+RequestAuth+Attributes+Secret)
  const respAuth = md5(
    header,
    requestAuth,
    attrsJoined,
    Buffer.from(secret, "utf8"),
  );

  return Buffer.concat([header, respAuth, attrsJoined]);
}

function handleAccessRequest(msg, secret) {
  const id = msg[1];
  const length = msg.readUInt16BE(2);
  const requestAuth = msg.subarray(4, 20);
  const attrs = decodeAttrs(msg, 20, Math.min(length, msg.length));

  const get = (type) => attrs.find((a) => a.type === type)?.value;

  const username = get(ATTR.UserName)?.toString("utf8") || "";
  const userPasswordEnc = get(ATTR.UserPassword);
  const chapPassword = get(ATTR.CHAPPassword);
  const chapChallenge = get(ATTR.CHAPChallenge);

  const found = findActivePackage(username);
  if (!found) {
    return buildResponse({
      code: CODE.ACCESS_REJECT,
      id,
      requestAuth,
      secret,
      attrs: [{ type: ATTR.ReplyMessage, value: "No active TelNet package" }],
    });
  }

  let ok = false;
  if (chapPassword) {
    ok = verifyChap(found.password, chapPassword, chapChallenge, requestAuth);
  } else if (userPasswordEnc) {
    const plain = decryptPapPassword(userPasswordEnc, secret, requestAuth);
    ok = plain === found.password;
  }

  if (!ok) {
    return buildResponse({
      code: CODE.ACCESS_REJECT,
      id,
      requestAuth,
      secret,
      attrs: [{ type: ATTR.ReplyMessage, value: "Invalid credentials" }],
    });
  }

  // Access-Accept — remaining time only (roaming-safe, no new bill)
  const sessionBuf = Buffer.alloc(4);
  sessionBuf.writeUInt32BE(found.sessionTimeout, 0);
  const portLimit = Buffer.alloc(4);
  portLimit.writeUInt32BE(1, 0); // one concurrent session / device

  return buildResponse({
    code: CODE.ACCESS_ACCEPT,
    id,
    requestAuth,
    secret,
    attrs: [
      { type: ATTR.SessionTimeout, value: sessionBuf },
      { type: ATTR.PortLimit, value: portLimit },
      {
        vendor: MIKROTIK_VENDOR,
        vendorType: MIKROTIK_RATE_LIMIT,
        value: rateLimitString(found.uploadKbps, found.downloadKbps),
      },
      {
        type: ATTR.ReplyMessage,
        value: `TelNet OK ${found.pack.packageName} ${found.sessionTimeout}s left`,
      },
      {
        type: ATTR.Class,
        value: found.pack.id, // echo for accounting correlation
      },
    ],
  });
}

function handleAccounting(msg, secret) {
  const id = msg[1];
  const requestAuth = msg.subarray(4, 20);
  // Acknowledge only — billing clock stays on TelNet expiryTime
  return buildResponse({
    code: CODE.ACCOUNTING_RESPONSE,
    id,
    requestAuth,
    secret,
    attrs: [],
  });
}

function startRadiusServer(options = {}) {
  const getConfig = options.getConfig || (() => ({ enabled: false, secret: "", authPort: 1812, acctPort: 1813 }));

  const authSock = dgram.createSocket("udp4");
  const acctSock = dgram.createSocket("udp4");

  function onMessage(msg, rinfo, kind) {
    try {
      const cfg = getConfig();
      if (!cfg.enabled || !cfg.secret) return;
      if (!msg || msg.length < 20) return;
      const code = msg[0];
      let reply = null;
      if (kind === "auth" && code === CODE.ACCESS_REQUEST) {
        reply = handleAccessRequest(msg, cfg.secret);
      } else if (kind === "acct" && code === CODE.ACCOUNTING_REQUEST) {
        reply = handleAccounting(msg, cfg.secret);
      }
      if (reply) {
        const sock = kind === "auth" ? authSock : acctSock;
        sock.send(reply, 0, reply.length, rinfo.port, rinfo.address);
      }
    } catch (err) {
      console.error("[radius]", err.message || err);
    }
  }

  authSock.on("message", (msg, rinfo) => onMessage(msg, rinfo, "auth"));
  acctSock.on("message", (msg, rinfo) => onMessage(msg, rinfo, "acct"));
  authSock.on("error", (e) => console.error("[radius auth]", e.message));
  acctSock.on("error", (e) => console.error("[radius acct]", e.message));

  let started = false;
  function bind() {
    const cfg = getConfig();
    if (!cfg.enabled) {
      console.log("[radius] disabled (enable in Operator → Settings)");
      return;
    }
    const authPort = Number(cfg.authPort) || 1812;
    const acctPort = Number(cfg.acctPort) || 1813;
    try {
      authSock.bind(authPort, "0.0.0.0", () =>
        console.log(`[radius] auth listening on UDP ${authPort}`),
      );
      acctSock.bind(acctPort, "0.0.0.0", () =>
        console.log(`[radius] acct listening on UDP ${acctPort}`),
      );
      started = true;
    } catch (e) {
      console.error("[radius] bind failed", e.message);
    }
  }

  // Bind once at start if enabled; settings changes need process restart for port
  bind();

  return {
    authSock,
    acctSock,
    findActivePackage,
    handleAccessRequest,
    isStarted: () => started,
  };
}

module.exports = {
  startRadiusServer,
  findActivePackage,
  CODE,
  ATTR,
};
