import { getCookie, setCookie } from "@tanstack/react-start/server";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "__Host-telnet-operator";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function getSecret() {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!secret) {
    throw new Error("No server secret configured for operator authentication.");
  }

  return new TextEncoder().encode(secret);
}

export async function createOperatorSession() {
  const token = await new SignJWT({
    role: "operator",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function hasOperatorSession() {
  const token = getCookie(COOKIE_NAME);

  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    return payload.role === "operator";
  } catch {
    return false;
  }
}

export function clearOperatorSession() {
  setCookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}