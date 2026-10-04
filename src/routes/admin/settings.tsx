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
import {
  applyRadiusToRouters,
  checkMpesaSetupAdmin,
  checkRadiusRouters,
  getCapacityStatus,
  getRadiusStatus,
  getSettingsAdmin,
  saveSettingsAdmin,
  sendMpesaTestPromptAdmin,
} from "@/lib/fn/admin";

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
    mpesaAccountType: "paybill" as "paybill" | "till",
    mpesaTillNumber: "",
    mpesaCallbackUrl: "",
    defaultUploadKbps: 1024,
    capacityMode: "PER_ISP" as "PER_ISP" | "GLOBAL",
    requireAccountMultiDevice: true,
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
    radiusServerHost: "",
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
      mpesaAccountType: q.data.mpesaAccountType === "till" ? "till" : "paybill",
      mpesaTillNumber: q.data.mpesaTillNumber ?? "",
      mpesaCallbackUrl: q.data.mpesaCallbackUrl ?? "",
      defaultUploadKbps: q.data.defaultUploadKbps,
      capacityMode: q.data.capacityMode,
      requireAccountMultiDevice: q.data.requireAccountMultiDevice,
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
      // Without these the form kept its defaults and every save switched
      // RADIUS back off and reset the ports.
      radiusEnabled: q.data.radiusEnabled,
      radiusAuthPort: q.data.radiusAuthPort,
      radiusAcctPort: q.data.radiusAcctPort,
      radiusServerHost: q.data.radiusServerHost ?? "",
    }));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveSettingsAdmin({ data: form }),
    onSuccess: (res) => {
      toast.success("Settings saved");
      if (res.radius?.error) toast.error(res.radius.error, { duration: 10_000 });
      setForm((f) => ({ ...f, radiusSecret: "" }));
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["radius-status"] });
      qc.invalidateQueries({ queryKey: ["capacity"] });
    },
    onError: () => toast.error("Could not save settings. Check the values and try again."),
  });

  const capQ = useQuery({ queryKey: ["capacity"], queryFn: () => getCapacityStatus() });
  const radiusQ = useQuery({
    queryKey: ["radius-status"],
    queryFn: () => getRadiusStatus(),
    refetchInterval: 10_000,
  });
  const apply = useMutation({
    mutationFn: () => applyRadiusToRouters(),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      const bad = res.results.filter((r) => !r.ok);
      if (bad.length === 0) toast.success(`Applied to ${res.results.length} router(s). Run "Check routers" to confirm.`);
      else toast.error(bad.map((b) => `${b.name}: ${b.error}`).join(" · "), { duration: 12_000 });
    },
    onError: () => toast.error("Could not reach the routers."),
  });
  const check = useMutation({ mutationFn: () => checkRadiusRouters() });
  const [testPhone, setTestPhone] = useState("");
  const mpesaCheck = useMutation({
    mutationFn: () => checkMpesaSetupAdmin(),
    onError: () => toast.error("Could not run the M-Pesa check."),
  });
  const mpesaTest = useMutation({
    mutationFn: () => sendMpesaTestPromptAdmin({ data: { phone: testPhone } }),
    onSuccess: (r) =>
      r.ok
        ? toast.success("Prompt sent. Check your phone and enter your M-Pesa PIN (KES 1).")
        : toast.error(r.error, { duration: 12_000 }),
    onError: () => toast.error("Could not send the test prompt."),
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
        <Toggle
          label="Free account needed for 2-device packages"
          hint="Guests can buy 1-device packages. 2-device packages ask them to create a free account (phone + PIN) first. The portal shows a sign-up prompt."
          checked={form.requireAccountMultiDevice}
          onCheckedChange={(v) => setForm({ ...form, requireAccountMultiDevice: v })}
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">ISP capacity</h2>
        <p className="text-sm leading-relaxed text-muted">
          Every ISP path has its own limits (an Airtel 5G line is 15 or 30 Mbps, Starlink is much
          more). Set them per path on the Network page; TelNet then caps each customer and holds new
          activations using the ISP(s) that are connected right now.
        </p>
        <Toggle
          label="Use each ISP's own limits"
          hint="Off = one fixed set of limits (below) for every ISP."
          checked={form.capacityMode === "PER_ISP"}
          onCheckedChange={(v) => setForm({ ...form, capacityMode: v ? "PER_ISP" : "GLOBAL" })}
        />

        {capQ.data ? (
          <div className="space-y-2 rounded-lg border border-border bg-raised p-3 text-sm">
            <p className="font-medium">
              In effect now: {Math.round(capQ.data.totalKbps / 1024)} Mbps total ·{" "}
              {Math.round(capQ.data.perUserMaxKbps / 1024)} Mbps per user · {capQ.data.maxUsers} seats
            </p>
            <p className="text-xs text-subtle">
              {capQ.data.source === "isp"
                ? "Taken from the ISP paths marked ✓ below (total and seats add up; per-user is the best line's cap)."
                : capQ.data.mode === "GLOBAL"
                  ? "Taken from the fixed limits below."
                  : "No ISP paths added yet, so the fallback limits below are used."}
            </p>
            {capQ.data.paths.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted">
                {capQ.data.paths.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>
                      {p.counted ? "✓ " : "— "}
                      {p.name} <span className="text-subtle">({p.status.toLowerCase()})</span>
                    </span>
                    <span className="tabular-nums">
                      {Math.round(p.totalKbps / 1024)} / {Math.round(p.perUserMaxKbps / 1024)} Mbps · {p.maxUsers} seats
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link to="/admin/network" className="inline-block text-xs text-accent underline">
              Edit an ISP path's limits
            </Link>
            {capQ.data.fastestPackageKbps && capQ.data.fastestPackageKbps > capQ.data.perUserMaxKbps ? (
              <p className="rounded-md border border-warn/30 bg-warn/10 p-2 text-xs text-warn">
                Heads-up: your fastest package is {Math.round(capQ.data.fastestPackageKbps / 1024)} Mbps but
                customers are capped at {Math.round(capQ.data.perUserMaxKbps / 1024)} Mbps, so they never get
                the full package speed.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="pt-1 text-sm font-medium">
          {form.capacityMode === "PER_ISP" ? "Fallback limits" : "Fixed limits"}
        </p>
        <p className="-mt-2 text-xs text-subtle">
          {form.capacityMode === "PER_ISP"
            ? "Only used when no ISP path has been added."
            : "Applied to every customer whichever ISP is connected."}
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
        <p className="text-xs text-subtle">Save settings to apply changes.</p>
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
        {form.mpesaEnv === "production" ? (
          <p className="rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
            Live mode: sandbox keys, passkey and shortcode (174379) will not work here. Paste your
            production Consumer key, Consumer secret, Passkey and your real shortcode, save, then press
            "Check M-Pesa setup" below.
          </p>
        ) : null}
        <Field label="Account type">
          <select
            className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm"
            value={form.mpesaAccountType}
            onChange={(e) =>
              setForm({ ...form, mpesaAccountType: e.target.value === "till" ? "till" : "paybill" })
            }
          >
            <option value="paybill">Paybill (customers pay a Paybill number)</option>
            <option value="till">Till / Buy Goods (customers pay a Till number)</option>
          </select>
        </Field>
        <Field label={form.mpesaAccountType === "till" ? "Store / head-office number (shortcode)" : "Shortcode (Paybill number)"}>
          <Input
            inputMode="numeric"
            value={form.mpesaShortcode}
            onChange={(e) => setForm({ ...form, mpesaShortcode: e.target.value })}
          />
        </Field>
        {form.mpesaAccountType === "till" ? (
          <Field label="Till number (what customers pay)">
            <Input
              inputMode="numeric"
              value={form.mpesaTillNumber}
              onChange={(e) => setForm({ ...form, mpesaTillNumber: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Callback URL (public HTTPS)">
          <Input
            placeholder="https://your-domain.com/api/pay/callback"
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

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted">
            Save first, then check. The check asks Safaricom for an access token using the saved
            credentials; it charges nobody.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={mpesaCheck.isPending}
            onClick={() => mpesaCheck.mutate()}
          >
            {mpesaCheck.isPending ? "Checking…" : "Check M-Pesa setup"}
          </Button>
          {mpesaCheck.data ? (
            <div
              className={`rounded-md border p-3 text-sm ${
                mpesaCheck.data.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {mpesaCheck.data.ok ? (
                <p>
                  Safaricom accepted your {mpesaCheck.data.env} credentials ({mpesaCheck.data.host},{" "}
                  {mpesaCheck.data.accountType}). Now send a KES 1 test prompt to confirm the full flow.
                </p>
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  {mpesaCheck.data.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label htmlFor="mpesa-test-phone">Send a KES 1 test prompt to</Label>
              <Input
                id="mpesa-test-phone"
                inputMode="tel"
                placeholder="07XX XXX XXX (your own phone)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={mpesaTest.isPending || testPhone.trim().length < 9}
              onClick={() => mpesaTest.mutate()}
            >
              {mpesaTest.isPending ? "Sending…" : "Send test prompt"}
            </Button>
          </div>
          <p className="text-xs text-subtle">
            In live mode this is a real KES 1 payment into your own account. It isn't linked to any
            customer or package.
          </p>
        </div>
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
          One login works on every access point: the routers ask this app who is allowed online, so a
          customer's remaining time follows them when they roam. This app runs the RADIUS server itself
          (UDP) — the host must allow inbound UDP on the ports below.
        </p>
        <Toggle
          label="Enable RADIUS"
          hint="Starts the RADIUS listener in this app. Then press “Apply to routers” to configure MikroTik."
          checked={form.radiusEnabled}
          onCheckedChange={(v) => setForm({ ...form, radiusEnabled: v })}
        />
        <Field label="This server's address (what your routers can reach)">
          <Input
            value={form.radiusServerHost}
            onChange={(e) => setForm({ ...form, radiusServerHost: e.target.value })}
            placeholder="e.g. 203.0.113.10 or radius.example.com"
          />
        </Field>
        <Field
          label={`Shared secret${q.data?.hasRadiusSecret ? " (saved — type to replace)" : ""}`}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.radiusSecret}
            onChange={(e) => setForm({ ...form, radiusSecret: e.target.value })}
            placeholder={q.data?.hasRadiusSecret ? "•••••••• (unchanged)" : "Choose a long random secret"}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Auth port">
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.radiusAuthPort}
              onChange={(e) => setForm({ ...form, radiusAuthPort: Number(e.target.value) || 1812 })}
            />
          </Field>
          <Field label="Accounting port">
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.radiusAcctPort}
              onChange={(e) => setForm({ ...form, radiusAcctPort: Number(e.target.value) || 1813 })}
            />
          </Field>
        </div>

        {radiusQ.data ? (
          <div className="rounded-lg border border-border bg-raised p-3 text-xs text-muted">
            <p>
              Listener:{" "}
              <span className={radiusQ.data.listener.running ? "text-ok" : "text-subtle"}>
                {radiusQ.data.listener.running
                  ? `running on UDP ${radiusQ.data.listener.authPort}/${radiusQ.data.listener.acctPort}`
                  : "not running"}
              </span>
              {radiusQ.data.listener.requests > 0
                ? ` · ${radiusQ.data.listener.accepted} accepted, ${radiusQ.data.listener.rejected} rejected`
                : ""}
            </p>
            {radiusQ.data.listener.error ? (
              <p className="mt-1 text-danger">{radiusQ.data.listener.error}</p>
            ) : null}
            <p className="mt-1">
              Save first — Apply and Check use the saved settings, not unsaved edits.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => apply.mutate()} disabled={apply.isPending}>
            {apply.isPending ? "Applying…" : "Apply to routers"}
          </Button>
          <Button type="button" variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending ? "Checking…" : "Check routers"}
          </Button>
        </div>

        {check.data ? (
          <ul className="space-y-2 text-sm">
            {check.data.checks.length === 0 ? (
              <li className="text-muted">No routers to check.</li>
            ) : null}
            {check.data.checks.map((c) => {
              const problems: string[] = [];
              if (!c.reachable) problems.push(c.error ?? "Router unreachable");
              else if (check.data.enabled) {
                if (!c.entryFound) problems.push("No RADIUS entry on the router — press Apply");
                else {
                  if (c.entryDisabled) problems.push("RADIUS entry is disabled");
                  if (!c.addressMatches) problems.push("Server address differs from Settings");
                  if (!c.secretMatches) problems.push("Shared secret differs from Settings");
                  if (!c.portsMatch) problems.push("Ports differ from Settings");
                  if (c.hotspotUsesRadius === false)
                    problems.push(`Hotspot profile “${c.hotspotProfile}” has use-radius=no`);
                }
              } else if (c.entryFound && !c.entryDisabled) {
                problems.push("RADIUS is still active on the router — press Apply to turn it off");
              }
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <span className="font-medium">{c.name}</span>
                  <span className={problems.length === 0 ? "text-ok" : "text-danger"}>
                    {problems.length === 0 ? "OK — matches Settings" : problems.join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
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
