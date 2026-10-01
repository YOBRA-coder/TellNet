import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { TelNetMark } from "@/components/brand";
import { PackageBrowser } from "@/components/portal/package-browser";
import { Button } from "@/components/ui/button";
import { APP_NAME, HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { getPublicHome } from "@/lib/fn/public";
import { PortalSupportSection } from "@/components/portal/portal-shell";
import { readSite } from "@/lib/device";
import { getPortalBootstrap } from "@/lib/fn/portal";
import { useDevice } from "@/hooks/use-device";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data } = useQuery({ queryKey: ["home"], queryFn: () => getPublicHome() });
  const hotspot = data?.hotspotName ?? HOTSPOT_FALLBACK;
  // const packages = data?.packages ?? [];
  const currency = data?.currency ?? "KES";

  // State to track if header should be visible
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const { device, ready, update } = useDevice();

const q = useQuery({
  queryKey: ["portal", device?.token, readSite() ?? ""],
  enabled: ready && Boolean(device),
  queryFn: () =>
    getPortalBootstrap({
      data: {
        token: device!.token,
        phone: device?.phone ?? undefined,
        customerId: device?.customerId ?? undefined,
        site: readSite(),
      },
    }),
});

const settings = (q.data?.settings ?? {}) as Record<string, any>;
const packages = q.data?.packages ?? [];


  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 1. Always show the header if we are near the very top of the page
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
      // 2. Hide if scrolling down, Show if scrolling up
      else if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className="atmosphere min-h-dvh">
      {/* Dynamic Smart Header */}
      <header
        className={`sticky top-0 z-50 border-b border-border/40 bg-surface/80 backdrop-blur-md transition-transform duration-300 ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <TelNetMark className="size-8" />
            <span className="font-display text-lg font-semibold">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/portal" className="text-muted hover:text-fg">
              Packages
            </Link>
            <Link to="/portal/recover" className="text-muted hover:text-fg">
              Already paid?
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:pt-12">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
          {hotspot}
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {data?.welcomeMessage ?? "Welcome to Wi-Fi"}
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Choose a package, pay with M-Pesa, and you are online the moment
          payment is confirmed. Same package if you disconnect — no second
          charge until it expires.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl">
            <Link to="/portal">
              Open portal
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {data?.internetUp && (
          <p className="mt-6 max-w-md rounded-lg border border-warn/20 bg-warn/10 px-3 py-2 text-sm text-warn">
            Connected to the Internet.
          </p>
        )}
      </section>

      <section id="packages" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-16">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
            Packages
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            Pay. Connect. Stay online.
          </h2>
        </div>

        {/* Replaced individual PackageCards with PackageBrowser using portal properties */}
        <div className="mt-4">
          {!data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-48 animate-pulse rounded-2xl border border-border bg-surface"
                />
              ))}
            </div>
          ) : (
            <PackageBrowser
              packages={packages}
              currency={settings?.currency ?? currency}
              registered={q.data ? Boolean(q.data.member?.registered) : null}
              requireAccountForMulti={Boolean(settings?.requireAccountMultiDevice)}
              rewardsOn={Boolean(settings?.loyaltyEnabled || settings?.referralEnabled)}
            />
          )}
        </div>

        <p className="mt-5 text-center text-sm">
          <Link to="/portal/recover" className="text-muted hover:text-fg">
            Already paid? Recover my package
          </Link>
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-3">
        <Feature
          icon={<Wifi className="size-4" />}
          title="Connect to Wi-Fi"
          body="Join the hotspot. This page is the captive portal — pick a package on your phone."
        />
        <Feature
          icon={<Smartphone className="size-4" />}
          title="Pay with M-Pesa"
          body="Enter your Kenyan number. Confirm the STK prompt. Internet turns on only after the payment is verified."
        />
        <Feature
          icon={<ShieldCheck className="size-4" />}
          title="Come back anytime"
          body="Switch Wi-Fi off and return later. If time remains, tap Connect. No second charge."
        />
      </section>

      <div className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-3">
        {settings?.supportPhone || settings?.supportWhatsapp ? (
          <div className="col-span-full mt-6 text-center text-sm text-muted">
            <PortalSupportSection
              supportPhone={settings.supportPhone}
              supportWhatsapp={settings.supportWhatsapp}
              supportMessage={settings.supportMessage}
            />
          </div>
        ) : null}
      </div>

      <footer className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-10 text-xs text-subtle">
        <span>
          {APP_NAME} · Independent of the ISP path carrying your traffic
        </span>
        <Link to="/login" className="text-subtle/40 hover:text-subtle">
          Operator
        </Link>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <div className="flex size-9 items-center justify-center rounded-md border border-border bg-raised text-accent">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
