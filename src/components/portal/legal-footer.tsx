import { Link } from "@tanstack/react-router";
import { LEGAL_COPYRIGHT, LEGAL_DOCS } from "@/content/legal";

/** Copyright line + links to the policies, shown at the bottom of every customer-portal page. */
export function LegalFooter() {
  return (
    <div className="mt-6 border-t border-border/50 pt-4 text-center text-xs text-subtle">
      <p>{LEGAL_COPYRIGHT}</p>
      <nav aria-label="Legal" className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
        {LEGAL_DOCS.map((d, i) => (
          <span key={d.slug} className="inline-flex items-center">
            {i > 0 ? <span className="mr-1 text-subtle/60">·</span> : null}
            <Link
              to="/portal/legal/$doc"
              params={{ doc: d.slug }}
              className="inline-flex min-h-8 touch-manipulation items-center px-0.5 text-muted hover:text-fg hover:underline"
            >
              {d.label}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  );
}

/** "By purchasing a package, you agree to the HI-FI Terms & Conditions and Privacy Policy." */
export function PurchaseConsent({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs leading-relaxed text-subtle ${className}`}>
      By purchasing a package, you agree to the HI-FI{" "}
      <Link
        to="/portal/legal/$doc"
        params={{ doc: "terms" }}
        className="text-muted underline underline-offset-2 hover:text-fg"
      >
        Terms &amp; Conditions
      </Link>{" "}
      and{" "}
      <Link
        to="/portal/legal/$doc"
        params={{ doc: "privacy" }}
        className="text-muted underline underline-offset-2 hover:text-fg"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
