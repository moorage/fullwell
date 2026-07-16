import { ArrowUpRight, BookOpen, Coffee, Download, ExternalLink, Sparkles } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { ButtonLink, PageHeader, StatusNotice } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdOverviewRoute({ householdId }: { householdId: string }) {
  const { collections, households } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined) return <NotFoundRoute />;
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band">
        <PageHeader
          title={household.name}
          action={<span className="role-label">Your role: {household.role}</span>}
        >
          <p>A shared record of the food your household buys, saves, cooks, and likes.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="overview" />
        <StatusNotice tone="info" title="Continue journal work with your agent">
          <p>Ask Codex or Claude to audit purchases, track a recipe, or create a collection. The browser does not edit journal entries.</p>
          <div className="notice-actions">
            <a href="/install?host=codex">Open Codex instructions <ExternalLink aria-hidden="true" size={16} /></a>
            <a href="/install?host=claude">Open Claude instructions <ExternalLink aria-hidden="true" size={16} /></a>
          </div>
        </StatusNotice>
        <section className="journal-summary" aria-labelledby="journal-summary-heading">
          <header><h2 id="journal-summary-heading">Journal at a glance</h2><p>{household.updatedLabel}</p></header>
          <div className="summary-rail">
            <div><BookOpen aria-hidden="true" /><strong>{household.recipes}</strong><span>Recipes</span></div>
            <div><Coffee aria-hidden="true" /><strong>{household.snacks}</strong><span>Snacks</span></div>
            <div><Sparkles aria-hidden="true" /><strong>{collections.length}</strong><span>Collections</span></div>
          </div>
        </section>
        <div className="page-actions">
          <ButtonLink href="/account#exports" variant="secondary"><Download aria-hidden="true" size={18} /> Export household</ButtonLink>
          <a className="text-link text-link--arrow" href={`/households/${householdId}/collections`}>Review collections <ArrowUpRight aria-hidden="true" size={17} /></a>
        </div>
      </section>
    </AppShell>
  );
}
