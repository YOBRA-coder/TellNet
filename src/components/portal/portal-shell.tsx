import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TelNetMark } from "@/components/brand";
import { Home } from "lucide-react";

export function PortalShell({
  hotspotName,
  children,
  footer,
  maintenanceMode,
  maintenanceMessage,
}: {
  hotspotName: string;
  children: ReactNode;
  footer?: ReactNode;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
}) {
  return (
    <div className="atmosphere flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link to="/portal" className="flex items-center gap-2">
          <TelNetMark className="size-7" />
          <span className="font-display text-base font-semibold tracking-tight">
            {hotspotName}
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-xs text-base">
          <Link to="/portal/account" className="hover:text-muted">
            Account
          </Link>
          <Link to="/portal/rewards" className="hover:text-muted">
            Rewards
          </Link>
          <Link
  to="/"
  aria-label="Go to public website"
  title="Public website"
  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-fg active:scale-95"
>
  <Home className="h-5 w-5" />
</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
        {maintenanceMode ? (
          <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">
            {maintenanceMessage ||
              "We're doing scheduled maintenance right now. Please try again shortly."}
          </div>
        ) : null}
        {children}
      </main>
      {footer && (
        <footer className="mx-auto w-full max-w-md px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      )}
    </div>
  );
}

export function PortalSupportSection({
  supportPhone,
  supportWhatsapp,
  supportMessage,
}: {
  supportPhone?: string | null;
  supportWhatsapp?: string | null;
  supportMessage?: string | null;
}) {
  if (!supportPhone && !supportWhatsapp && !supportMessage) return null;
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4 text-sm">
      <p className="font-medium">Need help?</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {supportPhone ? (
          <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} className="text-accent">
            Call {supportPhone}
          </a>
        ) : null}
        {supportWhatsapp ? (
          <a
            href={`https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            WhatsApp {supportWhatsapp}
          </a>
        ) : null}
        {supportMessage ? <p className="text-muted">{supportMessage}</p> : null}
      </div>
    </div>
  );
}
