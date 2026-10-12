import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { APP_NAME } from "@/lib/brand-copy";
import { makeQueryClient } from "@/lib/query";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          APP_NAME + " Wi-Fi — pay with M-Pesa, connect, stay online. ISP-agnostic hotspot billing.",
      },
      { name: "theme-color", content: "#09090b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa/apple-touch-icon.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Syne:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [queryClient] = useState(() => makeQueryClient());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    // Operator pages install as their own app (opens on the dashboard); everything else installs the customer portal.
    try {
      const p = pathname;
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (link) link.href = p.startsWith("/admin") || p.startsWith("/login") ? "/admin.webmanifest" : "/manifest.webmanifest";
    } catch {
      /* installing is optional */
    }
  }, [pathname]);
  useEffect(() => {
    try {
      // A service worker (even a tiny one) is what lets browsers offer a real install instead of a shortcut.
      if ("serviceWorker" in navigator && window.isSecureContext) {
        void navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    } catch {
      /* installing is optional */
    }
  }, []);
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background: "#18181c",
                  border: "1px solid #27272a",
                  color: "#f4f4f5",
                },
              }}
            />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
