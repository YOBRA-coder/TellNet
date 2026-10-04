import { createFileRoute } from "@tanstack/react-router";

/**
 * Same handler as /api/mpesa/callback under a neutral path. Some Safaricom setups
 * refuse or silently drop callback URLs containing the word "mpesa"; if yours
 * does, use https://<your-domain>/api/pay/callback in Settings instead.
 */
export const Route = createFileRoute("/api/pay/callback")({
  server: {
    handlers: {
      GET: () => new Response("ok"),
      POST: async ({ request }) => {
        const { handleMpesaCallback } = await import("@/lib/services/callback.server");
        return handleMpesaCallback(request);
      },
    },
  },
});
