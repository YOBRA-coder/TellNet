import { createFileRoute } from "@tanstack/react-router";

/**
 * Ruijie / Reyee WiFiDog endpoints. Set the gateway's External Portal
 * "Server URL" to  https://<your-app>/api/hw/wd/<routerId>/
 */
async function handle(request: Request, params: { routerId: string; _splat?: string }) {
  const { handleWifidog } = await import("@/lib/services/hardware/wifidog.server");
  return handleWifidog(request, params.routerId, params._splat ?? "");
}

export const Route = createFileRoute("/api/hw/wd/$routerId/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params),
    },
  },
});
