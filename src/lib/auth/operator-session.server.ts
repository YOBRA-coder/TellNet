import { SignJWT, jwtVerify } from "jose";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

const COOKIE_NAME = "__telnet-operator";
// Long enough that the installed phone app does not keep logging out; disabling an account ends its session immediately (checked on every request).
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret() {
  const secret =
    process.env.OPERATOR_SESSION_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "OPERATOR_SESSION_SECRET or BETTER_AUTH_SECRET must be configured",
    );
  }

  return new TextEncoder().encode(secret);
}

/** opId = a real operator account; without it this is the old shared-password session (only valid while no accounts exist). */
export async function createOperatorSession(opId?: string) {
  const token = await new SignJWT({
    role: "operator",
    ...(opId ? { opId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .setSubject("operator")
    .sign(getSecret());

  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export type OperatorIdentity = {
  /** null = old shared-password session (no accounts exist yet) */
  id: string | null;
  name: string;
  phone: string | null;
  owner: boolean;
  /** operators are limited to this site; null = every site (owners, and the pre-accounts shared session) */
  siteId: string | null;
};

export async function getOperatorIdentity(): Promise<OperatorIdentity | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  if (payload.sub !== "operator" || payload.role !== "operator") return null;
  const { countOperators, getOperatorById } = await import("../services/operators.server");
  const opId = typeof payload.opId === "string" ? payload.opId : null;
  if (!opId) {
    // Shared-password session: only honoured until the first account is created.
    return (await countOperators()) === 0 ? { id: null, name: "Operator", phone: null, owner: true, siteId: null } : null;
  }
  const op = await getOperatorById(opId);
  if (!op || op.status !== "ACTIVE") return null;
  return { id: op.id, name: op.name, phone: op.phone, owner: op.role === "OWNER", siteId: op.role === "OWNER" ? null : op.siteId };
}

export async function hasOperatorSession(): Promise<boolean> {
  return (await getOperatorIdentity()) !== null;
}

/** Throws unless the signed-in operator is an owner (or the pre-accounts shared session). */
export async function requireOwner(): Promise<OperatorIdentity> {
  const who = await getOperatorIdentity();
  if (!who || !who.owner) throw new Error("Only an owner can do this.");
  return who;
}

export function clearOperatorSession() {
  deleteCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}