import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getSettings } from "@/lib/services/settings.server";
import { mapIsp, mapPackage, type SqlRow } from "@/lib/services/rows.server";
//import { createOperatorSession } from "@/lib/auth/operator-session.server";
import { createOperatorSession } from "../auth/operator-session.server";

export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const settings = await getSettings();
  const packages = (
    await sql<SqlRow>`
      select * from packages where status = 'ACTIVE' order by price asc, sort_order asc, duration_minutes asc
    `
  ).map(mapPackage);
  const isps = (await sql<SqlRow>`select * from isps order by sort_order`).map(mapIsp);
  return {
    hotspotName: settings.hotspotName,
    welcomeMessage: settings.welcomeMessage,
    currency: settings.currency,
    demoMode: false,
    packages,
    internetUp: isps.some((i) => i.status !== "OFFLINE"),
  };
});

/** What the login page should offer: old shared password (no accounts yet) or phone + password, and whether SMS reset works. */
export const getOperatorLoginInfoFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getOperatorLoginInfo } = await import("../services/operators.server");
  return getOperatorLoginInfo();
});

/**
 * Operator login. With accounts: phone + password. Before the first account exists the
 * old shared password still works (so an upgrade never locks anyone out).
 */
export const loginOperator = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ phone: z.string().max(30).optional(), password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { countOperators, loginWithPhone } = await import("../services/operators.server");
    const { createOperatorSession } = await import("../auth/operator-session.server");
    if ((await countOperators()) > 0) {
      const res = await loginWithPhone({ phone: data.phone ?? "", password: data.password });
      if (!res.ok) return { ok: false as const, error: res.error };
      await createOperatorSession(res.operator.id);
      return { ok: true as const };
    }
    const sql = await getSql();
    const row = (
      await sql<{ operator_password: string | null }>`
        select operator_password from settings where id = 'default' limit 1
      `
    )[0];
    const expected = (row?.operator_password || "telnet-admin").trim();
    if (data.password !== expected) {
      return { ok: false as const, error: "Incorrect operator password." };
    }
    await createOperatorSession();
    return { ok: true as const };
  });

export const requestOperatorOtpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ phone: z.string().min(9).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const { requestOperatorOtp } = await import("../services/operators.server");
    return requestOperatorOtp(data);
  });

/** Code from SMS + new password; signs the operator straight in. */
export const resetOperatorPasswordFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ phone: z.string().min(9).max(20), code: z.string().min(4).max(10), next: z.string().min(6).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { resetOperatorPasswordWithOtp } = await import("../services/operators.server");
    const { createOperatorSession } = await import("../auth/operator-session.server");
    const res = await resetOperatorPasswordWithOtp(data);
    if (!res.ok) return { ok: false as const, error: res.error };
    await createOperatorSession(res.operator.id);
    return { ok: true as const };
  });

  export const getOperatorSession = createServerFn({
  method: "GET",
}).handler(async () => {
  const { getOperatorIdentity } = await import("../auth/operator-session.server");
  const who = await getOperatorIdentity();
  return {
    ok: who !== null,
    name: who?.name ?? null,
    owner: who?.owner ?? false,
    needsAccount: who !== null && who.id === null,
  };
});

export const logoutOperator = createServerFn({
  method: "POST",
}).handler(async () => {
  const { clearOperatorSession } =
    await import("../auth/operator-session.server");

  clearOperatorSession();

  return { ok: true as const };
});