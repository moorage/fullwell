import { AppShell } from "../components/app-shell.js";
import { ButtonLink, PageHeader } from "../components/ui.js";

export function NotFoundRoute() {
  return (
    <AppShell>
      <section className="narrow-page page-band">
        <PageHeader title="Page not found"><p>The address may be incomplete or no longer available.</p></PageHeader>
        <ButtonLink href="/install" variant="secondary">Go to Fullwell</ButtonLink>
      </section>
    </AppShell>
  );
}
