import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  Radio,
  Settings,
  Ticket,
  Users,
  Wifi,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { TelNetMark } from "@/components/brand";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import { APP_NAME } from "@/lib/brand-copy";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/live-users", label: "Live users", icon: Wifi },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/packages", label: "Packages", icon: Package },
  { to: "/admin/payments", label: "Transactions", icon: CreditCard },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/reports", label: "Reports", icon: Activity },
  { to: "/admin/network", label: "Network", icon: Radio },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [more, setMore] = useState(false);

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 lg:flex">
        <Link to="/admin/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <TelNetMark className="size-6" />
          <span className="font-display text-base font-semibold">{APP_NAME}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                  active
                    ? "bg-raised text-fg"
                    : "text-muted hover:bg-raised/60 hover:text-fg",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 px-1">
          <UserButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <TelNetMark className="size-6" />
            <span className="font-display font-semibold">{APP_NAME}</span>
          </Link>
          <UserButton />
        </header>
        <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        <nav className="sticky bottom-0 grid grid-cols-4 border-t border-border bg-surface/95 px-1 py-1 lg:hidden">
          {NAV.slice(0, 3).map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md py-2 text-xs",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(
              "flex flex-col items-center gap-1 rounded-md py-2 text-xs",
              more ? "text-accent" : "text-muted",
            )}
            onClick={() => setMore(true)}
          >
            <Menu className="size-4" />
            More
          </button>
        </nav>
      </div>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader>
            <SheetTitle className="font-display">Console</SheetTitle>
          </SheetHeader>
          <nav className="mt-4 grid grid-cols-2 gap-2">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMore(false)}
                  className={cn(
                    "flex h-12 items-center gap-2 rounded-lg border border-border px-3 text-sm",
                    active ? "bg-raised text-fg" : "text-muted",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
