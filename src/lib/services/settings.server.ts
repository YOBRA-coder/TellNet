import { getSql } from "@/lib/db";
import { mapSettings, type SqlRow } from "./rows.server";
import type { Settings } from "@/lib/types";

export type SettingsSecret = Settings & {
  mpesaConsumerKey: string | null;
  mpesaConsumerSecret: string | null;
  mpesaPasskey: string | null;
  mikrotikPassword: string | null;
};

export async function getSettings(): Promise<Settings> {
  const sql = await getSql();
  const rows = await sql<SqlRow>`select * from settings where id = 'default' limit 1`;
  if (!rows[0]) {
    await sql`insert into settings (id) values ('default') on conflict (id) do nothing`;
    const again = await sql<SqlRow>`select * from settings where id = 'default' limit 1`;
    return mapSettings(again[0] ?? { id: "default" });
  }
  return mapSettings(rows[0]);
}

export async function getSettingsSecret(): Promise<SettingsSecret> {
  const sql = await getSql();
  const rows = await sql<SqlRow>`select * from settings where id = 'default' limit 1`;
  const row = rows[0] ?? { id: "default" };
  return {
    ...mapSettings(row),
    mpesaConsumerKey: row.mpesa_consumer_key ? String(row.mpesa_consumer_key) : null,
    mpesaConsumerSecret: row.mpesa_consumer_secret
      ? String(row.mpesa_consumer_secret)
      : null,
    mpesaPasskey: row.mpesa_passkey ? String(row.mpesa_passkey) : null,
    mikrotikPassword: row.mikrotik_password ? String(row.mikrotik_password) : null,
  };
}

export async function logEvent(eventType: string, description: string) {
  const sql = await getSql();
  const id = `ev_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await sql`insert into network_events (id, event_type, description) values (${id}, ${eventType}, ${description})`;
}
