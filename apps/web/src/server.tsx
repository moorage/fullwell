import { renderToString } from "react-dom/server";
import { App } from "./app.js";
import type { WebRenderContext } from "./types.js";

export type RenderedWebRoute = {
  appHtml: string;
  title: string;
};

const pageTitles: Record<string, string> = {
  "/install": "Install Fullwell",
  "/guides": "Advanced agent guides",
  "/guides/whatsapp": "Connect WhatsApp",
  "/guides/household-invitations": "Invite household members",
  "/guides/collections/create": "Create a collection",
  "/guides/collections/share": "Share a collection",
  "/sign-in": "Sign in to Fullwell",
  "/authorize": "Allow agent access",
  "/households": "Your households",
  "/account": "Account",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
};

export function renderWebRoute(url: string, context: WebRenderContext): RenderedWebRoute {
  const pathname = new URL(url, "https://fullwell.example").pathname;
  const title = pageTitles[pathname] ?? (
    pathname.startsWith("/c/") ? "Shared collection"
      : pathname.startsWith("/invite/") ? "Family invitation"
        : pathname.endsWith("/meal-plan") ? "Weekly meal plan"
          : pathname.endsWith("/recipes") ? "Household recipes"
            : pathname.endsWith("/groceries") ? "Household groceries"
              : pathname.startsWith("/households/") ? "Household" : "Fullwell"
  );
  return { appHtml: renderToString(<App url={url} context={context} />), title };
}
