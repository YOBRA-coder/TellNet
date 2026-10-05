import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home } from "lucide-react";

import { TelNetMark } from "@/components/brand";
import { LegalFooter } from "@/components/portal/legal-footer";
import { useGlassBody } from "@/hooks/use-glass-body";

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
  useGlassBody();
  return (
    <div className="atmosphere glass-theme flex min-h-dvh flex-col">
      {/* Sticky top navigation */}
      <header
        className="
          sticky top-0 z-50
          flex items-center justify-between
          border-b border-white/10
          bg-white/[0.02]
          px-5
          pb-2
          pt-[max(0.75rem,env(safe-area-inset-top))]
          backdrop-blur-xl
        "
      >
        {/* Existing portal logo */}
        <Link
          to="/portal"
          className="flex items-center gap-2"
          aria-label="Portal home"
        >
          <TelNetMark className="size-7" />

          <span className="font-display text-base font-semibold tracking-tight">
            {hotspotName}
          </span>
        </Link>

        {/* Portal navigation */}
        <nav
          className="flex items-center gap-2 text-xs text-base"
          aria-label="Portal navigation"
        >
          <Link
            to="/portal/account"
            className="
              flex min-h-10 items-center
              rounded-lg px-2.5
              hover:bg-surface
              hover:text-muted
              active:scale-95
            "
          >
            Account
          </Link>

          <Link
            to="/portal/rewards"
            className="
              flex min-h-10 items-center
              rounded-lg px-2.5
              hover:bg-surface
              hover:text-muted
              active:scale-95
            "
          >
            Rewards
          </Link>

          {/* Public website */}
          <Link
            to="/"
            aria-label="Go to public website"
            title="Public website"
            className="
              flex h-10 w-10
              shrink-0
              items-center justify-center
              rounded-lg
              text-muted
              transition
              hover:bg-surface
              hover:text-fg
              active:scale-95
              touch-manipulation
            "
          >
            <Home className="h-5 w-5" />
          </Link>
        </nav>
      </header>

      {/* Page content */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
        {maintenanceMode ? (
          <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">
            {maintenanceMessage ||
              "We're doing scheduled maintenance right now. Please try again shortly."}
          </div>
        ) : null}

        {children}
      </main>

      {/* Footer: page-specific links, then the legal links on every page */}
      <footer className="mx-auto w-full max-w-md px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {footer}
        <LegalFooter />
      </footer>
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
  if (!supportPhone && !supportWhatsapp && !supportMessage) {
    return null;
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4 text-sm">
      <p className="font-medium">Need help?</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {supportPhone ? (
          <a
            href={`tel:${supportPhone.replace(/\s+/g, "")}`}
            className="text-accent"
          >
            Call {supportPhone}
          </a>
        ) : null}

        {supportWhatsapp ? (
          <a
            href={`https://wa.me/${supportWhatsapp.replace(
              /[^0-9]/g,
              "",
            )}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            WhatsApp {supportWhatsapp}
          </a>
        ) : null}

        {supportMessage ? (
          <p className="text-muted">{supportMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
