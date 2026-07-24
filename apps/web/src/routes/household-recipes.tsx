import { Image } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { VisualJournalFeed } from "../components/visual-journal-feed.js";
import { PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdRecipesRoute({ householdId, pageNumber }: { householdId: string; pageNumber: number }) {
  const { households, visualJournal } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined || visualJournal === null || visualJournal.householdId !== householdId || visualJournal.section !== "recipes") {
    return <NotFoundRoute />;
  }
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band visual-journal-page">
        <PageHeader title={`Recipes in ${household.name}`} action={<span className="journal-total">{visualJournal.total}<small>Total recipes</small></span>}>
          <p>Your household’s recorded recipe history, with Saved, Cooked, and Liked kept independent.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="recipes" />
        {visualJournal.total === 0 ? (
          <div className="visual-journal-empty"><Image aria-hidden="true" /><h2>No recipes recorded yet</h2><p>Ask ChatGPT or Claude to track a recipe, then it will appear here.</p></div>
        ) : <VisualJournalFeed initialPage={visualJournal} pageNumber={pageNumber} />}
        <p className="journal-image-note">Recipe images load from their recorded source with no Fullwell referrer. A missing image never hides the journal record.</p>
      </section>
    </AppShell>
  );
}
