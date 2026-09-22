import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getSettings } from "@/lib/services/settings.server";
import { mapIsp, mapPackage, type SqlRow } from "@/lib/services/rows.server";
import { createOperatorSession } from "@/lib/auth/operator-session.server";

export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const settings = await getSettings();
  const packages = (
    await sql<SqlRow>`
      select * from packages where status = 'ACTIVE' order by sort_order, price
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

/** Shared operator password login — no email / OAuth. */
export const loginOperator = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
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
