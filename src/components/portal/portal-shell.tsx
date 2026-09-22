import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TelNetMark } from "@/components/brand";

export function PortalShell({
  hotspotName,
  children,
  footer,
}: {
  hotspotName: string;
  children: ReactNode;
  footer?: ReactNode;
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
        <Link to="/" className="text-xs text-subtle hover:text-muted">
          Home
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
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
