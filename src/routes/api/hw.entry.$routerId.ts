import { createFileRoute } from "@tanstack/react-router";

/**
 * Portal entry for TP-Link Omada's "External Portal Server". Set the Omada
 * portal URL to  https://<your-app>/api/hw/entry/<routerId>
 * The controller appends clientMac, apMac, ssidName, radioId, site, t, redirectUrl
 * (or clientMac, gatewayMac, vid, site, t, redirectUrl for a gateway).
 */
async function handle(request: Request, routerId: string) {
  const { handleOmadaEntry } = await import("@/lib/services/hardware/entry.server");
  return handleOmadaEntry(request, routerId);
}

export const Route = createFileRoute("/api/hw/entry/$routerId")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params.routerId),
    },
  },
});
