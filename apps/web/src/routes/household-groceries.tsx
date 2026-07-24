import { PackageOpen } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { VisualJournalFeed } from "../components/visual-journal-feed.js";
import { PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdGroceriesRoute({ householdId, pageNumber }: { householdId: string; pageNumber: number }) {
  const { households, visualJournal } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined || visualJournal === null || visualJournal.householdId !== householdId || visualJournal.section !== "groceries") {
    return <NotFoundRoute />;
  }
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band visual-journal-page">
        <PageHeader title={`Groceries in ${household.name}`} action={<span className="journal-total">{visualJournal.total}<small>Total groceries</small></span>}>
          <p>The snacks, ingredients, condiments, and other groceries your household has recorded.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="groceries" />
        {visualJournal.total === 0 ? (
          <div className="visual-journal-empty"><PackageOpen aria-hidden="true" /><h2>No groceries recorded yet</h2><p>Ask ChatGPT or Claude to audit purchases, then recorded items will appear here.</p></div>
        ) : <VisualJournalFeed initialPage={visualJournal} pageNumber={pageNumber} />}
        <p className="journal-image-note">Fullwell displays recorded journal details only. It does not infer brands, products, or categories in this browser view.</p>
      </section>
    </AppShell>
  );
}
