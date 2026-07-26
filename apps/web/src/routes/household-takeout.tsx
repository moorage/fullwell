import { ShoppingBag } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { VisualJournalFeed } from "../components/visual-journal-feed.js";
import { PageHeader, StatusNotice } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdTakeoutRoute({ householdId, pageNumber }: { householdId: string; pageNumber: number }) {
  const { households, visualJournal } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined || visualJournal?.section !== "takeout") return <NotFoundRoute />;
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band visual-journal-page visual-journal-page--takeout">
        <PageHeader
          title={`Delivery & takeout in ${household.name}`}
          action={<span className="journal-total">{visualJournal.total}<small>Takeout items</small></span>}
        >
          <p>Familiar dishes stay tied to the exact restaurant location where they were ordered or shared.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="takeout" />
        <StatusNotice tone="info" title="Start an order with your agent">
          <p>Ask Fullwell in ChatGPT or Claude to reorder a dish, change its options, or start from a previous order. Fullwell can prepare the cart, but it never checks out.</p>
        </StatusNotice>
        {visualJournal.items.length === 0 ? (
          <div className="visual-journal-empty">
            <ShoppingBag aria-hidden="true" size={34} />
            <h2>No takeout items yet</h2>
            <p>Ask Fullwell to index your completed delivery or pickup history.</p>
          </div>
        ) : <VisualJournalFeed initialPage={visualJournal} pageNumber={pageNumber} />}
        <p className="journal-image-note">Only restaurant details that were visible to the household are shown here. Provider order IDs and account details stay private.</p>
      </section>
    </AppShell>
  );
}
