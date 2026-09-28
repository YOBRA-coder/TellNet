import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mpesa/callback")({
  server: {
    handlers: {
      GET: () => new Response("ok"),
      POST: async ({ request }) => {
        const { handleMpesaCallback } = await import(
          "@/lib/services/callback.server"
        );
        return handleMpesaCallback(request);
      },
    },
  },
});
