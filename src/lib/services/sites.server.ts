/**
 * Site (town) helpers shared by the portal catalog, payments and points.
 *
 * One rule for "is this package sold here?" so the package list, the
 * payment check and the points redemption can never disagree:
 *   - package_sites rows exist  -> sold only at those sites
 *   - no rows, packages.site_id null -> sold at every site
 *   - no rows, packages.site_id set (legacy) -> sold at that one site
 */
import { getSql } from "@/lib/db";

export type PortalSite = { id: string; name: string; slug: string };

/** Active site for a ?site=<slug> link, or null when the slug is missing/unknown/inactive. */
export async function findActiveSiteBySlug(slug?: string | null): Promise<PortalSite | null> {
  const clean = slug?.trim().toLowerCase();
  if (!clean) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; slug: string }>`
    select id, name, slug from sites where slug = ${clean} and status = 'ACTIVE' limit 1
  `;
  return rows[0] ?? null;
}

export async function getMainSite(): Promise<PortalSite> {
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; slug: string }>`
    select id, name, slug from sites where id = 'site_default' limit 1
  `;
  return rows[0] ?? { id: "site_default", name: "Main site", slug: "main" };
}

/** Is this package sold at this site? (see the rule at the top of the file) */
export async function isPackageSoldAtSite(packageId: string, siteId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ ok: boolean }>`
    select (
      exists (select 1 from package_sites ps where ps.package_id = p.id and ps.site_id = ${siteId})
      or (
        not exists (select 1 from package_sites ps where ps.package_id = p.id)
        and (p.site_id is null or p.site_id = ${siteId})
      )
    ) as ok
    from packages p where p.id = ${packageId} limit 1
  `;
  return Boolean(rows[0]?.ok);
}
