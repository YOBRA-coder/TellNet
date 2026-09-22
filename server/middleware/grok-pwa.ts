// server/middleware/grok-pwa.ts

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defineEventHandler,
  getRequestHeader,
  getRequestURL,
  setResponseHeader,
} from "h3";

import {
  acceptsHtml,
  isDocumentPath,
  isInstallQuery,
  renderInstallPageHtml,
  renderWebManifest,
} from "../../scripts/grok-pwa-shared.mjs";

const INSTALL_PAGE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/install-page.html",
);

let installPageTemplate: string | undefined;

function getInstallPageTemplate(): string {
  if (installPageTemplate === undefined) {
    installPageTemplate = readFileSync(INSTALL_PAGE_PATH, "utf8");
  }

  return installPageTemplate;
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;
  const method = event.node?.req.method?.toUpperCase() ?? "GET";

  if (method !== "GET") {
    return;
  }

  const host = getRequestHeader(event, "x-forwarded-host")
    || getRequestHeader(event, "host")
    || "";

  // -------------------------------------------------------------------------
  // PWA manifest
  // -------------------------------------------------------------------------

  if (
    pathname === "/__grok/manifest.webmanifest"
    || pathname === "/__grok/manifest.json"
  ) {
    setResponseHeader(
      event,
      "content-type",
      "application/manifest+json; charset=utf-8",
    );
    setResponseHeader(event, "cache-control", "no-cache");

    return renderWebManifest(host);
  }

  // -------------------------------------------------------------------------
  // iOS install tutorial
  // -------------------------------------------------------------------------

  if (
    isInstallQuery(url.href)
    && isDocumentPath(pathname)
    && acceptsHtml(getRequestHeader(event, "accept"))
  ) {
    try {
      setResponseHeader(
        event,
        "content-type",
        "text/html; charset=utf-8",
      );
      setResponseHeader(event, "cache-control", "no-cache");

      return renderInstallPageHtml(getInstallPageTemplate(), {
        host,
        url: url.href,
      });
    } catch (error) {
      console.error("[app-builder] install page unavailable:", error);

      if (event.node?.res) {
        event.node.res.statusCode = 500;
      }
      setResponseHeader(
        event,
        "content-type",
        "text/plain; charset=utf-8",
      );

      return "install page unavailable";
    }
  }

  // Everything else continues to the normal Nitro/TanStack Start handler.
});