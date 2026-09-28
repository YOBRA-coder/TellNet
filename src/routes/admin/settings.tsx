import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getSettingsAdmin, saveSettingsAdmin } from "@/lib/fn/admin";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsAdmin() });
  const [form, setForm] = useState({
    hotspotName: "TelNet Wi-Fi",
    currency: "KES",
    welcomeMessage: "Welcome to Wi-Fi",
    mpesaShortcode: "",
    mpesaConsumerKey: "",
    mpesaConsumerSecret: "",
    mpesaPasskey: "",
    mpesaEnv: "sandbox" as "sandbox" | "production",
    mpesaCallbackUrl: "",
    defaultUploadKbps: 1024,
    ispTotalKbps: 30720,
    perUserMaxKbps: 5120,
    maxUsers: 25,
    oneDevicePerPackage: true,
    maxDevicesPerPackage: 1 as 1 | 2,
    maintenanceMode: false,
    maintenanceMessage: "",
    supportPhone: "",
    supportWhatsapp: "",
    supportMessage: "",
    loyaltyEnabled: false,
    loyaltyPointsPerKes: 1,
    referralBonusPoints: 50,
    referralEnabled: true,
    referralBonusMinutes: 30,
    welcomeBonusMinutes: 10,
    referralMinPackagePrice: 20,
    studentBlockedDomains: "",
    operatorPassword: "",
    radiusEnabled: false,
    radiusSecret: "",
    radiusAuthPort: 1812,
    radiusAcctPort: 1813,
  });

  useEffect(() => {
    if (!q.data) return;
    setForm((f) => ({
      ...f,
      hotspotName: q.data.hotspotName,
      currency: q.data.currency,
      welcomeMessage: q.data.welcomeMessage,
      mpesaShortcode: q.data.mpesaShortcode ?? "",
      mpesaEnv: q.data.mpesaEnv === "production" ? "production" : "sandbox",
      mpesaCallbackUrl: q.data.mpesaCallbackUrl ?? "",
      defaultUploadKbps: q.data.defaultUploadKbps,
      ispTotalKbps: q.data.ispTotalKbps,
      perUserMaxKbps: q.data.perUserMaxKbps,
      maxUsers: q.data.maxUsers,
      oneDevicePerPackage: q.data.oneDevicePerPackage,
      maxDevicesPerPackage: q.data.maxDevicesPerPackage >= 2 ? 2 : 1,
      maintenanceMode: q.data.maintenanceMode,
      maintenanceMessage: q.data.maintenanceMessage ?? "",
      supportPhone: q.data.supportPhone ?? "",
      supportWhatsapp: q.data.supportWhatsapp ?? "",
      supportMessage: q.data.supportMessage ?? "",
      loyaltyEnabled: q.data.loyaltyEnabled,
      loyaltyPointsPerKes: q.data.loyaltyPointsPerKes,
      referralBonusPoints: q.data.referralBonusPoints,
      referralEnabled: q.data.referralEnabled,
      referralBonusMinutes: q.data.referralBonusMinutes,
      welcomeBonusMinutes: q.data.welcomeBonusMinutes,
      referralMinPackagePrice: q.data.referralMinPackagePrice,
      studentBlockedDomains: q.data.studentBlockedDomains,
    }));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveSettingsAdmin({ data: form }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <form
      className="mx-auto max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Secrets are stored server-side and never sent back to the browser.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Captive portal</h2>
        <Field label="Hotspot name">
          <Input
            value={form.hotspotName}
            onChange={(e) => setForm({ ...form, hotspotName: e.target.value })}
          />
        </Field>
        <Field label="Welcome message">
          <Input
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
          />
        </Field>
        <Field label="Currency">
          <Input
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
        </Field>
        <Field label="Default upload (kbps)">
          <Input
            type="number"
            min={64}
            value={form.defaultUploadKbps}
            onChange={(e) =>
              setForm({ ...form, defaultUploadKbps: Number(e.target.value) })
            }
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">ISP capacity</h2>
        <p className="text-sm leading-relaxed text-muted">
          Pool for Airtel 5G, Safaricom 5G, Starlink, fibre and any other WAN.
          TelNet caps each customer at the per-user maximum even if the package
          is higher, and holds new activations when the hotspot is full.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Total available (Mbps)">
            <Input
              type="number"
              min={1}
              step={1}
              value={Math.round(form.ispTotalKbps / 1024)}
              onChange={(e) =>
                setForm({
                  ...form,
                  ispTotalKbps: Math.max(1, Number(e.target.value) || 1) * 1024,
                })
              }
            />
          </Field>
          <Field label="Per-user maximum (Mbps)">
            <Input
              type="number"
              min={1}
              step={1}
              value={Math.round(form.perUserMaxKbps / 1024)}
              onChange={(e) =>
                setForm({
                  ...form,
                  perUserMaxKbps: Math.max(1, Number(e.target.value) || 1) * 1024,
                })
              }
            />
          </Field>
          <Field label="Maximum connected users">
            <Input
              type="number"
              min={1}
              max={500}
              value={form.maxUsers}
              onChange={(e) =>
                setForm({ ...form, maxUsers: Number(e.target.value) || 1 })
              }
            />
          </Field>
        </div>
        <p className="text-xs text-subtle">
          Default hotspot pool: 30 Mbps total · 5 Mbps per user · 20–30 seats.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Device sharing</h2>
        <Toggle
          label="One device per package"
          hint='When a customer connects, the package is bound to that phone (or up to however many devices that specific package allows). A device beyond the limit is blocked with “This package is already in use on another device.” MikroTik hotspot profiles telnet-1dev / telnet-2dev use matching shared-users values so the router enforces the same limit. Turn this off to allow unlimited devices on every package.'
          checked={form.oneDevicePerPackage}
          onCheckedChange={(v) => setForm({ ...form, oneDevicePerPackage: v })}
        />
        {form.oneDevicePerPackage ? (
          <p className="text-xs text-subtle">
            How many devices each package allows (1 or 2) is set per package
            now, not here — open{" "}
            <Link to="/admin/packages" className="text-accent underline">
              Packages
            </Link>{" "}
            and edit the "Devices allowed" field on each one.
          </p>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Maintenance mode</h2>
        <Toggle
          label="Put the portal in maintenance mode"
          hint="Blocks new M-Pesa STK pushes and shows this message on the captive portal instead of the package list. Customers with time already paid for are not affected."
          checked={form.maintenanceMode}
          onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
        />
        <Field label="Banner message shown to customers">
          <Textarea
            placeholder="We're doing scheduled maintenance and will be back online shortly. Thanks for your patience."
            value={form.maintenanceMessage}
            onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Captive portal support</h2>
        <p className="text-sm text-muted">
          Shown as a "Need help?" section on the portal. Leave any field blank to
          hide it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support phone (call)">
            <Input
              placeholder="0712 345 678"
              value={form.supportPhone}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
            />
          </Field>
          <Field label="Support WhatsApp">
            <Input
              placeholder="0712 345 678"
              value={form.supportWhatsapp}
              onChange={(e) => setForm({ ...form, supportWhatsapp: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Extra note (optional)">
          <Textarea
            placeholder="Support hours: 7am – 10pm daily"
            value={form.supportMessage}
            onChange={(e) => setForm({ ...form, supportMessage: e.target.value })}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Loyalty points</h2>
        <Toggle
          label="Enable loyalty points"
          hint="Customers earn points on every completed purchase and can redeem them for reward packages you mark below."
          checked={form.loyaltyEnabled}
          onCheckedChange={(v) => setForm({ ...form, loyaltyEnabled: v })}
        />
        <Field label="Points earned per KES spent">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={form.loyaltyPointsPerKes}
            onChange={(e) =>
              setForm({ ...form, loyaltyPointsPerKes: Number(e.target.value) })
            }
          />
        </Field>
        <p className="text-xs text-subtle">
          To make a package redeemable with points, set its points cost on the
          Packages page.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Referral bonus (minutes)</h2>
        <Toggle
          label="Enable referral bonus"
          hint="A customer gets a referral code once they sign up with their phone. Someone using that code on a qualifying purchase gets extra minutes on their package, and the referrer gets minutes too — independent of loyalty points."
          checked={form.referralEnabled}
          onCheckedChange={(v) => setForm({ ...form, referralEnabled: v })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Referrer bonus (minutes)">
            <Input
              type="number"
              min={0}
              value={form.referralBonusMinutes}
              onChange={(e) =>
                setForm({ ...form, referralBonusMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Welcome bonus for referred customer (minutes)">
            <Input
              type="number"
              min={0}
              value={form.welcomeBonusMinutes}
              onChange={(e) =>
                setForm({ ...form, welcomeBonusMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Minimum package price to allow a code (KES)">
            <Input
              type="number"
              min={0}
              value={form.referralMinPackagePrice}
              onChange={(e) =>
                setForm({ ...form, referralMinPackagePrice: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        <p className="text-xs text-subtle">
          The referred customer's welcome bonus + referral minutes are added
          once, to their very first package. Packages priced at or below the
          minimum above don't show a referral code field at all.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Student packages</h2>
        <p className="text-sm text-muted">
          Any package marked "Student" on the Packages page gets its own
          hotspot profile and this domain blocklist applied on the router.
          Comma-separated, no "www." or "https://" — e.g.{" "}
          <span className="font-mono">facebook.com, youtube.com</span>.
        </p>
        <Field label="Non-study domains to block">
          <Textarea
            rows={3}
            value={form.studentBlockedDomains}
            onChange={(e) =>
              setForm({ ...form, studentBlockedDomains: e.target.value })
            }
            placeholder="facebook.com, instagram.com, tiktok.com, youtube.com"
          />
        </Field>
        <p className="text-xs text-subtle">
          Enforced via a router-side domain filter (layer7 + firewall rule).
          This is best-effort — it won't catch traffic behind a VPN or
          DNS-over-HTTPS, and support varies by RouterOS version, so verify
          it actually blocks these domains on your own router.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">M-Pesa Daraja — live</h2>
        <p className="text-sm text-muted">
          No demo STK. Payments only go out when these credentials are saved.
          Use sandbox for Daraja test numbers, production for live till.
        </p>
        <p className="text-sm text-muted">
          {q.data?.hasMpesaKey ? "Consumer key on file." : "No consumer key stored."}{" "}
          {q.data?.hasMpesaSecret ? "Secret on file." : "No secret stored."}{" "}
          {q.data?.hasMpesaPasskey ? "Passkey on file." : "No passkey stored."}
        </p>
        <Field label="Environment">
          <select
            className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm"
            value={form.mpesaEnv}
            onChange={(e) =>
              setForm({
                ...form,
                mpesaEnv: e.target.value === "production" ? "production" : "sandbox",
              })
            }
          >
            <option value="sandbox">Sandbox (test)</option>
            <option value="production">Production (live)</option>
          </select>
        </Field>
        <Field label="Shortcode / Till">
          <Input
            value={form.mpesaShortcode}
            onChange={(e) => setForm({ ...form, mpesaShortcode: e.target.value })}
          />
        </Field>
        <Field label="Callback URL (public HTTPS)">
          <Input
            placeholder="https://your-domain.com/api/mpesa/callback"
            value={form.mpesaCallbackUrl}
            onChange={(e) => setForm({ ...form, mpesaCallbackUrl: e.target.value })}
          />
        </Field>
        <Field label="Consumer key">
          <Input
            type="password"
            autoComplete="off"
            placeholder="Leave blank to keep existing"
            value={form.mpesaConsumerKey}
            onChange={(e) => setForm({ ...form, mpesaConsumerKey: e.target.value })}
          />
        </Field>
        <Field label="Consumer secret">
          <Input
            type="password"
            autoComplete="off"
            placeholder="Leave blank to keep existing"
            value={form.mpesaConsumerSecret}
            onChange={(e) =>
              setForm({ ...form, mpesaConsumerSecret: e.target.value })
            }
          />
        </Field>
        <Field label="Passkey">
          <Input
            type="password"
            autoComplete="off"
            placeholder="Leave blank to keep existing"
            value={form.mpesaPasskey}
            onChange={(e) => setForm({ ...form, mpesaPasskey: e.target.value })}
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">MikroTik</h2>
        <p className="text-sm leading-relaxed text-muted">
          Add real routers on the Network page — host, REST user, password and
          hotspot server. Credentials never leave the server.
        </p>
        {q.data?.mikrotikHost ? (
          <p className="font-mono text-sm">
            Primary: {q.data.mikrotikHost}
            {q.data.mikrotikUser ? ` · ${q.data.mikrotikUser}` : ""}
          </p>
        ) : (
          <p className="text-sm text-subtle">No primary router registered yet.</p>
        )}
        <Button asChild variant="secondary">
          <Link to="/admin/network">Open Network</Link>
        </Button>
      </Card>

      
      
      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">RADIUS (multi-AP)</h2>
        <p className="text-sm text-muted">
          Central auth for all APs. Same package time across APs — no new bill on roam.
          Run <code className="text-xs">node scripts/radius-server.mjs</code> in production or point FreeRADIUS at TelNet users.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.radiusEnabled}
            onChange={(e) => setForm({ ...form, radiusEnabled: e.target.checked })}
          />
          Enable RADIUS
        </label>
        <Field label="Shared secret">
          <Input
            type="password"
            value={form.radiusSecret}
            onChange={(e) => setForm({ ...form, radiusSecret: e.target.value })}
            placeholder="Paste to update"
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Operator password</h2>
        <p className="text-sm text-muted">
          Shared password for the operator console. Leave blank to keep the current password.
        </p>
        <Field label="New operator password (min 4 characters)">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.operatorPassword}
            onChange={(e) => setForm({ ...form, operatorPassword: e.target.value })}
            placeholder="Leave blank to keep unchanged"
          />
        </Field>
      </Card>
<Button type="submit" size="lg" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
