import { getHwRouter, saveClientContext, siteSlugForRouter } from "./index";

/** Omada external-portal landing: remember who the client is, then show the normal portal. */
export async function handleOmadaEntry(request: Request, routerId: string): Promise<Response> {
  const router = await getHwRouter(routerId);
  if (!router || router.type !== "omada") return new Response("Not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const ctxId = await saveClientContext({
    routerId,
    vendor: "omada",
    clientMac: q.get("clientMac") ?? "",
    apMac: q.get("apMac"),
    ssid: q.get("ssidName"),
    radioId: q.get("radioId"),
    siteName: q.get("site"),
    extra: {
      gatewayMac: q.get("gatewayMac") ?? "",
      vid: q.get("vid") ?? "",
      t: q.get("t") ?? "",
      redirectUrl: q.get("redirectUrl") ?? "",
    },
  });
  const slug = await siteSlugForRouter(routerId);
  const u = new URL("/portal", request.url);
  if (slug) u.searchParams.set("site", slug);
  if (ctxId) u.searchParams.set("hwc", ctxId);
  return Response.redirect(u.toString(), 302);
}
