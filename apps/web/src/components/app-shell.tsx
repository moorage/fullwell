import type { ReactNode } from "react";
import { PUBLIC_BRAND } from "../brand.js";
import { useWebContext } from "../context.js";

type AppShellProps = {
  children: ReactNode;
  context?: "public" | "workspace" | "focused";
  active?: "households" | "collections" | "guides" | "account" | "about" | "company";
};

export function AppShell({ children, context = "public", active }: AppShellProps) {
  const { households } = useWebContext();
  const collectionsHref = households[0] === undefined ? "/households" : `/households/${households[0].id}/collections`;
  return (
    <div className={`app app--${context}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="masthead">
        <a className="wordmark" href={context === "workspace" ? "/households" : "/"}>
          <span className="wordmark__stamp" aria-hidden="true">
            <img
              className="wordmark__face"
              src="/assets/fullwell-face-square.png"
              alt=""
              width="454"
              height="455"
              decoding="async"
            />
          </span>
          <span>Fullwell</span>
        </a>
        {context === "workspace" ? (
          <nav className="primary-nav" aria-label="Primary navigation">
            <a aria-current={active === "households" ? "page" : undefined} href="/households">
              Households
            </a>
            <a
              aria-current={active === "collections" ? "page" : undefined}
              href={collectionsHref}
            >
              Collections
            </a>
            <a aria-current={active === "guides" ? "page" : undefined} href="/guides">
              Guides
            </a>
            <a aria-current={active === "account" ? "page" : undefined} href="/account">
              Account
            </a>
          </nav>
        ) : context === "public" ? (
          <nav className="primary-nav" aria-label="Primary navigation">
            <a aria-current={active === "about" ? "page" : undefined} href="/about">About</a>
            <a href="/#whatsapp">WhatsApp</a>
            <a aria-current={active === "guides" ? "page" : undefined} href="/guides">Guides</a>
            <a className="masthead__action" href="/sign-in">Sign in</a>
          </nav>
        ) : null}
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="site-footer__identity">
          <p>Fullwell is a product of Sous Chef Studio, Inc.</p>
          <p>© 2026 Sous Chef Studio, Inc. Fullwell is a product of Sous Chef Studio, Inc.</p>
        </div>
        <nav aria-label="Company and legal">
          <a href="/about">About Fullwell</a>
          <a href="/#whatsapp">WhatsApp</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href={`mailto:${PUBLIC_BRAND.supportEmail}`}>Support</a>
        </nav>
      </footer>
    </div>
  );
}

export function HouseholdNav({ householdId, active }: { householdId: string; active: string }) {
  const { capabilities } = useWebContext();
  const links = [
    { id: "overview", label: "Overview", href: `/households/${householdId}` },
    ...(capabilities.mealPlanning
      ? [{ id: "meal-plan", label: "Meal plans", href: `/households/${householdId}/meal-plan` }]
      : []),
    { id: "recipes", label: "Recipes", href: `/households/${householdId}/recipes` },
    { id: "groceries", label: "Groceries", href: `/households/${householdId}/groceries` },
    { id: "takeout", label: "Takeout", href: `/households/${householdId}/takeout` },
    { id: "members", label: "Members", href: `/households/${householdId}/members` },
    { id: "collections", label: "Collections", href: `/households/${householdId}/collections` },
  ];
  return (
    <nav className="local-nav" aria-label="Household">
      {links.map((link) => (
        <a key={link.id} href={link.href} aria-current={active === link.id ? "page" : undefined}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
