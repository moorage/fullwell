import { renderToString } from "react-dom/server";
import { App } from "./app.js";
import { FULLWELL_DESCRIPTION, HOMEPAGE_DESCRIPTION, PUBLIC_BRAND } from "./brand.js";
import type { WebRenderContext } from "./types.js";

export type WebPageMetadata = {
  readonly description: string;
  readonly canonicalUrl: string;
  readonly openGraph: {
    readonly siteName: "Fullwell";
    readonly title: string;
    readonly description: string;
    readonly url: string;
    readonly imageUrl: string;
    readonly imageAlt: string;
  };
  readonly structuredDataJson?: string;
};

export type RenderedWebRoute = {
  appHtml: string;
  title: string;
  metadata?: WebPageMetadata;
};

const pageTitles: Record<string, string> = {
  "/": "Fullwell Household Assistant | By Sous Chef Studio",
  "/install": "Install Fullwell",
  "/about": "About Fullwell | Household Assistant",
  "/company": "Fullwell Company Information | Sous Chef Studio",
  "/guides": "Advanced agent guides",
  "/guides/whatsapp": "Connect WhatsApp",
  "/guides/household-name": "Name your household",
  "/guides/household-invitations": "Invite household members",
  "/guides/collections/create": "Create a collection",
  "/guides/collections/share": "Share a collection",
  "/sign-in": "Sign in to Fullwell",
  "/authorize": "Allow agent access",
  "/households": "Your households",
  "/account": "Cloud account",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
};

type PublicPageDescription = {
  readonly description: string;
  readonly openGraphTitle: string;
};

const publicPageDescriptions: Record<string, PublicPageDescription> = {
  "/": {
    description: HOMEPAGE_DESCRIPTION,
    openGraphTitle: "Fullwell Household Assistant",
  },
  "/install": {
    description: "Install Fullwell, the household assistant by Sous Chef Studio, for a supported AI agent and connect optional household features such as WhatsApp.",
    openGraphTitle: "Install Fullwell Household Assistant",
  },
  "/about": {
    description: FULLWELL_DESCRIPTION,
    openGraphTitle: "About Fullwell Household Assistant",
  },
  "/company": {
    description: "Verify Fullwell's product name, official domains, WhatsApp functionality, and ownership and operation by Sous Chef Studio, Inc.",
    openGraphTitle: "Fullwell Company Information",
  },
  "/guides": {
    description: "Public guides for using the Fullwell household assistant through supported AI agents and optional channels such as WhatsApp.",
    openGraphTitle: "Fullwell Household Assistant Guides",
  },
  "/guides/whatsapp": {
    description: "Connect WhatsApp as an optional communication channel for the Fullwell household assistant.",
    openGraphTitle: "Use Fullwell from WhatsApp",
  },
  "/guides/household-name": {
    description: "Rename a Fullwell household in chat or from the household website as an authorized owner.",
    openGraphTitle: "Name Your Fullwell Household",
  },
  "/guides/household-invitations": {
    description: "Learn how Fullwell households invite family members and keep each person's access attributable.",
    openGraphTitle: "Invite Household Members with Fullwell",
  },
  "/guides/collections/create": {
    description: "Learn how to create a private Fullwell collection from household recipes, groceries, and takeout dishes.",
    openGraphTitle: "Create a Fullwell Collection",
  },
  "/guides/collections/share": {
    description: "Learn how to publish a reviewed, time-limited Fullwell collection for sharing.",
    openGraphTitle: "Share a Fullwell Collection",
  },
  "/privacy": {
    description: "The privacy policy for Fullwell, a household-assistant product operated by Sous Chef Studio, Inc.",
    openGraphTitle: "Fullwell Privacy Policy",
  },
  "/terms": {
    description: "The terms of service for Fullwell, a household-assistant product operated by Sous Chef Studio, Inc.",
    openGraphTitle: "Fullwell Terms of Service",
  },
};

export function renderWebRoute(url: string, context: WebRenderContext): RenderedWebRoute {
  const pathname = new URL(url, "https://local.invalid").pathname;
  const title = pageTitles[pathname] ?? (
    pathname.startsWith("/c/") ? "Shared collection"
      : pathname.startsWith("/invite/") ? "Family invitation"
        : pathname.endsWith("/meal-plan") ? "Weekly meal plan"
          : pathname.endsWith("/recipes") ? "Household recipes"
            : pathname.endsWith("/groceries") ? "Household groceries"
              : pathname.endsWith("/takeout") ? "Household takeout"
              : pathname.startsWith("/households/") ? "Household" : "Fullwell"
  );
  const pageDescription = publicPageDescriptions[pathname];
  const metadata = pageDescription === undefined
    ? undefined
    : buildPublicMetadata(pathname, pageDescription, context);
  return {
    appHtml: renderToString(<App url={url} context={context} />),
    title,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function buildPublicMetadata(
  pathname: string,
  page: PublicPageDescription,
  context: WebRenderContext,
): WebPageMetadata {
  const canonicalUrl = new URL(pathname, context.canonicalUrl).toString();
  const imageUrl = new URL(PUBLIC_BRAND.socialImagePath, context.canonicalUrl).toString();
  return {
    description: page.description,
    canonicalUrl,
    openGraph: {
      siteName: "Fullwell",
      title: page.openGraphTitle,
      description: page.description,
      url: canonicalUrl,
      imageUrl,
      imageAlt: "Fullwell household assistant by Sous Chef Studio",
    },
    ...(pathname === "/" ? { structuredDataJson: fullwellStructuredDataJson(context) } : {}),
  };
}

function fullwellStructuredDataJson(context: WebRenderContext): string {
  const applicationUrl = new URL("/", context.canonicalUrl).toString();
  const iconUrl = new URL(PUBLIC_BRAND.iconPath, context.canonicalUrl).toString();
  const organizationId = `${PUBLIC_BRAND.companyUrl}#organization`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: PUBLIC_BRAND.companyName,
        url: PUBLIC_BRAND.companyUrl,
      },
      {
        "@type": "WebApplication",
        "@id": `${applicationUrl}#application`,
        name: PUBLIC_BRAND.productName,
        url: applicationUrl,
        sameAs: [PUBLIC_BRAND.primaryProductDomain],
        description: FULLWELL_DESCRIPTION,
        image: iconUrl,
        thumbnailUrl: iconUrl,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        brand: {
          "@type": "Brand",
          name: PUBLIC_BRAND.productName,
          logo: iconUrl,
        },
        provider: {
          "@id": organizationId,
        },
      },
    ],
  }).replaceAll("<", "\\u003c");
}
