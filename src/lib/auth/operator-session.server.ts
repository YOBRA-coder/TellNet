import { SignJWT, jwtVerify } from "jose";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

const COOKIE_NAME = "__Host-telnet-operator";
const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret() {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.OPERATOR_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET or OPERATOR_SESSION_SECRET must be configured",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createOperatorSession() {
  const token = await new SignJWT({
    role: "operator",
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

export async function hasOperatorSession(): Promise<boolean> {
  const token = getCookie(COOKIE_NAME);

  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    return payload.sub === "operator" && payload.role === "operator";
  } catch {
    return false;
  }
}

export function clearOperatorSession() {
  deleteCookie(COOKIE_NAME, {
    path: "/",
  });
}