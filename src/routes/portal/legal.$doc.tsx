import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { LEGAL_BRAND, LEGAL_BY_SLUG, parseLegalBody, type LegalSlug } from "@/content/legal";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";

const portalRoute = getRouteApi("/portal");

export const Route = createFileRoute("/portal/legal/$doc")({
  head: ({ params }) => {
    const d = LEGAL_BY_SLUG[params.doc as LegalSlug];
    return { meta: [{ title: d ? `${d.label} · ${LEGAL_BRAND}` : LEGAL_BRAND }] };
  },
  component: LegalPage,
});

function LegalPage() {
  const { doc } = Route.useParams();
  const { settings } = portalRoute.useLoaderData();
  const d = LEGAL_BY_SLUG[doc as LegalSlug];
  const hotspot = settings.hotspotName ?? HOTSPOT_FALLBACK;

  if (!d) {
    return (
      <PortalShell hotspotName={hotspot} maintenanceMode={settings.maintenanceMode} maintenanceMessage={settings.maintenanceMessage}>
        <h1 className="font-display text-2xl font-semibold">Page not found</h1>
        <Link to="/portal" className="mt-4 text-sm text-accent">
          Back to packages
        </Link>
      </PortalShell>
    );
  }

  const blocks = parseLegalBody(d.body);
  const whatsapp = settings.supportWhatsapp?.replace(/[^0-9]/g, "");
  const hasContact = Boolean(settings.supportPhone || settings.supportWhatsapp || settings.supportMessage);

  return (
    <PortalShell hotspotName={hotspot} maintenanceMode={settings.maintenanceMode} maintenanceMessage={settings.maintenanceMessage}>
      <Link
        to="/portal"
        className="-ml-1 mb-3 inline-flex min-h-10 touch-manipulation items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <article>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">{LEGAL_BRAND}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{d.title}</h1>
        {d.effectiveDate ? <p className="mt-1 text-sm text-muted">Effective Date: {d.effectiveDate}</p> : null}

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <h2 key={i} className="pt-3 font-display text-base font-semibold tracking-tight text-fg">
                {b.text}
              </h2>
            ) : b.kind === "ul" ? (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b.text}</p>
            ),
          )}
        </div>

        {/* Contact details come from Operator -> Settings (support phone / WhatsApp / message) */}
        {d.slug === "contact" || hasContact ? (
          <section className="mt-6 rounded-xl border border-border bg-surface/60 p-4 text-sm">
            <h2 className="font-display text-base font-semibold">Contact {LEGAL_BRAND}</h2>
            {hasContact ? (
              <div className="mt-2 flex flex-col gap-1.5">
                {settings.supportPhone ? (
                  <a href={`tel:${settings.supportPhone.replace(/\s+/g, "")}`} className="text-accent">
                    Call {settings.supportPhone}
                  </a>
                ) : null}
                {settings.supportWhatsapp ? (
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="text-accent">
                    WhatsApp {settings.supportWhatsapp}
                  </a>
                ) : null}
                {settings.supportMessage ? <p className="text-muted">{settings.supportMessage}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-muted">Contact details will be added here shortly.</p>
            )}
          </section>
        ) : null}
      </article>
    </PortalShell>
  );
}
